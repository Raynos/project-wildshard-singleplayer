import {expect, test} from 'vitest';
import {startScriptProfile} from '../scripts/frame-floor-script-profile.mjs';
import {ensureWebKitPageClock, startWebKitTimeline, timelineLongFrames, type TimelinePort} from '../scripts/frame-floor-webkit-timeline.mjs';

function fixture(frozen = false) {
  let enabled = false, pageMs = 1000;
  const listeners = new Map<string, (params: unknown) => void>();
  const methods: string[] = [];
  const inspector: TimelinePort = {
    send: method => {
      methods.push(method);
      if (method === 'Page.enable') enabled = true;
      return Promise.resolve({});
    },
    on: (method, receive) => {
      listeners.set(method, receive);
      return () => { listeners.delete(method); };
    },
  };
  const evaluate = (): Promise<unknown> => {
    pageMs += 100;
    listeners.get('Timeline.eventRecorded')?.({record: {type: 'TimeStamp', startTime: enabled && !frozen ? pageMs / 1000 : 0,
      data: {message: `ff-anchor:${pageMs}`}}});
    return Promise.resolve(true);
  };
  return {inspector, evaluate, methods, listening: () => listeners.size > 0, emit: (method: string, params: unknown) => listeners.get(method)?.(params)};
}

test('starts the real Inspector clock before taking timeline anchors', async () => {
  const f = fixture();
  const stop = await startWebKitTimeline(f.inspector, f.evaluate);
  expect(f.methods.slice(0, 4)).toEqual(['Page.enable', 'Heap.enable', 'Timeline.enable', 'Timeline.start']);
  const first = await stop();
  expect(first.anchors).toEqual([[1.1, 1100], [1.2, 1200]]);
  expect(f.listening()).toBe(false);
  const next = await (await startWebKitTimeline(f.inspector, f.evaluate))();
  expect(next.anchors).toEqual([[1.3, 1300], [1.4, 1400]]);
  expect(f.methods.filter(method => method === 'Page.enable')).toHaveLength(1);
});

test('refuses zero anchors before returning a drive recorder and cleans up', async () => {
  const f = fixture(true);
  await expect(startWebKitTimeline(f.inspector, f.evaluate)).rejects.toThrow('zero or invalid anchor');
  expect(f.methods).toEqual(['Page.enable', 'Heap.enable', 'Timeline.enable', 'Timeline.start', 'Timeline.stop']);
  expect(f.listening()).toBe(false);
  const result = timelineLongFrames({records: [], anchors: [[0, 1000], [0, 2000]]}, [[1100, 200]]);
  expect(result.valid).toBe(false);
  expect(result.frames.every(frame => frame.verdict === 'unproven')).toBe(true);
});

test('waits for the anchor event after the evaluation response', async () => {
  let receive: ((params: unknown) => void) | undefined;
  const inspector: TimelinePort = {
    send: () => Promise.resolve({}),
    on: (method, listener) => {
      if (method !== 'Timeline.eventRecorded') return () => undefined;
      receive = listener; return () => { receive = undefined; };
    },
  };
  let at = 1000;
  const evaluate = (): Promise<unknown> => {
    at += 100;
    const stamp = at;
    setTimeout(() => receive?.({record: {type: 'TimeStamp', startTime: stamp / 1000,
      data: {message: `ff-anchor:${stamp}`}}}), 5);
    return Promise.resolve(true);
  };
  const stop = await startWebKitTimeline(inspector, evaluate);
  expect(receive).toBeDefined();
  const result = await stop();
  expect(result.anchors).toEqual([[1.1, 1100], [1.2, 1200]]);
  expect(receive).toBeUndefined();
});

test('refuses Page setup failures without leaving a listener or starting capture', async () => {
  const f = fixture();
  const calls: string[] = [];
  const inspector: TimelinePort = {...f.inspector, send: method => { calls.push(method); return Promise.reject(new Error('Page refused')); }};
  await expect(startWebKitTimeline(inspector, f.evaluate)).rejects.toThrow('Page refused');
  expect(f.listening()).toBe(false);
  expect(calls).toEqual(['Page.enable']);
});


test('retains passive GC events without requesting GC or snapshots', async () => {
  const f = fixture();
  const stop = await startWebKitTimeline(f.inspector, f.evaluate);
  const collection = {collection: {type: 'partial', startTime: 1.11, endTime: 1.12}};
  f.emit('Heap.garbageCollected', collection);
  const result = await stop();
  expect(result.garbageCollection).toEqual({available: true, events: [collection], dropped: 0});
  expect(f.methods.filter(method => method.startsWith('Heap.'))).toEqual(['Heap.enable']);
  expect(f.listening()).toBe(false);
  const noHeap: TimelinePort = {...f.inspector, send: method => method === 'Heap.enable'
    ? Promise.reject(new Error('unsupported')) : f.inspector.send(method)};
  const unavailable = await (await startWebKitTimeline(noHeap, f.evaluate))();
  expect(unavailable.garbageCollection).toEqual({available: false, events: [], dropped: 0});
});


test('admits known instantaneous events without counting them as busy coverage', () => {
  const duration = {type: 'RenderingFrame', startTime: 1, endTime: 1.01,
    children: [{type: 'FireAnimationFrame', startTime: 1.001, endTime: 1.005}]};
  const points = ['ScheduleStyleRecalculation', 'TimerInstall', 'TimerRemove', 'RequestAnimationFrame']
    .map(type => ({type, startTime: 1.005}));
  const anchors: [number, number][] = [[1, 1000], [1.016, 1016]];
  const base = timelineLongFrames({records: [duration], anchors}, [[1000, 16]]);
  const withPoints = timelineLongFrames({records: [duration, ...points], anchors}, [[1000, 16]]);
  expect(base.valid).toBe(true);
  expect(withPoints.frames).toEqual(base.frames);
  expect(withPoints.valid).toBe(true);
  const unknown = timelineLongFrames({records: [duration, {type: 'Unknown', startTime: 1.005}], anchors}, [[1000, 16]]);
  expect(unknown.valid).toBe(false);
  expect(unknown.invalid).toContain('1 records without a finite positive span');
  const sparse = timelineLongFrames({records: [duration, ...points], anchors: [[1, 1000], [2, 2000]]}, [[1000, 16]]);
  expect(sparse.valid).toBe(false);
  expect(sparse.invalid.some(reason => reason.includes('coverage'))).toBe(true);
});


test.each(['profile-first', 'timeline-first'])('both recorders share one Page clock (%s)', async order => {
  const f = fixture();
  const stopTimeline = order === 'timeline-first' ? await startWebKitTimeline(f.inspector, f.evaluate) : undefined;
  const stopProfile = await startScriptProfile(f.inspector);
  const stop = stopTimeline ?? await startWebKitTimeline(f.inspector, f.evaluate);
  const timeline = await stop();
  expect(timeline.anchors.every(([seconds]) => seconds > 0)).toBe(true);
  expect(f.methods.indexOf('Page.enable')).toBeLessThan(f.methods.indexOf('ScriptProfiler.startTracking'));
  const finishing = stopProfile(), profile = {samples: {stackTraces: []}};
  f.emit('ScriptProfiler.trackingComplete', profile);
  expect(await finishing).toBe(profile);
  expect(f.methods.filter(method => method === 'Page.enable')).toHaveLength(1);
  expect(f.listening()).toBe(false);
});

test('a ScriptProfiler clock refusal starts no recording and leaves no listener', async () => {
  const f = fixture(), calls: string[] = [];
  const inspector: TimelinePort = {...f.inspector, send: method => { calls.push(method); return Promise.reject(new Error('Page refused')); }};
  await expect(startScriptProfile(inspector)).rejects.toThrow('Page refused');
  expect(calls).toEqual(['Page.enable']); expect(f.listening()).toBe(false);
});


test('concurrent recorders await the same clock admission without resetting it', async () => {
  let release = (): void => undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const methods: string[] = [];
  const inspector: TimelinePort = {send: method => { methods.push(method); return pending; }, on: () => () => undefined};
  const first = ensureWebKitPageClock(inspector), second = ensureWebKitPageClock(inspector);
  expect(methods).toEqual(['Page.enable']);
  release(); await Promise.all([first, second]);
  await ensureWebKitPageClock(inspector); expect(methods).toEqual(['Page.enable']);
});

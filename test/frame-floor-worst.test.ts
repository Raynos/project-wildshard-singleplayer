import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- exercise the real serialized sampler without starting a browser or Simulator
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- isolate the real page sampler with controlled drawn-frame timestamps
import {runInNewContext} from 'node:vm';

async function sampleIntervals(intervals: number[]): Promise<unknown> {
  const source = readFileSync(new URL('../scripts/frame-floor.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function sample(n, timeline = false) {');
  const end = source.indexOf('/** the whole-drive sampler', start);
  if (start === -1 || end <= start) throw new Error('Serialized sampler not found');
  const callbacks: ((at: number) => void)[] = [];
  let now = 100;
  const game = {frameCount: 0, frameI: 1, frameMs: [33], workMs: [1], lastFrame: {calls: 1, triangles: 1},
    app: {cpu: {enabled: false, snapshot: () => ({enabled: true, frame: 0, owners: []})}},
    renderer: {getContext: () => ({isContextLost: () => false})}};
  const context = {window: {__wildshard: {world: {game, player: {position: {x: 0, y: 0, z: 0}}}}},
    performance: {now: () => now}, setTimeout: () => 1, clearTimeout: () => undefined,
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- the real sampler schedules native rAF callbacks, which the fixture must retain until a drawn frame
    cancelAnimationFrame: () => undefined, requestAnimationFrame: (callback: (at: number) => void) => {
      callbacks.push(callback); return callbacks.length;
    }};
  const result: unknown = runInNewContext(`(${source.slice(start, end)})(${intervals.length})`, context);
  for (const delta of [0, ...intervals]) {
    now += delta; game.frameCount++;
    const callback = callbacks.shift();
    if (callback === undefined) throw new Error('Sampler stopped before every drawn frame');
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- deliver the retained native rAF callback at the controlled frame timestamp
    callback(now);
  }
  expect(callbacks).toHaveLength(0);
  return await result;
}

test('retains the six worst real cadence intervals without changing the measured sample', async () => {
  expect(await sampleIntervals([33.111, 80.222, 35.123, 70.123, 40.456, 60.789, 50.222, 45.123, 34.555]))
    .toMatchObject({frames: 9, skipped: 0, p50Ms: 45.123, p95Ms: 80.222, p99Ms: 80.222, maxMs: 80.222,
      worstFrameMs: [80.222, 70.123, 60.789, 50.222, 45.123, 40.456]});
});

test('keeps ties and reports only existing intervals in samples shorter than six', async () => {
  expect(await sampleIntervals([34, 34, 34])).toMatchObject({frames: 3, worstFrameMs: [34, 34, 34]});
});

test('attributes CPU samples on the native navigation clock after a delayed profiler start', () => {
  const source = readFileSync(new URL('../scripts/frame-floor.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function summarizeTravelProfile('), end = source.indexOf('\nfunction webkit(', start);
  if (start === -1 || end <= start) throw new Error('CPU attribution function missing');
  const profile = {startTime: 100_000_000, pageNavigationStartUs: 99_000_000,
    nodes: [{id: 1, callFrame: {functionName: '(root)', url: '', lineNumber: -1}, children: [2]},
      {id: 2, callFrame: {functionName: 'nativeLink', url: 'shader.js', lineNumber: 7}}],
    samples: [2, 2], timeDeltas: [1_400_000, 10_000]};
  const saved: string[] = [];
  const context = {profile, cpuProfileDir: 'unused', join: (dir: string, file: string) => `${dir}/${file}`,
    writeFileSync: (_path: string, bytes: string): void => { saved.push(bytes); }};
  // The page evaluate after Profiler.start arrives at 2400 ms. Sampling has
  // already started: using that as the profile origin shifts this task by 1400 ms.
  const result: unknown = runInNewContext(`(${source.slice(start, end)})(profile, 2400, [[2400, 15]], 'drive')`, context);
  expect(result).toMatchObject({longTasks: 1, tasks: [{start: 2400, ms: 15,
    self: ['10 ms nativeLink shader.js:8'], inclusive: ['10 ms nativeLink shader.js:8']}]});
  expect(saved).toEqual([JSON.stringify(profile)]);
});


test('keeps pre-afterPlay shader identities on the original page clock', () => {
  const source = readFileSync(new URL('../scripts/frame-floor.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function nodeBuildsByHook('), end = source.indexOf('\nfunction longFrameHooks(', start);
  if (start === -1 || end <= start) throw new Error('Build attribution function missing');
  const log = [
    {at: 125, ms: 112.5, material: 'tree', object: 'instances', how: 'first of its key'},
    {at: 275, ms: 8, material: 'water', object: 'surface', how: 'reused'},
    {at: 310, material: 'old-pin', object: 'mesh', how: 'no graph shape'},
  ];
  const hooks = [{instance: 'cell', hook: 'world', start: 100, end: 200},
    {instance: 'cell', hook: 'afterPlay', start: 250, end: 300}];
  const value: unknown = runInNewContext(`(${source.slice(start, end)})(log, hooks)`, {log, hooks});
  expect(value).toEqual({total: 3, afterPlay: 2,
    byHook: {'cell:world': 1, 'cell:afterPlay': 1, 'between hooks': 1}, afterPlayAt: 250, afterPlayMs: 50,
    late: [[25, 'water@surface'], [60, 'old-pin@mesh']],
    events: [log[0], log[1], {...log[2], ms: null}]});
});

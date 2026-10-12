import { expect, it } from 'vitest';
import { startWebKitTimeline, timelineAnchors, timelineLongFrames } from '../scripts/frame-floor-webkit-timeline.mjs';

// Timeline seconds 10.000 = page 1000 ms.
const anchor = (sec: number, ms: number) => ({ type: 'TimeStamp', startTime: sec, data: { message: `ff-anchor:${ms}` } });
const frame = (start: number, end: number, children: unknown[]) => ({ type: 'RenderingFrame', startTime: start, endTime: end, children });
const child = (type: string, start: number, end: number, data?: Record<string, unknown>) => ({ type, startTime: start, endTime: end, ...(data ? { data } : {}) });
/** a 1 ms rAF iteration at every 60 Hz vsync in [from, to) seconds, skipping the ones `skip` says */
const vsyncs = (from: number, to: number, skip: (at: number) => boolean = () => false) => {
  const out: unknown[] = [];
  for (let at = from; at < to - 1e-9; at += 1 / 60) if (!skip(at)) out.push(frame(at, at + 0.001, [child('FireAnimationFrame', at, at + 0.0005)]));
  return out;
};

it('anchors the timeline clock to the page clock through nested TimeStamp records', () => {
  const records = [frame(10, 10.001, [anchor(10, 1000)]), anchor(12, 3000)];
  expect(timelineAnchors(records)).toEqual([[10, 1000], [12, 3000]]);
});

it('splits a long frame into the rendering update after rAF, tasks and idle main-thread time', () => {
  const records = [
    anchor(10, 1000),
    // the drawn frame's iteration: rAF callbacks 1000-1010, then a 25 ms rendering update (present / flush)
    frame(10, 10.035, [child('FireAnimationFrame', 10, 10.010), child('Composite', 10.030, 10.035)]),
    // a build task (MessageChannel) between vsyncs
    frame(10.040, 10.048, [child('EventDispatch', 10.040, 10.048, { type: 'message' })]),
    // ordinary vsyncs for the rest of the window (coverage)
    ...vsyncs(10.1, 11),
    anchor(11, 2000),
  ];
  const summary = timelineLongFrames({ records, anchors: timelineAnchors(records) }, [[1000, 60]]);
  expect(summary).toMatchObject({ valid: true, invalid: [], anchorDriftMs: 0 });
  const [f] = summary.frames;
  expect(f).toMatchObject({ start: 1000, ms: 60, busyMs: 43, afterRafMs: 25, tasksMs: 8, rafMs: 10, idleMs: 17, verdict: 'renderUpdate', longestBusyMs: 35 });
  expect(f.top[0]).toBe('FireAnimationFrame 10');
  expect(f.top).toContain('EventDispatch:message 8');
});

it('calls a frame idle only with run-loop coverage, valid anchors and no dropped records', () => {
  const covered = [anchor(10, 1000), ...vsyncs(10, 11, (at) => at > 10.01 && at < 10.06), anchor(11, 2000)];
  expect(timelineLongFrames({ records: covered, anchors: timelineAnchors(covered) }, [[1018, 48]]).frames[0]).toMatchObject({ idleMs: 48, verdict: 'idle' });
  // the same frame with no RenderingFrame coverage, a drifting clock, a capped window or one anchor is unproven
  const bare = [anchor(10, 1000), anchor(11, 2000)];
  const uncovered = timelineLongFrames({ records: bare, anchors: timelineAnchors(bare) }, [[1017, 50]]);
  expect(uncovered.valid).toBe(false);
  expect(uncovered.frames[0]?.verdict).toBe('unproven');
  const drift = [anchor(10, 1000), ...vsyncs(10, 11), anchor(11, 2050)];
  expect(timelineLongFrames({ records: drift, anchors: timelineAnchors(drift) }, [[1017, 50]]).invalid[0]).toMatch(/drift/);
  expect(timelineLongFrames({ records: covered, anchors: timelineAnchors(covered), dropped: 3 }, [[1017, 50]]).valid).toBe(false);
  expect(timelineLongFrames({ records: [anchor(10, 1000)], anchors: [[10, 1000]] }, [[0, 50]])).toMatchObject({ valid: false, frames: [] });
  const zero = [anchor(0, 1000), frame(0, 0, []), anchor(1, 2000)];
  expect(timelineLongFrames({ records: zero, anchors: timelineAnchors(zero) }, [[1017, 50]]).valid).toBe(false);
});

it('starts and stops the Timeline on the driving Inspector, releasing its listener', async () => {
  const sent: string[] = [], evaluated: string[] = [];
  let listener: ((params: unknown) => void) | undefined;
  const port = {
    send: (method: string) => { sent.push(method); return Promise.resolve({}); },
    on: (_method: string, receive: (params: unknown) => void) => { listener = receive; return () => { listener = undefined; }; },
  };
  const stop = await startWebKitTimeline(port, (expression) => { evaluated.push(expression); return Promise.resolve(true); });
  listener?.({ record: anchor(10, 1000) });
  const timeline = await stop();
  expect(sent).toEqual(['Timeline.enable', 'Timeline.start', 'Timeline.stop']);
  expect(evaluated).toHaveLength(2);
  expect(timeline).toMatchObject({ anchors: [[10, 1000]], dropped: 0 });
  expect(listener).toBeUndefined();
});

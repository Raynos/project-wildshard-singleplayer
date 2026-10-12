// WebKit Timeline attribution of Safari long frames (sp-o3, SF63 Simulator frame floor; diagnostic, no timing credit).
// On Cocoa, WebKit wraps every busy main-thread run-loop iteration in a `RenderingFrame` record whose children say what ran
// (FireAnimationFrame = rAF callbacks, TimerFire, EventDispatch such as MessageChannel `message`, Composite, Layout...).
// The gaps between them are an idle main thread. So each long frame splits into: idle (the display link / UI-process
// commit did not deliver the next rendering update: compositor / GPU side), the rendering update after the rAF callbacks
// (canvas present, layer flush, a WebGL display buffer the GPU process has not released: GPU side), and task time
// outside rAF (build-pacing tasks, worker and fetch handlers, GC: CPU side). `--gl-time` wraps only the WebGL calls, which
// enqueue to the GPU process and return, so their small total never excluded GPU backpressure.

/** Records kept per window; past it the partition is refused (`dropped`). */
const RECORD_CAP = 200000;
/** The page/timeline clock drift two anchors may show before the placement is refused. */
const DRIFT_LIMIT_MS = 5;
/** The share of the window's vsyncs that must show up as a RenderingFrame with rAF callbacks before uncovered time may be called idle. */
const COVERAGE_FLOOR = 0.8;

const RENDER = new Set(['Composite', 'Paint', 'Layout', 'RecalculateStyles', 'InvalidateLayout', 'ScheduleStyleRecalculation', 'Screenshot']);

/** @param {{ type?: string }} record */
function category(record) {
  const type = record.type ?? '';
  if (type === 'FireAnimationFrame') return 'raf';
  if (type === 'TimerFire') return 'timer';
  if (type === 'EventDispatch') return 'event';
  if (type === 'ObserverCallback') return 'observer';
  if (type === 'FunctionCall' || type === 'EvaluateScript') return 'script';
  if (RENDER.has(type)) return 'render';
  return 'other';
}

/**
 * Start WebKit's Timeline on the driving Inspector and anchor its clock to the page's `performance.now()` with a
 * `console.timeStamp`. The returned stop resolves to the raw records and both anchors (start, end).
 * @param {import('./frame-floor-webkit-timeline.mjs').TimelinePort} inspector
 * @param {(expression: string) => Promise<unknown>} evaluate
 */
export async function startWebKitTimeline(inspector, evaluate) {
  /** @type {unknown[]} */
  const records = [];
  let dropped = 0;
  const off = inspector.on('Timeline.eventRecorded', (params) => {
    if (params === null || typeof params !== 'object' || !('record' in params)) return;
    if (records.length < RECORD_CAP) records.push(params.record); else dropped++;
  });
  try {
    await inspector.send('Timeline.enable').catch(() => undefined); // older WebKit has no enable; start alone records
    await inspector.send('Timeline.start', { maxCallStackDepth: 0 });
    await evaluate("(console.timeStamp('ff-anchor:' + performance.now()), true)");
  } catch (error) { off(); throw error; }
  return async () => {
    try {
      await evaluate("(console.timeStamp('ff-anchor:' + performance.now()), true)");
      await inspector.send('Timeline.stop');
    } finally { off(); }
    return { records, anchors: timelineAnchors(records), dropped };
  };
}

/** Every `ff-anchor:<page ms>` TimeStamp record as [timeline seconds, page ms], in order.
 * @param {readonly unknown[]} records */
export function timelineAnchors(records) {
  /** @type {[number, number][]} */
  const out = [];
  /** @param {unknown} record */
  const walk = (record) => {
    if (record === null || typeof record !== 'object') return;
    const r = /** @type {{ type?: string, startTime?: number, data?: { message?: unknown }, children?: unknown[] }} */ (record);
    const message = typeof r.data?.message === 'string' ? r.data.message : '';
    if (r.type === 'TimeStamp' && message.startsWith('ff-anchor:') && typeof r.startTime === 'number') out.push([r.startTime, Number(message.slice(10))]);
    for (const child of r.children ?? []) walk(child);
  };
  for (const record of records) walk(record);
  return out.sort((a, b) => a[0] - b[0]);
}

/** @param {number} a0 @param {number} a1 @param {number} b0 @param {number} b1 */
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const round = (/** @type {number} */ v) => Math.round(v * 10) / 10;

/**
 * Split each long frame ([startMs, ms, ...] on the page clock, as `longFrames.at`) by the main thread's state.
 * idleMs: no run-loop work at all. afterRafMs: the rendering update after the last rAF callback of an iteration that ran
 * them. tasksMs: busy iterations that ran no rAF callback (timers, messages, script, GC). The rest of `busy` is rAF
 * callbacks, layout, or the part of an iteration before its callbacks. Verdict: the largest of idle, afterRaf, tasks, raf.
 * @param {{ records: readonly unknown[], anchors: readonly [number, number][] }} timeline
 * @param {readonly (readonly number[])[]} frames
 */
export function timelineLongFrames(timeline, frames) {
  if (timeline.anchors.length < 2) return { valid: false, invalid: [`${timeline.anchors.length} ff-anchor TimeStamp records (2 needed): the timeline cannot be placed on the page clock`], frames: [] };
  const [anchorSec, anchorMs] = timeline.anchors[0];
  const last = timeline.anchors.at(-1) ?? timeline.anchors[0];
  const driftMs = round((last[0] - anchorSec) * 1000 - (last[1] - anchorMs));
  const windowMs = last[1] - anchorMs;
  const page = (/** @type {number} */ sec) => anchorMs + (sec - anchorSec) * 1000;
  /** @type {{ start: number, end: number, rafEnd: number | null, children: { cat: string, start: number, end: number, type: string, detail: string }[] }[]} */
  const spans = [];
  let badSpans = 0, renderingFrames = 0, rafFrames = 0;
  for (const record of timeline.records) {
    if (record === null || typeof record !== 'object') continue;
    const r = /** @type {{ type?: string, startTime?: number, endTime?: number, children?: unknown[] }} */ (record);
    if (r.type === 'TimeStamp') continue;
    if (typeof r.startTime !== 'number' || typeof r.endTime !== 'number' || !Number.isFinite(r.startTime) || !Number.isFinite(r.endTime) || r.startTime <= 0 || r.endTime < r.startTime) { badSpans++; continue; }
    if (r.type === 'RenderingFrame') renderingFrames++;
    const kids = (r.type === 'RenderingFrame' ? r.children ?? [] : [record]).flatMap((child) => {
      if (child === null || typeof child !== 'object') return [];
      const c = /** @type {{ type?: string, startTime?: number, endTime?: number, data?: { type?: unknown, timerId?: unknown } }} */ (child);
      if (typeof c.startTime !== 'number' || typeof c.endTime !== 'number') return [];
      const detail = c.type === 'EventDispatch' && typeof c.data?.type === 'string' ? c.data.type : '';
      return [{ cat: category(c), start: page(c.startTime), end: page(c.endTime), type: c.type ?? '?', detail }];
    });
    const rafEnds = kids.filter((k) => k.cat === 'raf').map((k) => k.end);
    if (r.type === 'RenderingFrame' && rafEnds.length > 0) rafFrames++;
    spans.push({ start: page(r.startTime), end: page(r.endTime), rafEnd: rafEnds.length === 0 ? null : Math.max(...rafEnds), children: kids });
  }
  spans.sort((a, b) => a.start - b.start);
  // Coverage: rAF runs every vsync (60 Hz) even under the 30 fps cap, so a window shows ~windowMs / 16.7 rAF iterations.
  const coverage = windowMs > 0 ? rafFrames / (windowMs / (1000 / 60)) : 0;
  /** @type {string[]} */
  const invalid = [];
  if (Math.abs(driftMs) > DRIFT_LIMIT_MS) invalid.push(`anchor drift ${driftMs} ms > ${DRIFT_LIMIT_MS} ms`);
  if (anchorSec <= 0 || last[0] <= 0) invalid.push('zero timeline timestamps (the proxy zero-clock fault)');
  if ((timeline.dropped ?? 0) > 0) invalid.push(`${timeline.dropped} records past the ${RECORD_CAP} cap`);
  if (badSpans > 0) invalid.push(`${badSpans} records without a finite positive span`);
  if (renderingFrames === 0) invalid.push('no RenderingFrame records: run-loop coverage not established on this Inspector');
  else if (coverage < COVERAGE_FLOOR) invalid.push(`RenderingFrame rAF coverage ${round(coverage * 100)}% < ${COVERAGE_FLOOR * 100}% of vsyncs`);
  const valid = invalid.length === 0;
  const out = frames.map(([start, ms]) => {
    const end = start + ms;
    let busy = 0, afterRaf = 0, tasks = 0, raf = 0, longest = 0;
    /** @type {Record<string, number>} */
    const byType = {};
    for (const s of spans) {
      if (s.end <= start || s.start >= end) continue;
      const o = overlap(s.start, s.end, start, end);
      busy += o; longest = Math.max(longest, s.end - s.start);
      if (s.rafEnd === null) tasks += o; else afterRaf += overlap(s.rafEnd, s.end, start, end);
      for (const k of s.children) {
        const ko = overlap(k.start, k.end, start, end);
        if (ko === 0) continue;
        if (k.cat === 'raf') raf += ko;
        const key = k.detail === '' ? k.type : `${k.type}:${k.detail}`;
        byType[key] = (byType[key] ?? 0) + ko;
      }
    }
    const idle = Math.max(0, ms - busy);
    const parts = { idle, renderUpdate: afterRaf, tasks, raf };
    const verdict = valid ? Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0] : 'unproven';
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${round(v)}`);
    return { start: Math.round(start), ms: Math.round(ms), idleMs: round(idle), busyMs: round(busy), afterRafMs: round(afterRaf), tasksMs: round(tasks), rafMs: round(raf), longestBusyMs: round(longest), verdict, top };
  });
  /** @type {Record<string, number>} */
  const verdicts = {};
  for (const f of out) verdicts[f.verdict] = (verdicts[f.verdict] ?? 0) + 1;
  const sum = (/** @type {'idleMs' | 'afterRafMs' | 'tasksMs' | 'rafMs' | 'ms'} */ key) => round(out.reduce((acc, f) => acc + f[key], 0));
  return { note: 'WebKit Timeline main-thread split of each long frame (diagnostic, no timing credit). afterRaf / renderUpdate is the browser rendering update after the rAF callbacks (layout, compositing, canvas present): browser render work, not GPU alone. idleMs is time with no run-loop record, and is only called idle when the coverage checks hold (valid); otherwise every frame is unproven.',
    valid, invalid, anchorDriftMs: driftMs, records: timeline.records.length, renderingFrames, coverage: round(coverage * 100) / 100, verdicts,
    totals: { ms: sum('ms'), idleMs: sum('idleMs'), afterRafMs: sum('afterRafMs'), tasksMs: sum('tasksMs'), rafMs: sum('rafMs') }, frames: out };
}

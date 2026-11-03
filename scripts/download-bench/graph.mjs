// The whole boot's request graph, recorded by scripts/phone-loading and
// replayed on the virtual link (E525). Each request's parent is the request
// that finished last before it started (the event that released it); the gap
// between the two is the page's own work (CPU at the preset's throttle, or
// waits). Replaying the graph with gaps scaled and the link changed separates
// download time from CPU time without a browser.

/**
 * @typedef {{ url: string, start: number, end: number | null, transferBytes?: number, source?: string }} RecordedRequest
 * @typedef {{ i: number, url: string, bytes: number, parent: number, gap: number, start: number, end: number, cache: boolean }} Node
 */

/** @param {{ tap: number, control: number, requests: RecordedRequest[] }} run */
export function extractGraph(run) {
  const rows = run.requests.filter(r => r.end !== null && r.start >= run.tap && r.start < run.control)
    .map(r => ({ url: r.url, start: r.start, end: r.end ?? 0, bytes: r.transferBytes ?? 0, source: r.source ?? 'network' }))
    .sort((a, b) => a.start - b.start);
  const byEnd = rows.map((r, i) => ({ i, end: r.end })).sort((a, b) => a.end - b.end);
  /** Last request to end at or before `at`, among requests that started before `self` (no cycles). */
  const parentAt = (/** @type {number} */ at, self = rows.length) => {
    let lo = 0, hi = byEnd.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, e = byEnd[mid]; if (e !== undefined && e.end <= at) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    for (let k = found; k >= 0; k--) { const e = byEnd[k]; if (e !== undefined && e.i < self) return e.i; }
    return -1;
  };
  /** @type {Node[]} */
  const nodes = rows.map((r, i) => {
    const p = parentAt(r.start, i), parentEnd = p < 0 ? run.tap : (rows[p]?.end ?? run.tap);
    // cache hits (no wire bytes) keep their recorded duration as local work, not link time
    return { i, url: r.url, bytes: r.bytes, parent: p, gap: Math.max(0, r.start - parentEnd), start: r.start - run.tap, end: r.end - run.tap, cache: r.bytes === 0 };
  });
  const cp = parentAt(run.control), controlParentEnd = cp < 0 ? run.tap : (rows[cp]?.end ?? run.tap);
  return { nodes, control: { parent: cp, gap: run.control - controlParentEnd }, recordedMs: run.control - run.tap };
}

/**
 * Replay on `link`. `cpu` scales every gap (1 = as recorded, 0 = free CPU).
 * @param {ReturnType<typeof extractGraph>} graph
 * @param {ReturnType<typeof import('./link.mjs').createLink>} link
 */
export async function replay(graph, link, { cpu = 1, drop = (/** @type {Node} */ _n) => false } = {}) {
  const ends = new Map(), children = new Map();
  for (const n of graph.nodes) { const list = children.get(n.parent) ?? []; list.push(n); children.set(n.parent, list); }
  /** @param {Node} n */
  const run = async n => {
    await link.delay(n.gap * cpu);
    await (n.cache || drop(n) ? link.delay(n.cache ? (n.end - n.start) * cpu : 0) : link.transfer(n.bytes, n.url));
    ends.set(n.i, link.now);
    await Promise.all((children.get(n.i) ?? []).map(run));
  };
  const { ms } = await link.run(() => Promise.all((children.get(-1) ?? []).map(run)));
  // control follows its releasing request by the recorded (scaled) gap
  const parentEnd = graph.control.parent < 0 ? 0 : (ends.get(graph.control.parent) ?? ms);
  return { controlMs: parentEnd + graph.control.gap * cpu, lastRequestMs: ms };
}

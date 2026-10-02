// Pure nightly verdicts. Memory is decimal GB; the GL growth budget is binary MiB.
export const PHASE_LIMITS = { loading: 1.8, play: 1, explorer: 1 };

/** Three one-second readings after settling; the deadline returns the last three with their spread.
 * @param {{seconds: number, nativeGB: number, inspectorGB: number}[]} samples
 * @param {number} [maxSeconds]
 */
export function settledMemory(samples, maxSeconds = 20) {
  if (samples.length < 3) return null;
  const tail = samples.slice(-3);
  if (tail.some((sample) => !Number.isFinite(sample.nativeGB) || sample.nativeGB <= 0 || !Number.isFinite(sample.inspectorGB) || sample.inspectorGB <= 0)) return null;
  const close = (a, b) => Math.abs(a.nativeGB - b.nativeGB) / a.nativeGB <= 0.02 + 1e-12;
  const settled = close(tail[0], tail[1]) && close(tail[1], tail[2]);
  const seconds = tail[2].seconds;
  if (!settled && seconds < maxSeconds) return null;
  const median = (key) => tail.map((sample) => sample[key]).toSorted((a, b) => a - b)[1];
  const nativeGB = median('nativeGB'), inspectorGB = median('inspectorGB');
  const minGB = Math.min(...tail.map((sample) => sample.nativeGB));
  const maxGB = Math.max(...tail.map((sample) => sample.nativeGB));
  return { nativeGB, inspectorGB, minGB, maxGB, spreadGB: maxGB - minGB, spreadPercent: (maxGB - minGB) / nativeGB * 100,
    samples: tail, settled, timedOut: !settled, seconds };
}

export function memoryVerdict(shard, phase, nativeGB, inspectorGB, previousGB, pending = []) {
  const limitGB = PHASE_LIMITS[phase];
  if (!Number.isFinite(nativeGB) || nativeGB <= 0 || !Number.isFinite(inspectorGB) || inspectorGB <= 0 || limitGB === undefined)
    return { verdict: 'failure', reason: 'missing measurement', limitGB };
  if (nativeGB > limitGB) return { verdict: 'failure', reason: 'absolute limit', limitGB };
  const growth = previousGB > 0 ? nativeGB / previousGB - 1 : null;
  if (growth !== null && growth > 0.1 + 1e-12) {
    const intended = pending.some((entry) => entry.fields?.includes(`memory.${shard}.${phase}`));
    return { verdict: intended ? 'pending' : 'failure', reason: 'growth > 10%', limitGB, growth };
  }
  return { verdict: 'success', reason: previousGB > 0 ? 'within limits and growth band' : 'first reading', limitGB, growth };
}

export function parseMemoryRun(nativeText, inspectorText, shard, previous = {}, pending = []) {
  const rows = (text) => text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const native = rows(nativeText).find((row) => row.type === 'summary');
  const inspectorRows = rows(inspectorText);
  const inspector = inspectorRows.find((row) => row.kind === 'summary')?.result;
  return Object.keys(PHASE_LIMITS).map((phase) => {
    const reading = inspectorRows.find((row) => row.kind === 'settled' && row.phase === phase)?.result;
    const nativePeakGB = native?.phases?.[phase]?.gameHighGB;
    const nativeGB = reading?.nativeGB ?? nativePeakGB;
    const inspectorGB = reading?.inspectorGB ?? inspector?.inspectorPeakGB?.[phase];
    const result = memoryVerdict(shard, phase, nativeGB, inspectorGB, previous[phase], pending);
    if (!Number.isFinite(nativePeakGB) || nativePeakGB <= 0) { result.verdict = 'failure'; result.reason = 'missing measurement'; }
    // Settling changes the growth measurement, never permission for a transient over the absolute cap.
    if (nativePeakGB > PHASE_LIMITS[phase]) { result.verdict = 'failure'; result.reason = 'absolute limit'; }
    if (inspector?.error || !native || (native.lost ?? []).some((lost) => lost.phase === phase)) {
      result.verdict = 'failure'; result.reason = inspector?.error ?? 'WebContent lost or incomplete';
    }
    const row = { shard, phase, nativeGB, inspectorGB, nativePeakGB, previousGB: previous[phase] ?? null,
      ...(reading ? { measurement: 'settled-median-3', settling: reading } : { measurement: 'legacy-peak' }) };
    return Object.assign(row, result);
  });
}

export function slopeGrowth(samples, key) {
  const points = samples.filter((sample) => sample.seconds >= 300 && sample.seconds <= 1200);
  if (points.length < 2) return null;
  const mean = (name) => points.reduce((sum, point) => sum + point[name], 0) / points.length;
  const x = mean('seconds'), y = mean(key);
  const denominator = points.reduce((sum, point) => sum + (point.seconds - x) ** 2, 0);
  return denominator > 0 ? points.reduce((sum, point) => sum + (point.seconds - x) * (point[key] - y), 0) / denominator * 900 : null;
}

export function soakVerdict(samples, errors = [], stuck = []) {
  const window = samples.filter((sample) => sample.seconds >= 300 && sample.seconds <= 1201);
  const first = window[0], last = window.at(-1);
  const gpuGrowthBytes = slopeGrowth(samples, 'gpuBytes');
  const heapGrowthBytes = slopeGrowth(samples, 'heapBytes');
  const failures = [];
  if (samples.some((sample) => ['seconds', 'gpuBytes', 'heapBytes', 'geometries', 'textures'].some((key) => !Number.isFinite(sample[key]) || sample[key] < 0))) failures.push('invalid sample measurement');
  if (!first || !last || last.seconds < 1199 || gpuGrowthBytes === null || heapGrowthBytes === null) failures.push('incomplete 5–20 minute window');
  if (errors.length > 0) failures.push('page errors');
  if (stuck.length > 0) failures.push('stuck states');
  if (gpuGrowthBytes !== null && gpuGrowthBytes > 8 * 1024 ** 2) failures.push('GPU-byte growth > 8 MiB');
  if (first && heapGrowthBytes !== null && heapGrowthBytes > first.heapBytes * 0.1) failures.push('heap growth > 10%');
  if (first && last && (last.geometries > first.geometries * 1.05 || last.textures > first.textures * 1.05)) failures.push('geometry/texture growth > 5%');
  const median = (values) => { const sorted = values.toSorted((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
  return { verdict: failures.length > 0 ? 'failure' : 'success', failures, gpuGrowthBytes, heapGrowthBytes,
    gpuFormula: 'least-squares bytes/second over 300–1200 seconds × 900; limit 8 MiB',
    heapFormula: 'least-squares bytes/second over 300–1200 seconds × 900; limit minute-5 heap × 0.10',
    fpsFirst: median(samples.filter((sample) => sample.seconds <= 300).map((sample) => sample.fps)),
    fpsLast: median(samples.filter((sample) => sample.seconds >= 900).map((sample) => sample.fps)) };
}

export function flakedFields(report) {
  const fields = report.flaked ? new Set(report.flaked) : new Set();
  for (const row of report.fields ?? []) if (row.verdict === 'flaked') fields.add(row.field);
  return [...fields].map((field) => `${report.boot?.shard}/${report.boot?.tier}/${field}`);
}

/** Frame-interval projection is informational: paced captures do not prove unpaced GPU time.
 * @param {{boot?:{shard?:string,tier?:string},poses?:Record<string,{frameP95Ms?:number}>}} report
 * @param {{k3060:number,source:string,assumption:string}} reference */
export function desktopProjections(report, reference) {
  if (report.boot?.tier !== 'desktop') return [];
  if (!Number.isFinite(reference.k3060) || reference.k3060 <= 0) throw new Error('Invalid desktop projection ratio');
  return Object.entries(report.poses ?? {}).map(([pose, row]) => {
    const measured = row.frameP95Ms;
    const projected3060FrameMs = typeof measured === 'number' && Number.isFinite(measured) && measured > 0 ? measured / reference.k3060 : null;
    return { shard: report.boot?.shard ?? '', pose, m5FrameMs: measured ?? null, projected3060FrameMs, targetFrameMs: 1000 / 60,
      verdict: projected3060FrameMs === null ? 'missing' : projected3060FrameMs <= 1000 / 60 ? 'within projection' : 'over projection',
      source: reference.source, assumption: reference.assumption, formula: 'M5 drawn-frame p95 interval / k3060; informational (includes capture pacing)' };
  });
}

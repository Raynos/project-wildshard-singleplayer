// Pure nightly verdicts. Memory is decimal GB; the GL growth budget is binary MiB.
export const PHASE_LIMITS = { loading: 1.8, play: 1, explorer: 1 };

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
  const inspector = rows(inspectorText).find((row) => row.kind === 'summary')?.result;
  return Object.keys(PHASE_LIMITS).map((phase) => {
    const nativeGB = native?.phases?.[phase]?.gameHighGB;
    const inspectorGB = inspector?.inspectorPeakGB?.[phase];
    const result = memoryVerdict(shard, phase, nativeGB, inspectorGB, previous[phase], pending);
    if (inspector?.error || !native || (native.lost ?? []).some((lost) => lost.phase === phase)) {
      result.verdict = 'failure'; result.reason = inspector?.error ?? 'WebContent lost or incomplete';
    }
    const row = { shard, phase, nativeGB, inspectorGB, previousGB: previous[phase] ?? null };
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

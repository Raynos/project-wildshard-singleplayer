import { readLoadingReport } from '../../../scripts/admin-data/validate.mjs';

const phaseOwner = (name, shard) => {
  if (name === 'admission.modules') return 'src/entry.ts';
  if (name === 'admission.descriptor') return 'src/game/shardfile/loader.ts';
  if (name.startsWith('admission.')) return 'src/game/shardfile/product.ts';
  if (name === 'props' || name === 'animals' || name === 'weapon') return `shard ${shard}: ${name} hook`;
  if (name === 'shaders' || name === 'firstFrame') return 'src/engine/render/precompile.ts';
  if (name === 'Ready') return 'src/game/session/finish.ts';
  if (name === 'navigation') return 'document navigation and initial shell';
  return `src/engine/core/bootstrap.ts: ${name}`;
};

/** Convert measured navigation/trace clocks into the strict SF68 consumer contract. Failed runs stay missing;
 * no missing task samples or unsupported Safari observer is silently interpreted as zero work. */
export function loadingReport(pin, device, captures, analyses) {
  const missing = ['iOS Simulator and physical phone timings not measured in this desktop 4x-CPU comparison.'];
  const runs = [];
  for (const capture of captures) {
    const base = `${capture.shard}-${capture.cache}`, analysis = analyses.find(row => row.base === base);
    if (capture.status !== 'ok' || !Number.isFinite(capture.playMs) || capture.playMs <= 0 || !analysis) {
      missing.push(`${base}: ${capture.status}; no accepted playable/trace result.`); continue;
    }
    if (!Number.isFinite(capture.tapToOriginMs) || capture.tapToOriginMs < 0) throw new Error(`Invalid navigation fence: ${base}`);
    const offset = capture.tapToOriginMs, end = offset + capture.playMs;
    const phases = [], starts = [['navigation', 0], ...analysis.phases.map(([name, at]) => [name, offset + at])];
    for (let index = 0; index < starts.length; index++) {
      const [name, start] = starts[index], next = Math.min(end, starts[index + 1]?.[1] ?? end);
      if (start < end && next >= start) phases.push({ name, startMs: start, endMs: next, owner: phaseOwner(name, capture.shard) });
    }
    const longTasks = analysis.longTasks.filter(task => task.durMs > 50 && task.atMs < capture.playMs && task.atMs + task.durMs > 0).map(task => {
      const first = task.appLeaf[0], owner = first?.[0]?.replaceAll('src/src/', 'src/') ?? 'unattributed: no app CPU sample in this main-thread task';
      if (!first) missing.push(`${base} task ${task.atMs}ms: app owner unavailable; duration is measured.`);
      return { startMs: Math.max(0, offset + task.atMs), durationMs: task.durMs, owner };
    });
    runs.push({ shard: capture.shard, cache: capture.cache, timeToPlayableMs: end, phases, longTasks });
  }
  return readLoadingReport({ schema: 'loading-benchmark/1', pin, device, runs, missing });
}

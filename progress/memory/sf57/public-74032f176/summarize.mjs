// SF57 summary of a recorded leg: the worker's recorded verdict plus the numbers the receipt quotes, read from the raw
// samples with the worker's own join and phase rule (t = seconds after the first sample) (scripts/soak/owned.mjs, scripts/soak/route.ts). It grades nothing.
// node summarize.mjs <dir> <cells|road>   (reads shipped-<leg>.json and its raw .jsonl, or their .br archives)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { soakDriveBounds, soakPhaseByTime } from '../../../../scripts/soak/route.ts';
import { joinSoakSamples } from '../../../../scripts/soak/owned.mjs';

const [dir, leg = 'cells'] = process.argv.slice(2);
const read = (file) => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : brotliDecompressSync(readFileSync(join(dir, `${file}.br`))).toString('utf8');
const lines = (file) => read(file).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = JSON.parse(read(`shipped-${leg}.json`));
const tagged = joinSoakSamples(lines(`shipped-${leg}-native.jsonl`), lines(`shipped-${leg}-gl.jsonl`), result.gamePid ?? null, lines(`shipped-${leg}-gl-events.jsonl`));
const drive = soakDriveBounds(result);
const samples = soakPhaseByTime(tagged, drive);
const mb = (bytes) => bytes === null || bytes === undefined ? null : Math.round(bytes / 1e5) / 10;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)]; };
const peakOf = (rows) => {
  let best = null;
  for (const row of rows) {
    if (row.type !== 'sample' || row.gl === undefined) continue;
    const wc = Math.max(row.footprint, row.interval ?? row.footprint), value = wc + row.gl.totalBytes;
    if (best === null || value > best.value) best = { value, wc, gl: row.gl.totalBytes, elapsed: row.elapsed, phase: row.phase, cycle: row.gl.cycle };
  }
  return best && { combinedMB: mb(best.value), webContentMB: mb(best.wc), glMB: mb(best.gl), t: Math.round((best.elapsed - (samples[0]?.elapsed ?? 0)) * 10) / 10, phase: best.phase, cycle: best.cycle };
};
const active = samples.filter((row) => /^(baseline|drive|settle)/u.test(row.phase));
const settled = result.windows.map((window, index) => {
  const points = samples.filter((row) => row.type === 'sample' && row.elapsed >= window.start && row.elapsed <= window.end);
  const a = points.filter((row) => (row.gl?.accountedBytes ?? 0) > 0 && row.gl?.settled === true);
  return { stop: `c${index}`, samples: points.length, webContentMB: mb(median(points.map((row) => row.footprint))),
    glMB: mb(median(points.filter((row) => row.gl).map((row) => row.gl.totalBytes))), accountedMB: mb(median(a.map((row) => row.gl.accountedBytes))) };
});
const grade = result.grade;
console.log(JSON.stringify({
  leg, sha: result.sha, purpose: result.purpose, seconds: result.seconds, circuits: result.circuits, failure: result.failure ?? null,
  textures: result.metadata?.textures ?? null, renderScale: result.metadata?.renderScale ?? null, developer: result.metadata?.developer ?? null,
  recorded: { functionalPass: result.functionalPass, memoryPass: grade.memoryPass, gatePass: grade.gatePass, sampling: grade.sampling,
    recovery: grade.recovery, calibration: grade.calibration, leakZero: grade.leakZero, missingGlSamples: grade.missingGlSamples,
    admitted: grade.admitted, refused: grade.refused, crossroads: grade.crossroads, rehearsal: grade.rehearsal, peakMB: mb(grade.peakBytes), loadingPeakMB: mb(grade.loadingPeakBytes) },
  playingPeak: peakOf(active), loadingPeak: peakOf(samples.filter((row) => row.phase === 'loading')),
  ratios: grade.ratios.map((ratio) => ({ cycle: ratio.cycle, adjusted: Math.round(ratio.adjusted * 1000) / 1000 })),
  loops: grade.loops.map((loop) => ({ cycle: loop.cycle, complete: loop.complete, peakMB: mb(loop.peakBytes), troughMB: mb(loop.troughBytes) })),
  baselineDeltaMB: grade.baselineDeltaBytes.map(mb), settled,
  routes: result.routes.length, routeFailures: result.routes.reduce((sum, route) => sum + route.failures.length, 0),
  entries: result.entries.length, evictions: result.evictions.length, errors: result.errors.length, leak: result.leak?.after ? { disposalErrors: result.leak.disposalErrors.length } : null,
}, null, 1));

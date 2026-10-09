// Offline only: the original samples/windows, fixed game PID and unchanged 1.5-second census fence.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { joinSoakSamples } from '../../../../scripts/soak/owned.mjs';

const directory = resolve(process.argv[2] ?? import.meta.dirname);
function read(name) {
  const file = join(directory, name);
  return (existsSync(file) ? readFileSync(file) : brotliDecompressSync(readFileSync(`${file}.br`))).toString();
}
const lines = name => read(name).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const result = JSON.parse(read('dev-cells.json'));
const native = lines('dev-cells-native.jsonl'), gl = lines('dev-cells-gl.jsonl'), events = lines('dev-cells-gl-events.jsonl');
const samples = joinSoakSamples(native, gl, result.gamePid, events);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const components = row => ({ webContentBytes: row.footprint, glBytes: row.gl.totalBytes,
  combinedBytes: row.footprint + row.gl.totalBytes, accountedBytes: row.gl.accountedBytes,
  gpuProcessBytes: row.gpu });
const keys = ['webContentBytes', 'glBytes', 'combinedBytes', 'accountedBytes', 'gpuProcessBytes'];
const settled = result.windows.map(window => {
  const actual = samples.filter(row => row.elapsed >= window.start && row.elapsed <= window.end
    && row.gl !== undefined && row.gl.source === undefined && row.footprint > 0).map(components);
  if (actual.length === 0) return { ...window, samples: 0, error: 'No original census within the existing join fence' };
  return { ...window, samples: actual.length,
    ...Object.fromEntries(keys.map(key => [key, median(actual.map(row => row[key]))])) };
});
const comparison = settled.filter(row => row.cycle >= 2 && row.samples > 0);
function fit(key) {
  if (comparison.length < 2) return null;
  const meanX = comparison.reduce((sum, row) => sum + row.cycle, 0) / comparison.length;
  const meanY = comparison.reduce((sum, row) => sum + row[key], 0) / comparison.length;
  const slope = comparison.reduce((sum, row) => sum + (row.cycle - meanX) * (row[key] - meanY), 0)
    / comparison.reduce((sum, row) => sum + (row.cycle - meanX) ** 2, 0);
  const residual = comparison.reduce((sum, row) => sum + (row[key] - meanY - slope * (row.cycle - meanX)) ** 2, 0);
  const total = comparison.reduce((sum, row) => sum + (row[key] - meanY) ** 2, 0);
  return { points: comparison.length, slopeBytesPerCircuit: slope, rSquared: total === 0 ? null : 1 - residual / total };
}
const first = comparison[0], last = comparison.at(-1);
const growth = first !== undefined && last !== undefined && first !== last ? {
  firstCircuit: first.cycle, lastCircuit: last.cycle,
  deltaBytes: Object.fromEntries(keys.map(key => [key, last[key] - first[key]])),
  averageBytesPerCircuit: Object.fromEntries(keys.map(key => [key, (last[key] - first[key]) / (last.cycle - first.cycle)])),
  fits: Object.fromEntries(keys.map(key => [key, fit(key)])),
} : null;
const deltas = comparison.slice(1).map((row, i) => ({ fromCircuit: comparison[i].cycle, toCircuit: row.cycle,
  ...Object.fromEntries(keys.map(key => [key, row[key] - comparison[i][key]])) }));
const playing = samples.filter(row => /^(drive|settle)/u.test(row.phase) && row.gl !== undefined);
const combined = row => Math.max(row.footprint, row.interval ?? row.footprint) + row.gl.totalBytes;
const peakRow = playing.reduce((best, row) => best === null || combined(row) > combined(best) ? row : best, null);
const peak = peakRow === null ? null : { at: peakRow.elapsed, phase: peakRow.phase, cycle: peakRow.gl.cycle,
  ...components(peakRow), webContentIntervalHighBytes: Math.max(peakRow.footprint, peakRow.interval ?? peakRow.footprint),
  combinedIntervalHighBytes: combined(peakRow), overCapBytes: Math.max(0, combined(peakRow) - 1e9),
  glSource: peakRow.gl.source ?? 'original census', current: peakRow.gl.current ?? null,
  inside: peakRow.gl.inside ?? null, residents: peakRow.gl.residents ?? null };
console.log(JSON.stringify({
  method: 'Original fixed-PID footprint + labelled live GL. Original grader windows, upper median, actual census within unchanged 1.5s fence only for settled values. Complete reconciled journal may supply exact GL at blocked peak timestamps; no interpolation. Independent GPU process never added. Component medians are separate; combined median is computed from paired samples. Bytes are decimal; no VM-map or heap probes.',
  driveStarted: result.driveStarted, partialLastCircuit: result.perLap.some(row => !row.complete),
  pin: result.sha, functionalPass: result.functionalPass, seconds: result.seconds, circuits: result.circuits,
  routes: result.routes.length, routeFailures: result.routes.flatMap(row => row.failures),
  errors: result.errors, failure: result.failure ?? null, grade: result.grade, glSampling: result.glSampling,
  settled, growth, deltas, peak, perLap: result.perLap,
  coverage: 'Developer Driftwood/Pine/Nalati/template subset; full catalogue, road-only and shipped-layout coverage remain open. Simulator image fallback changes GL versus earlier KTX2 cohorts; no isolated causal credit.',
}, null, 2));

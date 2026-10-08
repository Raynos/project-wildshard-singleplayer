// SF50-g: regrade the original same-pose native/GL evidence, including every failed cold attempt.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const root = import.meta.dirname;
const read = path => JSON.parse(gunzipSync(readFileSync(join(root, path))).toString('utf8'));
const phases = ['home-settled', 'sun-road', 'sun-entry', 'sun-spawn', 'sun-road-return', 'sun-reentry'];
const spread = values => ({ median: values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)], min: Math.min(...values), max: Math.max(...values) });
const attempts = readdirSync(join(root, 'native')).filter(name => /^cold-\d+\.json\.gz$/u.test(name)).sort().map(name => {
  const data = read(`native/${name}`), errors = [];
  if (data.failure) errors.push(data.failure);
  if (!data.closed || data.routeMode !== 'sun-entry' || data.memorySaver !== 'on' || !data.developer) errors.push('Incomplete run or wrong mode/settings');
  if (!data.version?.build.startsWith('7b04a71-') || data.identity?.build !== data.version.build || data.identity?.tier !== 'phone') errors.push('Wrong source build or tier');
  if (data.recoveries?.length !== 0 || JSON.parse(data.errors ?? 'null')?.length !== 0) errors.push('Missing clean error/recovery fence');
  if (data.routes.length !== 4 || data.routes.some(route => gridFloorWitnessFailures(route).length !== 0)) errors.push('Incomplete actual-frame route witnesses');
  const readings = Object.fromEntries(phases.map(label => {
    const row = data.snapshots.find(row => row.label === label);
    if (!row) { errors.push(`Missing ${label}`); return [label, null]; }
    const samples = row.native.samples, contexts = row.census.gl, glBytes = contexts.reduce((sum, context) => sum + context.totalBytes, 0);
    if (samples.length !== 3 || new Set(samples.map(sample => sample.at)).size !== 3 || samples.some(sample => sample.pid !== data.gamePID || sample.footprintBytes <= 0)) errors.push(`Missing independent fixed-PID samples at ${label}`);
    if (contexts.length === 0 || glBytes <= 0 || !contexts.every(context => context.reconciled) || contexts.flatMap(context => context.resources).some(resource => !resource.labelled && resource.bytes > 0)) errors.push(`Invalid labelled GL at ${label}`);
    const wc = spread(samples.map(sample => sample.footprintBytes));
    if (wc.median !== row.native.medianBytes || wc.max !== row.native.maxBytes) errors.push(`Native median/header mismatch at ${label}`);
    return [label, { webContentBytes: wc.median, labelledGLBytes: glBytes, combinedBytes: wc.median + glBytes, highSampleCombinedBytes: wc.max + glBytes,
      modelPlayingBytes: row.residency.cost.playing, accountedBytes: row.residency.cost.accounted }];
  }));
  if (!data.leak || JSON.stringify(data.leak.before) !== JSON.stringify(data.leak.after) || data.leak.disposalErrors.length !== 0 || Object.values(data.leak.scope).some(count => count !== 0)) errors.push('Exact final unload fence failed');
  if (data.unloadedSamples?.length !== 3 || new Set(data.unloadedSamples.map(sample => sample.at)).size !== 3 || data.unloadedSamples.some(sample => sample.pid !== data.gamePID)) errors.push('Missing fixed-PID unloaded samples');
  return { path: `native/${name}`, valid: errors.length === 0, errors, gamePID: data.gamePID, edge: data.sunEntry?.edge, readings };
});
const valid = attempts.filter(attempt => attempt.valid);
if (valid.length < 3) throw new Error(`Need at least three valid cold runs; ${valid.length}/${attempts.length} valid`);
const samples = Object.fromEntries(phases.map(label => [label, Object.fromEntries(['webContentBytes', 'labelledGLBytes', 'combinedBytes', 'highSampleCombinedBytes', 'modelPlayingBytes', 'accountedBytes'].map(key => [key, spread(valid.map(attempt => attempt.readings[label][key]))]))]));
const entered = ['sun-entry', 'sun-spawn', 'sun-reentry'];
const worstEnteredHighSampleBytes = Math.max(...entered.map(label => samples[label].highSampleCombinedBytes.max));
const summary = { source: '7b04a71009de93f059c8208d101f18e2c55ceeed', settings: { developer: true, tier: 'phone', renderScale: 2, tex: 'auto', memorySaver: 'on' },
  coverage: { attempts: attempts.length, validColdRuns: valid.length, failures: attempts.length - valid.length, edge: 'north', authoredSpawn: [0, 70], actualFrameRoutesPerRun: 4 },
  limitation: 'iOS Simulator Safari, same-pose kernel WebContent + labelled live GL at settled stops. No physical-iPhone, continuous combined loading/travel peak, frame-floor or all-edge native claim.',
  samples, worstEnteredHighSampleBytes, withinExplorerCapAtSampledEnteredStops: worstEnteredHighSampleBytes <= 1e9, attempts };
writeFileSync(join(root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ coverage: summary.coverage, samples, worstEnteredHighSampleBytes, withinExplorerCapAtSampledEnteredStops: summary.withinExplorerCapAtSampledEnteredStops }, null, 2));

#!/usr/bin/env node
// SF50 / SF22a: same cold standalone ruler, with failed attempts retained and peaks distinct from medians.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
const root = import.meta.dirname;
const sha = '744cf67ef347bd635ae8126cb80d5355a77fec85';
const read = path => path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString('utf8') : readFileSync(path, 'utf8');
const jsonl = path => read(path).split('\n').filter(Boolean).map(line => JSON.parse(line));
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const spread = values => ({ median: median(values), min: Math.min(...values), max: Math.max(...values) });
const attempts = files(join(root, 'simulator')).filter(path => /\.inspector\.jsonl(?:\.gz)?$/.test(path)).sort().map(path => {
  const rows = jsonl(path), result = rows.find(row => row.kind === 'summary')?.result;
  const nativePath = path.replace('.inspector.', '.native.');
  const native = existsSync(nativePath) ? jsonl(nativePath).find(row => row.type === 'summary') : null;
  const phases = Object.fromEntries(['loading', 'play', 'explorer'].map(phase => {
    const reading = rows.find(row => row.kind === 'settled' && row.phase === phase)?.result;
    return [phase, reading && native?.phases?.[phase] ? {
      nativeMB: reading.nativeGB * 1000, inspectorMB: reading.inspectorGB * 1000,
      nativePeakMB: native.phases[phase].gameHighGB * 1000,
      nativePeakUpperMB: native.phases[phase].gameHighGB * 1000 + 0.5,
      nativeSpreadMB: [reading.minGB * 1000, reading.maxGB * 1000],
    } : null];
  }));
  const errors = [result?.error, !native && 'missing native summary', !result && 'missing Inspector summary',
    native?.lost?.length > 0 && 'WebContent PID lost', Object.values(phases).some(value => value === null) && 'missing settled phase',
    result?.identity?.build?.startsWith('744cf67-') !== true && 'wrong source build',
    result?.identity?.shard !== 'sunscar-dunes' && 'wrong shard',
    result?.settings?.tex !== 'auto' && 'wrong texture setting', result?.settings?.memorySaver !== 'on' && 'wrong Memory saver setting'].filter(Boolean);
  return { path: relative(root, path), valid: errors.length === 0, errors, identity: result?.identity, explorerIdentity: result?.explorerIdentity, phases };
});
const valid = attempts.filter(row => row.valid);
if (valid.length < 3) throw new Error(`Need three valid cold runs; ${valid.length}/${attempts.length} valid`);
const gl = JSON.parse(read(join(root, 'gl/summary.json')));
if (gl.length !== 3 || gl.some(row => row.slug !== 'sunscar-dunes' || row.errors.length !== 0 || !row.version.build.startsWith('744cf67-'))) throw new Error('Need three same-source labelled GL runs');
const phases = Object.fromEntries(['loading', 'play', 'explorer'].map(phase => [phase, {
  nativeMB: spread(valid.map(row => row.phases[phase].nativeMB)),
  inspectorMB: spread(valid.map(row => row.phases[phase].inspectorMB)),
  nativePeakMB: Math.max(...valid.map(row => row.phases[phase].nativePeakMB)),
  ...(phase === 'loading' ? {} : { glMB: spread(gl.map(row => row.phases.find(sample => sample.phase === phase).maxBytes / 1e6)),
    conservativePeakCombinedMB: Math.max(...valid.map(row => row.phases[phase].nativePeakUpperMB)) + Math.max(...gl.map(row => row.phases.find(sample => sample.phase === phase).maxBytes / 1e6)) }),
}]));
const runtimeCost = { webContentMB: phases.play.nativeMB.median, glMB: phases.play.glMB.median, engineBaseMB: 299, rev: sha,
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census', evidence: 'progress/memory/sf50-sun-runtime-744cf67ef/summary.json' };
const accountedBytes = Math.ceil((runtimeCost.webContentMB + runtimeCost.glMB - runtimeCost.engineBaseMB) * 1e6 / 1.11);
if (!Number.isSafeInteger(accountedBytes) || accountedBytes <= 0) throw new Error('Invalid measured home bound');
const summary = { sha, settings: { tex: 'auto', memorySaver: 'on', developer: true }, coverage: { validColdRuns: valid.length, attempts: attempts.length,
  failures: attempts.length - valid.length, playSeconds: 30, explorerSeconds: 30, enteredGrid: false },
  calibration: { engineBaseMB: 299, evidence: 'progress/memory/sf22a-2026-10-04.json', remeasured: false },
  limitation: 'Standalone Simulator regression ruler plus same-source Chromium phone-tier labelled GL proxy; no physical-iPhone or entered-grid cap claim.',
  attempts, phases, runtimeCost, accountedBytes, playingAdmissionMB: (300e6 + 80e6 + Math.ceil(1.11 * accountedBytes)) / 1e6 };
writeFileSync(join(root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ phases, runtimeCost, accountedBytes, playingAdmissionMB: summary.playingAdmissionMB }, null, 2));

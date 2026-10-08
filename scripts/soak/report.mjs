#!/usr/bin/env node
// Regrade recorded evidence without replacing missing readings or altering the original worker receipts.
import { readFileSync, mkdirSync, writeFileSync, createReadStream, createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createBrotliCompress, constants as compression } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { gradeSoak } from './route.ts';
import { joinSoakSamples, soakLapMemory } from './owned.mjs';

const flag = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const from = flag('from'), out = flag('out');
if (!from || !out) throw new Error('Supply --from=<recorded-run> --out=<new-evidence-directory>');
mkdirSync(out, { recursive: true });
const summary = { purpose: 'REHEARSAL; incomplete M3 and sampling, cannot close SF57 or establish retained WebKit memory',
  engineBase: 300_000_000, formula: '1.01 <= (WebContent + labelled GL - engineBase) / accounted <= 1.21; raw ratio informational',
  graderRevision: execFileSync('git', ['log', '-1', '--format=%H', '--', 'scripts/soak/route.ts'], { encoding: 'utf8' }).trim(),
  layouts: [], missingReceipts: [] };
const runs = [];
for (const layout of ['shipped', 'dev']) {
  const modern = ['cells', 'road'].some((leg) => existsSync(join(from, `${layout}-${leg}.json`)));
  if (modern) for (const leg of ['cells', 'road']) {
    const name = `${layout}-${leg}`;
    if (existsSync(join(from, `${name}.json`))) runs.push({ layout, leg, name });
    else summary.missingReceipts.push(`${name}.json`);
  }
  else if (existsSync(join(from, `${layout}.json`))) {
    runs.push({ layout, leg: 'cells', name: layout });
    summary.missingReceipts.push(`${layout}-road.json`);
  }
}
if (runs.length === 0) throw new Error('No continuous soak receipts found');
for (const { layout, leg, name } of runs) {
  const originalText = readFileSync(join(from, `${name}.json`), 'utf8'), original = JSON.parse(originalText);
  if (original.leg !== undefined && original.leg !== leg) throw new Error(`Receipt leg mismatch: ${name}`);
  writeFileSync(join(out, `${name}-original.json`), originalText);
  const rawNative = readFileSync(join(from, `${name}-native.jsonl`), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  // Keep full labelled allocation groups in the compressed raw log; joins need only scalar telemetry.
  const gl = readFileSync(join(from, `${name}-gl.jsonl`), 'utf8').trim().split('\n').filter(Boolean).map((line) => {
    const row = JSON.parse(line); delete row.assets; return row;
  });
  const eventsName = `${name}-gl-events.jsonl`;
  const loadingEvents = existsSync(join(from, eventsName)) ? readFileSync(join(from, eventsName), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const native = joinSoakSamples(rawNative, gl, original.gamePid ?? null, loadingEvents);
  const missing = [], csv = ['seconds,phase,webContentBytes,intervalHighBytes,glBytes,accountedBytes,gpuProcessBytes,allWebContentBytes'];
  const samples = native.filter((row) => row.type === 'sample').map((row) => {
    row.elapsed = Date.parse(row.t) / 1000;
    if (row.gl === undefined) missing.push({ phase: row.phase, t: row.t, nearestGlSeconds: gl.length === 0 ? null : Math.min(...gl.map(point => Math.abs(point.at - row.elapsed))) });
    csv.push([row.elapsed - Date.parse(original.driveStarted) / 1000, row.phase, row.footprint, row.interval, row.gl?.totalBytes ?? '', row.gl?.accountedBytes ?? '', row.gpu, row.allWebContentBytes ?? ''].join(','));
    return row;
  });
  const grade = gradeSoak({ samples, windows: original.windows, seconds: original.seconds, circuits: original.circuits,
    evictions: original.evictions.length, errors: original.errors, leak: original.leak,
    expected: original.expected, entries: original.entries, crossroads: original.crossroads, engineBase: summary.engineBase, rehearsal: true, leg });
  const artifacts = [];
  for (const suffix of ['native.jsonl', 'gl.jsonl', ...(loadingEvents.length > 0 ? ['gl-events.jsonl'] : [])]) {
    const file = `${name}-${suffix}`, bytes = readFileSync(join(from, file));
    await pipeline(createReadStream(join(from, file)), createBrotliCompress({ params: { [compression.BROTLI_PARAM_QUALITY]: 6, [compression.BROTLI_PARAM_LGWIN]: 24 } }), createWriteStream(join(out, `${file}.br`)));
    artifacts.push({ file: `${file}.br`, rawBytes: bytes.length, rawSha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeFileSync(join(out, `${name}.csv`), `${csv.join('\n')}\n`);
  summary.layouts.push({ layout, leg, sha: original.sha, gamePid: original.gamePid ?? null, perLap: soakLapMemory(samples, original.circuits), seconds: original.seconds, circuits: original.circuits,
    evictions: original.evictions.length, grade, missing, artifacts,
    originalReceipt: `${name}-original.json`, errors: original.errors, nativeSummary: original.nativeSummary,
    attribution: 'No heap snapshots / Rapier memory readings were captured. Refusals, missing GL readings and unaccounted transitional home prevent a WebKit-retention attribution.' });
  console.log(JSON.stringify({ layout, leg, ...grade, missing: missing.length }));
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

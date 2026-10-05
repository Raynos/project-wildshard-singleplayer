#!/usr/bin/env node
// Regrade recorded evidence without replacing missing readings or altering the original worker receipts.
import { readFileSync, mkdirSync, writeFileSync, createReadStream, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createBrotliCompress, constants as compression } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { gradeSoak } from './route.ts';

const flag = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const from = flag('from'), out = flag('out');
if (!from || !out) throw new Error('Supply --from=<recorded-run> --out=<new-evidence-directory>');
mkdirSync(out, { recursive: true });
const summary = { purpose: 'REHEARSAL; incomplete M3 and sampling, cannot close SF57 or establish retained WebKit memory',
  engineBase: 300_000_000, formula: '1.01 <= (WebContent + labelled GL - engineBase) / accounted <= 1.21; raw ratio informational',
  graderRevision: execFileSync('git', ['log', '-1', '--format=%H', '--', 'scripts/soak/route.ts'], { encoding: 'utf8' }).trim(),
  layouts: [] };
for (const layout of ['shipped', 'dev']) {
  const originalText = readFileSync(join(from, `${layout}.json`), 'utf8'), original = JSON.parse(originalText);
  writeFileSync(join(out, `${layout}-original.json`), originalText);
  const native = readFileSync(join(from, `${layout}-native.jsonl`), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  // Keep full labelled allocation groups in the compressed raw log; joins need only scalar telemetry.
  const gl = readFileSync(join(from, `${layout}-gl.jsonl`), 'utf8').trim().split('\n').map((line) => {
    const row = JSON.parse(line); delete row.assets; return row;
  });
  let cursor = 0;
  const missing = [], csv = ['seconds,phase,webContentBytes,intervalHighBytes,glBytes,accountedBytes,gpuProcessBytes'];
  const samples = native.filter((row) => row.type === 'sample').map((row) => {
    row.elapsed = Date.parse(row.t) / 1000;
    while (cursor + 1 < gl.length && gl[cursor + 1].at < row.elapsed) cursor++;
    const left = gl[cursor], right = gl[cursor + 1];
    const nearest = right && Math.abs(right.at - row.elapsed) < Math.abs(left.at - row.elapsed) ? right : left;
    const gap = Math.abs(nearest.at - row.elapsed);
    if (gap <= 1.5) row.gl = nearest;
    else missing.push({ phase: row.phase, t: row.t, nearestGlSeconds: gap });
    csv.push([row.elapsed - Date.parse(original.driveStarted) / 1000, row.phase, row.footprint, row.interval, row.gl?.totalBytes ?? '', row.gl?.accountedBytes ?? '', row.gpu].join(','));
    return row;
  });
  const grade = gradeSoak({ samples, windows: original.windows, seconds: original.seconds, circuits: original.circuits,
    evictions: original.evictions.length, errors: original.errors, leak: original.leak,
    expected: original.expected, entries: original.entries, crossroads: original.crossroads, engineBase: summary.engineBase, rehearsal: true });
  const artifacts = [];
  for (const suffix of ['native.jsonl', 'gl.jsonl']) {
    const file = `${layout}-${suffix}`, bytes = readFileSync(join(from, file));
    await pipeline(createReadStream(join(from, file)), createBrotliCompress({ params: { [compression.BROTLI_PARAM_QUALITY]: 6, [compression.BROTLI_PARAM_LGWIN]: 24 } }), createWriteStream(join(out, `${file}.br`)));
    artifacts.push({ file: `${file}.br`, rawBytes: bytes.length, rawSha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeFileSync(join(out, `${layout}.csv`), `${csv.join('\n')}\n`);
  summary.layouts.push({ layout, sha: original.sha, seconds: original.seconds, circuits: original.circuits,
    evictions: original.evictions.length, grade, missing, artifacts,
    originalReceipt: `${layout}-original.json`, errors: original.errors, nativeSummary: original.nativeSummary,
    attribution: 'No heap snapshots / Rapier memory readings were captured. Refusals, missing GL readings and unaccounted transitional home prevent a WebKit-retention attribution.' });
  console.log(JSON.stringify({ layout, ...grade, missing: missing.length }));
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

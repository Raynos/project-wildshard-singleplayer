// Extends ../effort-recount-2026-10-09/history.mjs: re-measure every shard at historical commits with TODAY's ruler
// (G458 source-basis custom lines, measure.mjs), in the shared build-mirror `check` slot instead of git-archive exports
// (MACHINE.md: no exports). Resumable: commits already in the output file are reused, never re-measured.
//   node progress/shard-platform/custom-vs-hours-2026-10-16/history.mjs <out.json> <iso,iso,…>
// A commit whose tree today's ruler cannot read is recorded with its error, never as a number.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '../../..');
const MEASURE = resolve(import.meta.dirname, 'measure.mjs');
const [out, list] = process.argv.slice(2);
if (!out || !list) throw new Error('usage: history.mjs <out.json> <iso,iso,…>');
/** @type {{t:string;sha:string;shards?:Record<string,{custom:number;legacy:number|null}>;error?:string}[]} */
const results = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
const bySha = new Map(results.map((r) => [r.sha, r]));
for (const iso of list.split(',')) {
  if (results.some((r) => r.t === iso)) continue;
  const sha = execFileSync('git', ['-C', REPO, 'rev-list', '-1', '--first-parent', `--before=${iso}`, 'main']).toString().trim();
  const known = bySha.get(sha);
  if (known) { results.push({ ...known, t: iso }); continue; }
  const run = spawnSync(process.execPath, [resolve(REPO, 'scripts/build-mirror.mjs'), 'run', sha, '--slot', 'check', '--', process.execPath, MEASURE],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  const line = run.stdout.split('\n').find((l) => l.startsWith('{'));
  const row = line ? { t: iso, sha, shards: JSON.parse(line) } : { t: iso, sha, error: (run.stderr || run.stdout).trim().split('\n').slice(-3).join(' | ').slice(0, 400) };
  results.push(row);
  bySha.set(sha, row);
  console.log(iso, sha.slice(0, 9), row.error ? `ERR ${row.error}` : Object.entries(row.shards ?? {}).map(([s, r]) => `${s.slice(0, 6)}=${r.custom}`).join(' '));
  writeFileSync(out, JSON.stringify(results));
}
writeFileSync(out, JSON.stringify(results.sort((a, b) => (a.t < b.t ? -1 : 1))));

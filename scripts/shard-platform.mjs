#!/usr/bin/env node
// SHARD-PLATFORM SP5: the 80/20 metric. Every shard's TypeScript is sorted by folder: `generators/` (bake time, never
// shipped) and `data/` (serialisable rows) are the data side; everything else ships as runtime code. The custom share
// is the runtime lines ÷ the shard's baseline (its lines when SP5 landed, lint/shard-platform.json). The target is
// ≤ 20 % (docs/plans/SHARD-PLATFORM.md §1).
// Before a shard's conversion (SP22–SP28) the share is only reported: every line is still unsorted, and a ceiling
// would block the shard's own work. A converted shard joins `enforced` with its runtime-line ceiling, which only falls.
//   node scripts/shard-platform.mjs           print the table
//   node scripts/shard-platform.mjs --check   fail when an enforced shard's runtime lines pass its ceiling, or a
//                                             baseline / ceiling names a shard folder that doesn't exist
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const LIST = 'lint/shard-platform.json';
const DATA_SIDE = new Set(['generators', 'data']);

const linesOf = (path) => readFileSync(path, 'utf8').split('\n').length - 1;
function tsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (/\.tsx?$/u.test(name) && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

/** per shard folder: lines on the data side (generators, data) and the runtime side (everything else) */
export function shardLines(root = ROOT) {
  const shards = resolve(root, 'src/shards');
  const out = {};
  for (const slug of readdirSync(shards).sort((a, b) => a.localeCompare(b))) {
    const dir = join(shards, slug);
    if (!statSync(dir).isDirectory()) continue;
    const row = { generators: 0, data: 0, runtime: 0 };
    for (const file of tsFiles(dir)) {
      const top = file.slice(dir.length + 1).split('/')[0];
      row[DATA_SIDE.has(top) ? top : 'runtime'] += linesOf(file);
    }
    out[slug] = row;
  }
  return out;
}

/** failures: an enforced shard over its ceiling, or a recorded slug with no folder */
export function checkShares(recorded, lines) {
  const failures = [];
  for (const slug of [...Object.keys(recorded.baseline), ...Object.keys(recorded.enforced)]) if (!lines[slug]) failures.push(`${slug} is recorded in ${LIST} but src/shards/${slug} doesn't exist`);
  for (const [slug, ceiling] of Object.entries(recorded.enforced)) {
    const runtime = lines[slug]?.runtime ?? 0;
    if (runtime > ceiling) failures.push(`${slug}: ${runtime} runtime lines, ceiling ${ceiling}: new code goes in data/ or onto an approved system`);
  }
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const recorded = JSON.parse(readFileSync(resolve(ROOT, LIST), 'utf8'));
  const lines = shardLines();
  console.log('shard                  baseline   runtime  generators    data   custom share');
  for (const [slug, row] of Object.entries(lines)) {
    const base = recorded.baseline[slug];
    const share = base ? `${((row.runtime / base) * 100).toFixed(0)} %` : 'no baseline';
    const mark = slug in recorded.enforced ? `  (ceiling ${recorded.enforced[slug]})` : '';
    console.log(`${slug.padEnd(22)} ${String(base ?? '-').padStart(8)} ${String(row.runtime).padStart(9)} ${String(row.generators).padStart(11)} ${String(row.data).padStart(7)}   ${share}${mark}`);
  }
  if (process.argv[2] === '--check') {
    const failures = checkShares(recorded, lines);
    for (const f of failures) console.error(`shard-platform: ${f}`);
    if (failures.length > 0) process.exit(1);
  }
}

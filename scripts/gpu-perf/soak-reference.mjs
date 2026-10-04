#!/usr/bin/env node
// E388: record clean-build soaks as a shard's soak reference (budgets/soak-reference.json). report.mjs soakLimits
// derives each growth limit from them (the runs' median + 2 × their spread); nothing else sets a soak limit.
//
//   node scripts/gpu-perf/soak-reference.mjs <soak report.json> [<soak report.json> …]
//
// Each report is one `scripts/soak.mjs` run on a clean build (no plant). A shard named by the given reports gets
// exactly those runs as its reference; other shards keep theirs. Record the parity harness's three runs per shard.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SOAK_GROWTHS } from './report.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const file = join(root, 'budgets/soak-reference.json');
const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error('usage: soak-reference.mjs <soak report.json>…');
/** @type {Record<string, Record<string, number | string>[]>} */
const references = JSON.parse(readFileSync(file, 'utf8'));
/** @type {Map<string, Record<string, number | string>[]>} */
const fresh = new Map();
for (const path of paths) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  // A reference run is clean: no page errors, no stuck state, a complete 5–20 minute window.
  if (typeof report.shard !== 'string' || report.shard === '') throw new Error(`${path}: no shard`);
  if ((report.errors ?? []).length > 0 || (report.stuck ?? []).length > 0) throw new Error(`${path}: not a clean soak (errors or stuck states)`);
  /** @type {Record<string, number | string>} */
  const row = { sha: String(report.sha ?? ''), recorded: new Date().toISOString() };
  for (const key of SOAK_GROWTHS) {
    const value = report[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path}: ${key} missing (incomplete window)`);
    row[key] = value;
  }
  fresh.set(report.shard, [...fresh.get(report.shard) ?? [], row]);
}
Object.assign(references, Object.fromEntries(fresh));
writeFileSync(file, `${JSON.stringify(references, null, 2)}\n`);
for (const [shard, runs] of fresh) console.log(`soak reference: ${shard} ← ${runs.length} run(s)`);

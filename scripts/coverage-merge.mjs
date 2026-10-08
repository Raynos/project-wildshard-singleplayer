#!/usr/bin/env node
// E429: push CI runs vitest in shards (6 since E454; deploy.yml `vitest`); each writes istanbul's coverage-final.json. This merges
// them into the json-summary that scripts/coverage-ratchet.mjs reads, measuring what ONE unsharded run measures:
// - a file a shard ran is the sum of the shards that ran it (their statement maps are identical);
// - a shard that never loaded a file adds it as an all-zero "untested" entry, which an unsharded run leaves out when any
//   test loaded the file. So a loaded entry wins over the untested one, including a loaded entry with an empty map (a
//   module only ever loaded mocked comes out empty; vitest's own --merge-reports counted those, 7 points lower).
//
//   node scripts/coverage-merge.mjs --out coverage/coverage-summary.json shard-1.json shard-2.json shard-3.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ start: { line: number } }} Loc
 * @typedef {{
 *   statementMap: Record<string, Loc | undefined>, s: Record<string, number>,
 *   fnMap: Record<string, unknown>, f: Record<string, number>,
 *   branchMap: Record<string, unknown>, b: Record<string, number[]>,
 * }} FileCoverage
 * @typedef {{ total: number, covered: number, skipped: number, pct: number }} Metric
 * @typedef {{ lines: Metric, statements: Metric, functions: Metric, branches: Metric }} Summary
 */

/** istanbul's percent: floored to 2 decimals, 100 for an empty total */
function percent(covered, total) {
  return total > 0 ? Math.floor((1e5 * covered) / total / 10) / 100 : 100;
}

/** @param {FileCoverage} fc */
const hits = (fc) => Object.values(fc.s).some((n) => n > 0) || Object.values(fc.f).some((n) => n > 0);
/** @param {FileCoverage} fc */
const empty = (fc) => Object.keys(fc.statementMap).length === 0 && Object.keys(fc.fnMap).length === 0 && Object.keys(fc.branchMap).length === 0;
/** @param {FileCoverage} fc */
const shape = (fc) => JSON.stringify([fc.statementMap, fc.fnMap, fc.branchMap]);

/**
 * pick and sum one file's entries the way an unsharded run would see them
 * @param {string} file @param {FileCoverage[]} entries @returns {FileCoverage}
 */
export function mergeFile(file, entries) {
  const first = entries.at(0);
  if (!first) throw new Error(`${file}: no entries`);
  const ran = entries.filter(hits);
  // no shard ran it: an empty (loaded) entry beats the untested ones, as in one run; else every entry is the same zero map
  const use = ran.length > 0 ? ran : [entries.find(empty) ?? first];
  const base = use.at(0) ?? first;
  /** @type {FileCoverage} */
  const out = structuredClone(base);
  for (const fc of use.slice(1)) {
    if (shape(fc) !== shape(base)) throw new Error(`${file}: shards ran it with different statement maps`);
    for (const k of Object.keys(out.s)) out.s[k] = (out.s[k] ?? 0) + (fc.s[k] ?? 0);
    for (const k of Object.keys(out.f)) out.f[k] = (out.f[k] ?? 0) + (fc.f[k] ?? 0);
    for (const k of Object.keys(out.b)) out.b[k] = (out.b[k] ?? []).map((n, i) => n + (fc.b[k]?.[i] ?? 0));
  }
  return out;
}

/** @param {number[]} counts @returns {Metric} */
function metric(counts) {
  const covered = counts.filter((n) => n > 0).length;
  return { total: counts.length, covered, skipped: 0, pct: percent(covered, counts.length) };
}

/** @param {FileCoverage} fc @returns {Summary} */
function summarize(fc) {
  /** @type {Map<number, number>} */
  const lines = new Map();
  for (const [k, n] of Object.entries(fc.s)) {
    const loc = fc.statementMap[k];
    if (!loc) continue;
    const prev = lines.get(loc.start.line);
    if (prev === undefined || prev < n) lines.set(loc.start.line, n);
  }
  return {
    lines: metric([...lines.values()]),
    statements: metric(Object.values(fc.s)),
    functions: metric(Object.values(fc.f)),
    branches: metric(Object.values(fc.b).flat()),
  };
}

/** @param {Record<string, FileCoverage>[]} shards @returns {{ total: Summary } & Record<string, Summary>} */
export function mergeShards(shards) {
  /** @type {Map<string, FileCoverage[]>} */
  const byFile = new Map();
  for (const shard of shards) for (const [file, fc] of Object.entries(shard)) byFile.set(file, [...(byFile.get(file) ?? []), fc]);
  /** @type {Record<string, Summary>} */
  const files = {};
  const blank = () => ({ total: 0, covered: 0, skipped: 0, pct: 0 });
  /** @type {Summary} */
  const total = { lines: blank(), statements: blank(), functions: blank(), branches: blank() };
  for (const file of [...byFile.keys()].sort()) {
    const s = summarize(mergeFile(file, byFile.get(file) ?? []));
    files[file] = s;
    for (const key of /** @type {const} */ (['lines', 'statements', 'functions', 'branches'])) {
      total[key].total += s[key].total;
      total[key].covered += s[key].covered;
    }
  }
  for (const m of Object.values(total)) m.pct = percent(m.covered, m.total);
  return { total, ...files };
}

/** @param {string[]} args */
export function main(args = process.argv.slice(2)) {
  const at = args.indexOf('--out');
  const out = at === -1 ? undefined : args[at + 1];
  const inputs = args.filter((_, i) => i !== at && i !== at + 1);
  if (!out || inputs.length === 0) throw new Error('usage: coverage-merge.mjs --out <summary.json> <coverage-final.json>…');
  const summary = mergeShards(inputs.map((p) => JSON.parse(readFileSync(resolve(p), 'utf8'))));
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(summary)}\n`);
  const t = summary.total;
  console.info(`Merged ${inputs.length} shards: lines ${t.lines.pct}, statements ${t.statements.pct}, functions ${t.functions.pct}, branches ${t.branches.pct}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(`coverage-merge: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

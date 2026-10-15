#!/usr/bin/env node
// The push gate's test selection (Jake, 2026-10-15): the test files that import the changed sources (`vitest related`),
// capped so the test phase stays near 45 s; the full suite runs in CI on every push (the `behaviour` job), fix-forward.
//   node scripts/gate-related-tests.mjs <changed.json> [--budget=<seconds>]   prints a JSON array of test files
// Vitest walks every test file's import graph backwards from the changed files. A change that touches a widely
// imported module (or a forceRerunTrigger such as package.json, which relates every test) can relate most of the suite:
// then the files named after a changed source run first, and the rest go cheapest first (each file's last duration from
// Vitest's results cache, `node_modules/.vite/vitest`, plus its module load) while the estimated wall time (their sum over
// WS_VITEST_MAX_WORKERS, plus Vitest's startup) stays within `--budget` (45 s). What is left over is printed to stderr
// and runs in CI. A changed test file always runs. Today the whole suite (~115 files) estimates under the budget at the
// gate's 4 workers, so the cap only bites once the suite grows.
import { existsSync, readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { createVitest } from 'vitest/node';

// The tree under test is the working directory (the gate runs the checkout's copy of this script in the build mirror).
const ROOT = process.cwd();
// Vitest keys its results cache by sha1 of the project name; the root config has none (sha1 of '').
const RESULTS = resolve(ROOT, 'node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json');
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
// vitest.config.ts `include`.
const INCLUDED = /^(?:admin\/|drafts\/)?test\/.+\.test\.ts$/u;
// Measured in the gate mirror (2026-10-15): the 115-file suite's module loads add ~0.5 s a file to the cached test
// durations, and Vitest's startup with the import-graph walk takes ~5 s.
const LOAD_SECONDS = 0.5;
const STARTUP_SECONDS = 5;

/** Last known duration in seconds per test file (relative path), from Vitest's results cache.
 * @returns {Map<string, number>} */
function knownDurations() {
  /** @type {Map<string, number>} */
  const durations = new Map();
  if (!existsSync(RESULTS)) return durations;
  try {
    /** @type {{ results?: [string, { duration?: number }][] }} */
    const cache = JSON.parse(readFileSync(RESULTS, 'utf8'));
    // Keys are `<project>:<file>`; the root config's project has no name. A failed load records 0 (no estimate).
    for (const [key, result] of cache.results ?? []) {
      if (key.startsWith(':') && typeof result.duration === 'number' && result.duration > 0) durations.set(key.slice(1), result.duration / 1000);
    }
  } catch { /* an unreadable cache only loses the estimates */ }
  return durations;
}

/** The stem a test file or source is named by: `coverGrid.test.ts` and `coverGrid.ts` both give `covergrid`.
 * @param {string} path */
function stem(path) {
  return basename(path).replace(TEST_FILE, '').replace(/\.d?\.?[cm]?[jt]sx?$/u, '').replaceAll(/[-_.]/gu, '').toLowerCase();
}

/**
 * Pick the related test files to run within `seconds` of estimated wall time on `workers` workers.
 * @param {string[]} related every related test file (relative paths)
 * @param {string[]} changed the changed files (relative paths)
 * @param {Map<string, number>} durations last test seconds per file
 * @param {number} seconds wall-time budget
 * @param {number} workers
 * @returns {{ run: string[], left: string[] }}
 */
export function capRelated(related, changed, durations, seconds, workers) {
  const known = [...durations.values()].sort((a, b) => a - b);
  const typical = known.length > 0 ? (known[Math.floor(known.length / 2)] ?? 1) : 1;
  const cost = (/** @type {string} */ file) => (durations.get(file) ?? typical) + LOAD_SECONDS;
  const budget = Math.max(0, seconds - STARTUP_SECONDS) * workers;
  const stems = new Set(changed.map(stem));
  const own = changed.filter((file) => INCLUDED.test(file) && !related.includes(file));
  const named = [...own, ...related.filter((file) => changed.includes(file) || stems.has(stem(file)))];
  const rest = related.filter((file) => !named.includes(file)).sort((a, b) => cost(a) - cost(b) || a.localeCompare(b));
  const run = [...named];
  let spent = named.reduce((sum, file) => sum + cost(file), 0);
  const left = [];
  for (const file of rest) {
    if (spent + cost(file) <= budget) { run.push(file); spent += cost(file); } else left.push(file);
  }
  return { run: run.sort((a, b) => a.localeCompare(b)), left };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === import.meta.filename;
if (isMain) {
  const listFile = process.argv[2];
  if (!listFile) { console.error('usage: gate-related-tests.mjs <changed.json> [--budget=<seconds>]'); process.exit(2); }
  /** @type {string[]} */
  const changed = JSON.parse(readFileSync(listFile, 'utf8'));
  const budgetArg = process.argv.find((arg) => arg.startsWith('--budget='));
  const seconds = budgetArg === undefined ? 45 : Number(budgetArg.slice('--budget='.length));
  const workers = Number(process.env.WS_VITEST_MAX_WORKERS ?? '6') || 6;
  const started = performance.now();
  const sources = changed.filter((file) => existsSync(resolve(ROOT, file)));
  /** @type {string[]} */
  let related = [];
  if (sources.length > 0) {
    const vitest = await createVitest({ root: ROOT, related: sources.map((file) => resolve(ROOT, file)), run: true, watch: false },
      { logLevel: 'silent' });
    try {
      const specs = await vitest.getRelevantTestSpecifications();
      related = [...new Set(specs.map((spec) => relative(ROOT, spec.moduleId)))];
    } finally { await vitest.close(); }
  }
  const { run, left } = capRelated(related, sources, knownDurations(), seconds, workers);
  const walk = ((performance.now() - started) / 1000).toFixed(1);
  const over = left.length > 0 ? `; ${left.length} over the ${seconds}s budget run in CI only: ${left.join(' ')}` : '';
  console.error(`gate-related-tests: ${related.length} related test files for ${sources.length} changed sources (${walk}s)${over}`);
  console.info(JSON.stringify(run));
}

#!/usr/bin/env node
// gate-cache.mjs — content-hash cache and affected-test selection for the push gate (scripts/vercel-tree-gate.sh).
// Process audit 2026-10-09: every push re-ran bake-check (111–164 s) and the whole vitest suite (121–191 s) even when
// no bake input or test dependency had changed. State lives in <git-common-dir>/gate-cache/, beside the gate stamps.
//
//   gate-cache.mjs check <step> <tree>                 exit 0 = the step's recorded inputs are byte-identical in <tree>
//   gate-cache.mjs record <step> <tree> <trace-dir> <sha>   after the step PASSED: save its traced inputs' hashes
//   gate-cache.mjs vitest-plan <tree> <sha>            print "full" or the changed files for `vitest related`
//   gate-cache.mjs vitest-pass <sha> <full|related>    after vitest passed at <sha>
//   gate-cache.mjs full?                               exit 0 when this gate must run everything (every FULL_EVERY-th
//                                                      gate, FULL_HOURS since the last full gate, or GATE_FULL=1)
//   gate-cache.mjs full-pass <sha>                     after a gate that ran everything passed
//
// An input is a file (content hash, or "absent"), a directory listing, or a glob's result list, recorded under the
// export tree by scripts/gate-trace.mjs; pnpm-lock.yaml, package.json, the command line and the node version are
// always part of the key. CI still runs every step in full on every push.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FULL_EVERY = 8, FULL_HOURS = 6;
const repo = resolve(import.meta.dirname, '..');
const stateDir = () => {
  const dir = join(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim(), 'gate-cache');
  mkdirSync(dir, { recursive: true });
  return dir;
};
/** @param {string} file @returns {Record<string, unknown> | null} */
const readJson = (file) => { try { const value = JSON.parse(readFileSync(file, 'utf8')); return value !== null && typeof value === 'object' ? value : null; } catch { return null; } };
const hash = (/** @type {string | Uint8Array} */ data) => createHash('sha256').update(data).digest('hex');
const ALWAYS = ['F pnpm-lock.yaml', 'F package.json'];

/** The current value of one recorded input inside `tree` (paths are tree-relative). @param {string} tree @param {string} entry */
export function inputValue(tree, entry) {
  const kind = entry.slice(0, 1), rest = entry.slice(2);
  if (kind === 'G') {
    const [cwd = '.', pattern = ''] = rest.split('\t');
    try { return hash(globSync(pattern, { cwd: resolve(tree, cwd) }).map(String).sort().join('\n')); } catch { return 'error'; }
  }
  const path = resolve(tree, rest);
  if (!existsSync(path)) return 'absent';
  const stat = statSync(path);
  if (stat.isDirectory()) return `dir:${hash(readdirSync(path).sort().join('\n'))}`;
  return kind === 'D' ? 'not-a-dir' : hash(readFileSync(path));
}

/** Fold raw trace lines (absolute paths) into tree-relative entries; node_modules is represented by the lockfile. */
export function treeEntries(/** @type {string} */ tree, /** @type {string[]} */ lines) {
  const real = realpathSync(tree), entries = new Set(ALWAYS);
  /** @param {string} path */
  const inside = (path) => {
    let target = path;
    try { target = realpathSync(path); } catch { /* absent: keep the literal path */ }
    const rel = relative(real, target);
    if (rel === '' || rel.startsWith('..') || rel.startsWith(sep) || rel.split(sep).includes('node_modules')) return null;
    return rel.split(sep).join('/');
  };
  for (const line of lines) {
    const kind = line.slice(0, 1), rest = line.slice(2);
    if (kind === 'G') {
      const [cwd = '', pattern = ''] = rest.split('\t'), rel = inside(cwd);
      if (rel !== null) entries.add(`G ${rel}\t${pattern}`);
    } else if (kind === 'F' || kind === 'D') {
      const rel = inside(rest);
      if (rel !== null) entries.add(`${kind} ${rel}`);
    }
  }
  return [...entries].sort();
}

const stepKey = (/** @type {string} */ step) => `${step}|${process.version}|${process.env.GATE_CACHE_COMMAND ?? ''}`;

function check(/** @type {string} */ step, /** @type {string} */ tree) {
  const saved = readJson(join(stateDir(), `${step}.json`));
  if (saved === null || saved.key !== stepKey(step) || saved.inputs === null || typeof saved.inputs !== 'object') return false;
  for (const [entry, value] of Object.entries(saved.inputs)) if (inputValue(tree, entry) !== value) return false;
  console.log(`${String(saved.sha).slice(0, 9)} (${Object.keys(saved.inputs).length} inputs unchanged)`);
  return true;
}

function record(/** @type {string} */ step, /** @type {string} */ tree, /** @type {string} */ traceDir, /** @type {string} */ sha) {
  const traces = existsSync(traceDir) ? readdirSync(traceDir).filter((name) => name.endsWith('.trace')) : [];
  if (traces.length === 0) return; // nothing traced (no node child exited normally): never cache
  const lines = traces.flatMap((name) => readFileSync(join(traceDir, name), 'utf8').split('\n').filter(Boolean));
  const inputs = Object.fromEntries(treeEntries(tree, lines).map((entry) => [entry, inputValue(tree, entry)]));
  writeFileSync(join(stateDir(), `${step}.json`), `${JSON.stringify({ key: stepKey(step), sha, inputs })}\n`);
}

/** Files that make `vitest related` unsafe: they change how every test runs. */
const GLOBAL = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest[^/]*|vite\.config\.ts|test\/(setup|fake|helpers?)\b|scripts\/vitest-lane\.ts)/u;
const MAX_RELATED = 150;
const TEXT_FILE = /\.(?:[cm]?[jt]s|py|sh|json)$/u, TEST_FILE = /\.test\.[cm]?[jt]s$/u;
/** A changed file's names in another file's text: its repo path, and its basename when that is distinctive. */
const needles = (/** @type {string} */ file) => {
  const base = file.split('/').pop() ?? file;
  return base.length < 8 || /^(?:index|mod|types?|util|main)\./u.test(base) ? [file] : [file, base];
};
/**
 * Tests that reach a changed file outside vite's import graph (a spawned script, a Python or shell fixture, an fs read):
 * their text names the file, directly or through a test fixture that names it (up to three hops). 2026-10-09:
 * test/sim-memory-interval.test.ts runs test/fixtures/soak/native-interval.py, which loads scripts/sim-mem-phases.py,
 * so `vitest related` never selected it for a change to the sampler.
 * @param {string} tree @param {string[]} changed @returns {string[]}
 */
export function textReferencedTests(tree, changed) {
  const files = globSync(['test/**/*', 'api-tests/**/*', 'drafts/test/**/*', 'admin/test/**/*'], { cwd: tree })
    .map(String).filter((file) => TEXT_FILE.test(file) && !file.split('/').includes('node_modules'));
  /** @type {Map<string, string>} */
  const text = new Map();
  const read = (/** @type {string} */ file) => {
    let body = text.get(file);
    if (body === undefined) {
      try { const path = resolve(tree, file), stat = statSync(path); body = stat.isFile() && stat.size < 2_000_000 ? readFileSync(path, 'utf8') : ''; } catch { body = ''; }
      text.set(file, body);
    }
    return body;
  };
  const tests = new Set(), seen = new Set(changed);
  let frontier = changed;
  for (let hop = 0; hop < 3 && frontier.length > 0; hop++) {
    const keys = frontier.flatMap(needles);
    /** @type {string[]} */
    const next = [];
    for (const file of files) {
      const isTest = TEST_FILE.test(file);
      if (!isTest && seen.has(file)) continue;
      const body = read(file);
      if (!keys.some((key) => body.includes(key))) continue;
      if (isTest) tests.add(file);
      else { seen.add(file); next.push(file); }
    }
    frontier = next;
  }
  return [...tests].sort((a, b) => a.localeCompare(b));
}
function vitestPlan(/** @type {string} */ tree, /** @type {string} */ sha) {
  const saved = readJson(join(stateDir(), 'vitest.json'));
  const base = typeof saved?.sha === 'string' ? saved.sha : '';
  if (base === '' || process.env.GATE_FULL === '1') return 'full';
  try { execFileSync('git', ['merge-base', '--is-ancestor', base, sha], { cwd: repo, stdio: 'ignore' }); } catch { return 'full'; }
  const diff = (/** @type {string[]} */ extra) => execFileSync('git', ['diff', '--name-only', '--no-renames', ...extra, base, sha], { cwd: repo, encoding: 'utf8' }).split('\n').filter(Boolean);
  const changed = diff([]);
  if (changed.length > MAX_RELATED || changed.some((file) => GLOBAL.test(file))) return 'full';
  // A deleted module has no graph node left, so `vitest related` cannot find the tests that imported it.
  if (diff(['--diff-filter=D']).some((file) => /^(src|test|scripts|api|lint)\//u.test(file))) return 'full';
  // Files Vercel drops are not in the tree; vitest related only takes files that exist there.
  const present = changed.filter((file) => existsSync(resolve(tree, file)));
  const selected = [...new Set([...present, ...textReferencedTests(tree, changed)])];
  if (selected.length > MAX_RELATED) return 'full';
  return selected.length === 0 ? 'none' : selected.join('\n');
}

function fullDue() {
  if (process.env.GATE_FULL === '1') return true;
  const saved = readJson(join(stateDir(), 'full.json'));
  if (saved === null || typeof saved.at !== 'number' || typeof saved.gatesSince !== 'number') return true;
  return saved.gatesSince + 1 >= FULL_EVERY || Date.now() - saved.at > FULL_HOURS * 3600_000;
}
function bump(/** @type {string} */ sha, /** @type {boolean} */ full) {
  const file = join(stateDir(), 'full.json'), saved = readJson(file);
  const next = full ? { sha, at: Date.now(), gatesSince: 0 }
    : { ...saved, gatesSince: (typeof saved?.gatesSince === 'number' ? saved.gatesSince : 0) + 1 };
  writeFileSync(file, `${JSON.stringify(next)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command = '', a = '', b = '', c = '', d = ''] = process.argv.slice(2);
  try {
    if (command === 'check') process.exitCode = check(a, b) ? 0 : 1;
    else if (command === 'record') record(a, b, c, d);
    else if (command === 'vitest-plan') console.log(vitestPlan(a, b));
    else if (command === 'vitest-pass') writeFileSync(join(stateDir(), 'vitest.json'), `${JSON.stringify({ sha: a, mode: b, at: Date.now() })}\n`);
    else if (command === 'full?') process.exitCode = fullDue() ? 0 : 1;
    else if (command === 'full-pass') bump(a, true);
    else if (command === 'partial-pass') bump(a, false);
    else throw new Error('usage: gate-cache.mjs check|record|vitest-plan|vitest-pass|full?|full-pass|partial-pass …');
  } catch (error) { console.error(`gate-cache: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; }
}

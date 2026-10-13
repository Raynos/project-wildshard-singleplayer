#!/usr/bin/env node
// SF74 W25 (speed audit #11): one lane's red must not hold every lane. On 2026-10-09 origin sat on 5a58f8785 for 3 h
// with 141 commits behind a red push gate whose failures came from four different lanes in turn, and production missed
// a release fix (c145a1df9) that was green all along.
//
// When the push gate on <tip> fails in supported focused checks, this picks an unpushed commit worth gating instead:
//   1. the failing test files come from the gate's output (one ' FAIL ' line per failed test);
//   2. a binary search over the unpushed commits probes those files (only those) on a clean export of each, to find
//      the first bad commit (the newest commit where they still pass sits just before it);
//   3. choose the newest passing candidate with verified commit-time build inputs.
// The caller still runs the complete bounded local gate before pushing. Full bakes,
// checkpoint continuations and builds remain required CI checks. Probes never generate.
// Unknown failures refuse selection. A committed repair earns one new actual gate.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { linkNodeModules } from './link-node-modules.mjs';
import { restoreCommitInputs } from './commit-inputs.mjs';

/** The gate's failing steps (`  ✗ <name> (…)`). @param {string} out */
export function failedSteps(out) {
  return [...out.matchAll(/^ {2}✗ (\S+)/gmu)].map((m) => m[1]).filter((name) => name !== '');
}
/** The test files of the gate's vitest ' FAIL ' lines, sorted and unique. @param {string} out */
export function failingTestFiles(out) {
  /** @type {Set<string>} */
  const files = new Set();
  for (const m of out.matchAll(/^ *FAIL +(?:\|[^|\n]+\| +)?(\S+\.(?:test|spec)\.[cm]?[jt]sx?)\b/gmu)) if (m[1]) files.add(m[1]);
  return [...files].sort((a, b) => a.localeCompare(b));
}
/** Exact focused gate commands; null refuses any unsupported non-vitest step. No shell text comes from the log.
 * @param {readonly string[]} steps @returns {string[][] | null} */
export function failureCommands(steps) {
  const commands = [];
  for (const step of steps) {
    if (step === 'vitest') continue;
    if (step === 'typecheck') commands.push(['pnpm', 'exec', 'tsc', '--noEmit']);
    else if (step === 'typecheck-layers') commands.push(['pnpm', 'exec', 'tsc', '-b', 'tsconfig.layers.json']);
    else if (['typecheck-api', 'typecheck-scripts'].includes(step)) commands.push(['pnpm', 'exec', 'tsc', '--noEmit', '-p', step.slice(10)]);
    else if (step === 'oxlint') commands.push(['pnpm', 'exec', 'oxlint']);
    else if (step === 'check-css') commands.push([process.execPath, 'scripts/check-css.mjs']);
    else if (step === 'gen-check') commands.push([process.execPath, 'scripts/gen-shards.mjs', '--check']);
    else if (step === 'game-plugin-exports') commands.push([process.execPath, 'scripts/game-plugins.mjs', '--check']);
    else if (step === 'bake-check') commands.push([process.execPath, 'scripts/bake-check.mjs', '--node-only']);
    else if (/^bake-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(step)) commands.push([process.execPath, 'scripts/bake-check.mjs', '--node-only', `--only=${step.slice(5)}`]);
    else return null;
  }
  return commands;
}
/**
 * The newest index in `candidates` (oldest first) whose probe passes, assuming one break point (pass … pass fail … fail);
 * -1 when none passes. Probes at most ⌈log2(n + 1)⌉ candidates.
 * @param {readonly string[]} candidates @param {(sha: string) => boolean} passes
 */
export function newestPassing(candidates, passes) {
  let lo = -1, hi = candidates.length; // lo: newest known pass (-1 = origin), hi: oldest known fail
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2), sha = candidates[mid];
    if (passes(sha)) lo = mid; else hi = mid;
  }
  return lo;
}

const git = (/** @type {string} */ root, /** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const log = (/** @type {string} */ line) => { process.stderr.write(`green-prefix: ${line}\n`); };

/** The exact plain formatter diagnostics in the failed lint section. Unknown output refuses retry.
 * @param {string} out @returns {string[]} */
export function failingLintFiles(out) {
  const sections = out.split('── oxlint ──\n');
  const section = sections.at(1);
  if (sections.length !== 2 || section === undefined) return [];
  const boundary = section.search(/^(?:── .+ ──|vercel-gate:)/mu);
  const body = boundary < 0 ? section : section.slice(0, boundary);
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
  /** @type {Set<string>} */
  const files = new Set();
  for (const line of lines) {
    const match = /^([a-zA-Z0-9_./-]+\.[cm]?[jt]sx?):[1-9][0-9]*:[1-9][0-9]*: error \S/u.exec(line);
    const file = match?.[1];
    if (file === undefined) return [];
    files.add(file);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

/** A committed descendant repair earns one fresh complete gate, never a green inference.
 * Supported failures may be repaired in source, catalogue or baked inputs as well as named tests.
 * Working edits, removed failing files and unknown gate steps cannot earn a retry.
 * @param {string} root @param {string} tip @param {string} out @returns {string | null} */
export function newerGateFix(root, tip, out) {
  const steps = failedSteps(out);
  if (steps.length === 0 || failureCommands(steps) === null) return null;
  const tests = steps.includes('vitest') ? failingTestFiles(out) : [];
  const lint = steps.includes('oxlint') ? failingLintFiles(out) : [];
  if ((steps.includes('vitest') && tests.length === 0) || (steps.includes('oxlint') && lint.length === 0)) return null;
  const files = [...tests, ...lint];
  if (tests.some(file => !file.startsWith('test/')) || files.some(file => file.startsWith('/') || file.split('/').some(part => part === '..' || part === '.' || part === ''))) return null;
  try {
    const red = git(root, ['rev-parse', `${tip}^{commit}`]), current = git(root, ['rev-parse', 'main^{commit}']);
    if (red === current || spawnSync('git', ['merge-base', '--is-ancestor', red, current], { cwd: root }).status !== 0) return null;
    for (const file of files) if (spawnSync('git', ['cat-file', '-e', `${current}:${file}`], { cwd: root, stdio: 'ignore' }).status !== 0) return null;
    const changes = git(root, ['diff', '--no-renames', '--name-status', red, current, '--', 'src', 'scripts', 'package.json', 'pnpm-lock.yaml', ...files.map(file => `:(literal)${file}`)]).split('\n').filter(Boolean);
    if (!changes.some(change => change.startsWith('M\t'))) return null;
    log(`${current.slice(0, 9)} changes committed inputs after ${red.slice(0, 9)} (${steps.join(', ')}): gate once before prefix search`);
    return current;
  } catch { return null; } // An unreadable commit or diff cannot authorize a retry.
}

/** Commits a gate already failed, from the gate's own timing records. @param {string} common */
function gatedRed(common) {
  const file = join(common, 'gate-timings.jsonl'), red = new Set();
  if (!existsSync(file)) return red;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    try { const row = JSON.parse(line); if (row.ok === false && typeof row.sha === 'string') red.add(row.sha); } catch { /* a torn line */ }
  }
  return red;
}

/** Run focused failed checks and present tests on a clean export; missing scripts refuse rather than passing.
 * @param {string} root @param {string} sha @param {readonly string[]} files @param {readonly string[][]} [commands]
 * @param {(work: string, snapshot: string) => void} [keepPassing] */
export function probeFailure(root, sha, files, commands, keepPassing) {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'green-prefix-')));
  let kept = false;
  try {
    const archive = join(work, 'source.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, sha, '--', '.', ':!art', ':!progress', ':!sources', ':!drafts', ':!ios', ':!android', ':!.claude', ':!docs'], { cwd: root });
    execFileSync('tar', ['-xf', archive, '-C', work]);
    rmSync(archive);
    linkNodeModules(root, work);
    const present = files.filter((file) => existsSync(join(work, file)));
    if (present.length === 0 && (commands?.length ?? 0) === 0) { log(`${sha.slice(0, 9)}: none of the files exist yet: pass`); return true; }
    if (existsSync(join(work, 'scripts/gen.mjs'))) restoreCommitInputs(root, sha, work);
    const snapshot = keepPassing === undefined ? '' : probeSnapshot(work);
    const ok = failureInWork(work, sha, present, commands ?? []);
    if (ok && keepPassing !== undefined) { keepPassing(work, snapshot); kept = true; }
    return ok;
  } catch (error) {
    log(`${sha.slice(0, 9)}: probe failed (${error instanceof Error ? error.message.split('\n')[0] : String(error)}): counted as red`);
    return false;
  } finally { if (!kept) rmSync(work, { recursive: true, force: true }); }
}

/** Fingerprint prepared export files; dependency links remain supplied by the pinned install.
 * Added, deleted, renamed or changed files (including generated files) refuse reuse. @param {string} work */
export function probeSnapshot(work) {
  const hash = createHash('sha256');
  /** @param {string} directory */
  function visit(directory) {
    for (const name of readdirSync(join(work, directory)).sort()) {
      const path = directory === '' ? name : `${directory}/${name}`;
      if (path === 'node_modules') continue;
      const absolute = join(work, path), stat = lstatSync(absolute);
      if (stat.isDirectory()) visit(path);
      else {
        hash.update(path).update('\0').update(String(stat.mode)).update('\0');
        hash.update(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute)).update('\0');
      }
    }
  }
  visit('');
  return hash.digest('hex');
}

/** @param {string} work @param {string} sha @param {readonly string[]} files @param {readonly string[][]} commands */
function failureInWork(work, sha, files, commands) {
  const t0 = Date.now(), present = files.filter((file) => existsSync(join(work, file)));
  const checks = [...commands, ...(present.length === 0 ? [] : [['pnpm', 'exec', 'vitest', 'run', ...present]])];
  const ok = checks.every(([command, ...args]) => spawnSync(command, args,
    { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).status === 0);
  log(`${sha.slice(0, 9)}: ${commands.length} check(s), ${present.length} file(s) ${ok ? 'pass' : 'fail'} in ${Math.round((Date.now() - t0) / 1000)} s`);
  return ok;
}

/**
 * @param {string} root @param {string} tip @param {string} out the gate's (or, for 'witness', the regeneration's) output
 * @param {'vitest' | 'witness'} [mode] 'witness': the regeneration refused a witness payload change (a behaviour change
 *   committed without its rebake), so the probe is the witness re-record itself
 */
export function greenPrefix(root, tip, out, mode = 'vitest') {
  /** @type {string[]} */
  let files = [];
  /** @type {string[][]} */
  let commands = [];
  if (mode === 'witness') {
    log('witness producers belong to commit time; not replayed during push'); return null;
  }
  {
    const steps = failedSteps(out);
    if (steps.length === 0) { log('no failed gate step in the output'); return null; }
    const focused = failureCommands(steps);
    if (focused === null) { log(`unsupported failed step (${steps.join(', ')}): not bisected`); return null; }
    commands = focused;
    if (steps.includes('vitest')) {
      files = failingTestFiles(out);
      if (files.length === 0) { log('vitest failed with no FAIL line'); return null; }
    }
  }
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const tipSha = git(root, ['rev-parse', tip]), red = gatedRed(common);
  const commits = git(root, ['rev-list', '--reverse', `origin/main..${tipSha}`]).split('\n').filter(Boolean).filter((sha) => sha !== tipSha);
  if (commits.length === 0) { log('nothing unpushed before the red tip'); return null; }
  log(`${commands.length} failing check(s), ${files.length} file(s) over ${commits.length} unpushed commit(s): ${files.join(' ')}`);
  /** @type {{sha: string, work: string, snapshot: string} | undefined} */
  let prepared;
  try {
    const index = newestPassing(commits, (sha) => probeFailure(root, sha, files, commands, (work, snapshot) => {
      if (prepared !== undefined) rmSync(prepared.work, { recursive: true, force: true });
      prepared = { sha, work, snapshot };
    }));
    if (index < 0) { log('the failed checks fail on every unpushed commit'); return null; }
    log(`first bad commit (guess): ${git(root, ['log', '-1', '--format=%h %s', commits[index + 1] ?? tipSha]).slice(0, 120)}`);
    for (let i = index; i >= 0; i--) {
      const sha = commits[i];
      if (red.has(sha)) continue;
      // The passing export already restored SHA-verified commit-time inputs.
      // Every selection still receives the full bounded local gate in the caller.
      if (prepared?.sha !== sha && !probeFailure(root, sha, files, commands)) continue;
      log(`pushable prefix: ${sha.slice(0, 9)} (${git(root, ['rev-list', '--count', `origin/main..${sha}`])} of ${commits.length + 1} unpushed commits)`);
      return sha;
    }
    log('no pushable commit before the break');
    return null;
  } finally { if (prepared !== undefined) rmSync(prepared.work, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const witness = process.argv[2] === '--witness';
  const retry = process.argv[2] === '--retry-current-tip';
  const [tip = '', file = ''] = process.argv.slice(witness || retry ? 3 : 2);
  if (tip === '' || file === '' || !existsSync(file)) { console.error('usage: green-prefix.mjs [--witness|--retry-current-tip] <tip> <gate-or-regeneration-output-file>'); process.exit(64); }
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const out = readFileSync(file, 'utf8');
  const sha = retry ? newerGateFix(root, tip, out) : greenPrefix(root, tip, out, witness ? 'witness' : 'vitest');
  if (sha !== null) console.log(sha);
}

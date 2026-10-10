#!/usr/bin/env node
// SF74 W25 (speed audit #11): one lane's red must not hold every lane. On 2026-10-09 origin sat on 5a58f8785 for 3 h
// with 141 commits behind a red push gate whose failures came from four different lanes in turn, and production missed
// a release fix (c145a1df9) that was green all along.
//
// When the push gate on <tip> fails only in vitest, this picks the newest unpushed commit worth gating instead:
//   1. the failing test files come from the gate's output (one ' FAIL ' line per failed test);
//   2. a binary search over the unpushed commits probes those files (only those) on a clean export of each, to find
//      the first bad commit (the newest commit where they still pass sits just before it);
//   3. from there it walks back to a commit that is pushable as it is, needing no regeneration commit of its own (a
//      regeneration commit cannot be slotted under commits already on local main): a verified regeneration commit
//      (.git/generated-verified/<sha>) or one `regenerate-committed.mjs --check` passes (3 checks at most), whose
//      witness checkpoints are current, skipping any commit a gate already failed (.git/gate-timings.jsonl).
// push-main.sh then runs the full gate on that commit and pushes it when green; the rest waits for the fix as before.
// `--witness`: the regeneration refused a witness payload change (a behaviour change landed without its rebake); the
// probe is then the witness re-record itself. Other reds (typecheck, oxlint, a bake, the build) print nothing.
//
//   node scripts/green-prefix.mjs [--witness] <tip> <output-file>    prints a sha, or nothing (reason on stderr)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { linkNodeModules } from './link-node-modules.mjs';

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

/** Commits a gate already failed, from the gate's own timing records. @param {string} common */
function gatedRed(common) {
  const file = join(common, 'gate-timings.jsonl'), red = new Set();
  if (!existsSync(file)) return red;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    try { const row = JSON.parse(line); if (row.ok === false && typeof row.sha === 'string') red.add(row.sha); } catch { /* a torn line */ }
  }
  return red;
}

/** Run the given test files that exist at <sha> on a clean export of it. @param {string} root @param {string} sha @param {readonly string[]} files */
function probe(root, sha, files) {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'green-prefix-')));
  try {
    const archive = join(work, 'source.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, sha, '--', '.', ':!art', ':!progress', ':!sources', ':!drafts', ':!ios', ':!android', ':!.claude', ':!docs'], { cwd: root });
    execFileSync('tar', ['-xf', archive, '-C', work]);
    rmSync(archive);
    linkNodeModules(root, work);
    const present = files.filter((file) => existsSync(join(work, file)));
    if (present.length === 0) { log(`${sha.slice(0, 9)}: none of the files exist yet: pass`); return true; }
    if (existsSync(join(work, 'scripts/gen.mjs'))) execFileSync(process.execPath, ['scripts/gen.mjs'], { cwd: work, stdio: 'ignore' });
    const t0 = Date.now();
    const run = spawnSync('pnpm', ['exec', 'vitest', 'run', ...present], { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ok = run.status === 0;
    log(`${sha.slice(0, 9)}: ${present.length} file(s) ${ok ? 'pass' : 'fail'} in ${Math.round((Date.now() - t0) / 1000)} s`);
    return ok;
  } catch (error) {
    log(`${sha.slice(0, 9)}: probe failed (${error instanceof Error ? error.message.split('\n')[0] : String(error)}): counted as red`);
    return false;
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/** Whether <sha>'s committed generated outputs are current (the gate's `generated` step). @param {string} root @param {string} sha */
function generatedCurrent(root, sha) {
  const t0 = Date.now();
  const run = spawnSync(process.execPath, ['scripts/regenerate-committed.mjs', '--check', sha], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  log(`${sha.slice(0, 9)}: generated outputs ${run.status === 0 ? 'current' : 'stale'} (${Math.round((Date.now() - t0) / 1000)} s)`);
  return run.status === 0;
}
/** at most this many `regenerate-committed --check` runs (57-107 s each) while walking back from the break */
const MAX_GENERATED_CHECKS = 3;
/** the witnesses' checkpoint fences: a commit whose manifests are stale is not pushable as it is */
const CHECKPOINTS = ['driftwood-isle', 'far-reach', 'nine-dragon-stack', 'pine-hollow'].map((slug) => `test/proof/${slug}/checkpoints.test.ts`);

/** Whether the witnesses re-record at <sha> with byte-identical payloads (the regeneration's refusal, probed alone). @param {string} root @param {string} common @param {string} sha */
function witnessProbe(root, common, sha) {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'green-prefix-')));
  try {
    const archive = join(work, 'source.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, sha, '--', '.', ':!art', ':!progress', ':!sources', ':!drafts', ':!ios', ':!android', ':!.claude', ':!docs'], { cwd: root });
    execFileSync('tar', ['-xf', archive, '-C', work]);
    rmSync(archive);
    if (!existsSync(join(work, 'scripts/witness-manifests.mjs'))) { log(`${sha.slice(0, 9)}: no witness recorder yet: pass`); return true; }
    linkNodeModules(root, work);
    if (existsSync(join(work, 'scripts/gen.mjs'))) execFileSync(process.execPath, ['scripts/gen.mjs'], { cwd: work, stdio: 'ignore' });
    const t0 = Date.now();
    const run = spawnSync(process.execPath, ['scripts/witness-manifests.mjs', '--refresh', work, join(common, 'witness-verified'), join(work, 'witness.json')], { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    log(`${sha.slice(0, 9)}: witness payloads ${run.status === 0 ? 'byte-identical' : 'changed'} (${Math.round((Date.now() - t0) / 1000)} s)`);
    return run.status === 0;
  } catch (error) {
    log(`${sha.slice(0, 9)}: witness probe failed (${error instanceof Error ? error.message.split('\n')[0] : String(error)}): counted as red`);
    return false;
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/**
 * @param {string} root @param {string} tip @param {string} out the gate's (or, for 'witness', the regeneration's) output
 * @param {'vitest' | 'witness'} [mode] 'witness': the regeneration refused a witness payload change (a behaviour change
 *   committed without its rebake), so the probe is the witness re-record itself
 */
export function greenPrefix(root, tip, out, mode = 'vitest') {
  /** @type {string[]} */
  let files = [];
  if (mode === 'witness') {
    if (!out.includes('witness-manifests: payloads changed')) { log('the regeneration failed for another reason: not bisected'); return null; }
  } else {
    const steps = failedSteps(out);
    if (steps.length === 0) { log('no failed gate step in the output'); return null; }
    if (steps.some((step) => step !== 'vitest')) { log(`red outside vitest (${steps.join(', ')}): not bisected`); return null; }
    files = failingTestFiles(out);
    if (files.length === 0) { log('vitest failed with no FAIL line'); return null; }
  }
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const tipSha = git(root, ['rev-parse', tip]), red = gatedRed(common);
  const commits = git(root, ['rev-list', '--reverse', `origin/main..${tipSha}`]).split('\n').filter(Boolean).filter((sha) => sha !== tipSha);
  if (commits.length === 0) { log('nothing unpushed before the red tip'); return null; }
  log(mode === 'witness' ? `witness payloads changed: bisecting ${commits.length} unpushed commit(s)` : `${files.length} failing file(s) over ${commits.length} unpushed commit(s): ${files.join(' ')}`);
  const index = newestPassing(commits, (sha) => mode === 'witness' ? witnessProbe(root, common, sha) : probe(root, sha, files));
  if (index < 0) { log('the failing files fail on every unpushed commit'); return null; }
  log(`first bad commit (guess): ${git(root, ['log', '-1', '--format=%h %s', commits[index + 1] ?? tipSha]).slice(0, 120)}`);
  let checks = 0;
  for (let i = index; i >= 0; i--) {
    const sha = commits[i];
    if (red.has(sha)) continue;
    if (!existsSync(join(common, 'generated-verified', sha))) {
      if (checks >= MAX_GENERATED_CHECKS) break;
      checks++;
      if (!generatedCurrent(root, sha)) continue;
    }
    if (!probe(root, sha, CHECKPOINTS.filter((file) => !files.includes(file)))) continue;
    log(`pushable prefix: ${sha.slice(0, 9)} (${git(root, ['rev-list', '--count', `origin/main..${sha}`])} of ${commits.length + 1} unpushed commits)`);
    return sha;
  }
  log('no pushable commit before the break');
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const witness = process.argv[2] === '--witness';
  const [tip = '', file = ''] = process.argv.slice(witness ? 3 : 2);
  if (tip === '' || file === '' || !existsSync(file)) { console.error('usage: green-prefix.mjs [--witness] <tip> <gate-or-regeneration-output-file>'); process.exit(64); }
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const sha = greenPrefix(root, tip, readFileSync(file, 'utf8'), witness ? 'witness' : 'vitest');
  if (sha !== null) console.log(sha);
}

// E362 AG20: inspect the commit's index tree, never the shared working copy.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { beginGuardRequirement, completeGuardRequirement, compareCounts, hardRules, readLintConfig } from './guard-counts.mjs';
import { checkShardLayout, shardEntries } from './check-shards.mjs';
import { checkPlatformRatchets, PLATFORM_LISTS } from './check-platform-ratchets.mjs';
import { verifyCommitProduced } from './commit-produced.mjs';
import { isWitnessManifest, manifestOutcome } from './witness-manifests.mjs';
import { guardSnapshot } from './guard-snapshot.mjs';
import { materializeGuardData } from './precommit-generated-data.mjs';
import { checkLegacyInventory, legacyInventory, registeredLegacyFile } from './legacy-shards.mjs';

const run = (cwd, command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
};

/** spawnSync's result shape, without blocking: the guards' slow children run side by side (SF74 W14). */
async function spawnAsync(cwd, command, args, env = process.env) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const [status] = await once(child, 'close'); // rejects on the child's 'error' event
  return { status, stdout, stderr };
}
const runAsync = async (cwd, command, args) => {
  const result = await spawnAsync(cwd, command, args);
  if (result.status !== 0) throw new Error(`${command} failed (${String(result.status)}): ${result.stderr.length > 0 ? result.stderr : result.stdout}`);
  return result.stdout;
};

/** Extract an immutable Git tree without a pipe that tar may close before Node writes its trailing padding. */
export function extractGuardArchive(root, tree, paths, destination) {
  const owned = mkdtempSync(join(tmpdir(), 'wildshard-guard-archive-'));
  try {
    const archive = join(owned, 'snapshot.tar');
    run(root, 'git', ['archive', tree, '--output', archive, '--', ...paths]);
    run(root, 'tar', ['-xf', archive, '-C', destination]);
  } finally { rmSync(owned, { recursive: true, force: true }); }
}

/** Source-independent generated tables; their final bytes still feed the final checks. */
const STAGED_TABLES = new Set(['lint/ask-ids.json', 'lint/shard-words.generated.json', 'scripts/README.md']);

/** Source analysis can survive generated debt reductions, never policy or source changes. */
export function canOverlayGuardTable(path, before, after, producedWitness = false) {
  if (producedWitness && isWitnessManifest(path)) {
    try {
      const inputs = JSON.parse(after).inputs;
      return typeof inputs === 'string' && /^[a-f0-9]+$/u.test(inputs)
        && manifestOutcome(before) === manifestOutcome(after);
    } catch { return false; }
  }
  if (STAGED_TABLES.has(path)) return true;
  if (path !== 'lint/ratchet.json') return false;
  try {
    const previous = JSON.parse(before), current = JSON.parse(after);
    if (previous === null || current === null || typeof previous !== 'object' || typeof current !== 'object'
      || Array.isArray(previous) || Array.isArray(current)) return false;
    const policy = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('wildshard/')));
    if (!isDeepStrictEqual(policy(previous), policy(current))) return false;
    for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
      if (!key.startsWith('wildshard/')) continue;
      const old = previous[key] ?? {}, next = current[key] ?? {};
      if (old === null || next === null || typeof old !== 'object' || typeof next !== 'object'
        || Array.isArray(old) || Array.isArray(next)) return false;
      for (const file of new Set([...Object.keys(old), ...Object.keys(next)])) {
        const was = old[file] ?? 0, now = next[file] ?? 0;
        if (!Number.isSafeInteger(was) || !Number.isSafeInteger(now) || was < 0 || now < 0 || now > was) return false;
      }
    }
    return true;
  } catch { return false; }
}

/** The hook's status file for scripts/precommit-inputs.mjs: its exit code once the index is final (G367). */
async function inputsStatus(file) {
  const deadline = Date.now() + 600_000;
  for (;;) {
    try { return Number(readFileSync(file, 'utf8').trim()); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    if (Date.now() > deadline) throw new Error(`precommit-inputs never reported to ${file}`);
    await new Promise((_resolve) => { setTimeout(_resolve, 25); });
  }
}

/**
 * The commit holds the shared index.lock for the whole pre-commit hook, so every second here is every agent's wait
 * (SF74 W14: 138 lock collisions in 6 h, ~6 s per src commit). Setup runs once; shard-coupling (~3 s) and oxlint then
 * run side by side on the same immutable export.
 *
 * bench-max (2026-10-13): the hook starts this beside scripts/precommit-inputs.mjs and names its status file in
 * WS_PRECOMMIT_INPUTS_DONE. Everything that cannot read the staged tables (exports, shard-coupling, HEAD's lint) runs
 * on the tree before the tables; once the index is final the tables are overlaid from it. Source lint runs concurrently;
 * changed lint vocabulary reruns it, and every list check reads the final tree. Any other difference reruns the whole guard on the final tree.
 */
export async function precommitGuards(root = resolve(import.meta.dirname, '..'), inputsDone = process.env.WS_PRECOMMIT_INPUTS_DONE) {
  if (process.env.SKIP_ARCH_GUARDS === '1') {
    appendFileSync(resolve(root, 'project/sweepguard-ledger.md'), `\n- ${new Date().toISOString()} SKIP_ARCH_GUARDS=1: architecture pre-commit checks bypassed.\n`);
    console.warn('Architecture guards skipped; recorded in project/sweepguard-ledger.md');
    return;
  }
  const changed = run(root, 'git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z']).split('\0').filter(Boolean);
  const paths = changed.filter((p) => /^src\/.*\.[cm]?[jt]sx?$/u.test(p) && !p.endsWith('.generated.ts'));
  const slugs = new Set(changed.flatMap((p) => /^src\/shards\/([^/]+)\//u.exec(p)?.[1] ?? []));
  const platform = changed.some((p) => PLATFORM_LISTS.includes(p));
  if (paths.length === 0 && slugs.size === 0 && !platform) {
    if (inputsDone!==undefined && inputsDone!=='') {
      const initial=run(root,'git',['write-tree']).trim();
      console.log('precommit-guards: waiting for final inputs');
      if (await inputsStatus(inputsDone)!==0) throw new Error('Architecture guards stopped: scripts/precommit-inputs.mjs failed');
      if (run(root,'git',['write-tree']).trim()!==initial) await precommitGuards(root,'');
    }
    return;
  }
  // macOS /var aliases /private/var; oxlint override globs must share the canonical cwd/config path.
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'wildshard-precommit-')));
  /** @type {Promise<unknown>[]} children that must settle before the scratch export is removed */
  const children = [];
  try {
    const blobDirectory = join(run(root, 'git', ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), 'commit-inputs', 'blobs');
    const materialize = async destination => {
      try { materializeGuardData(root, destination, blobDirectory); }
      catch (error) {
        // A new pinned output may be generated concurrently. Wait for the
        // writer's successful publication, then verify its exact staged pin.
        if (inputsDone === undefined || inputsDone === '') throw error;
        console.log('precommit-guards: waiting for pinned data');
        if (await inputsStatus(inputsDone) !== 0) throw new Error('Architecture guards stopped: scripts/precommit-inputs.mjs failed', { cause: error });
        materializeGuardData(root, destination, blobDirectory);
      }
    };
    // write-tree observes Git's pathspec temporary index too. Exporting it prevents dependency reads from WIP.
    const tree = run(root, 'git', ['write-tree']).trim();
    // SF2 (~4 s, the longest guard) reads src, tsconfig and its own lint lists, never STAGED_TABLES. It gets its own
    // export of the same tree so it starts first; no child reads a file another extraction rewrites.
    const couplingRoot = join(scratch, 'coupling');
    mkdirSync(couplingRoot);
    extractGuardArchive(root, tree, ['src', 'lint', 'tsconfig.json', 'package.json', 'scripts/generation-jobs.json', 'scripts/shard-coupling.mjs', 'scripts/legacy-shards.mjs'], couplingRoot);
    await materialize(couplingRoot);
    linkNodeModules(root, couplingRoot);
    const coupling = runAsync(couplingRoot, process.execPath, ['scripts/shard-coupling.mjs', '--check']);
    children.push(coupling);
    const manifest = changed.some((p) => /^src\/shards\/[^/]+\/manifest\.ts$/u.test(p));
    const predecessor = join(scratch, 'predecessor');
    mkdirSync(predecessor);
    const predecessorLists = PLATFORM_LISTS.filter((list) => !['lint/weapon-subclasses.json', 'lint/class-moves.json', 'lint/runtime-performance.json', 'lint/legacy-shards.json'].includes(list) || spawnSync('git', ['cat-file', '-e', `HEAD:${list}`], { cwd: root }).status === 0);
    extractGuardArchive(root, 'HEAD', [...predecessorLists, ...(changed.includes('lint/runtime-performance.json') || changed.includes('lint/class-moves.json') ? ['src/game', 'src/sdk', 'src/engine', 'src/shards'] : [])], predecessor);
    const snapshot = guardSnapshot(root, tree, scratch, paths);
    // Layout, legacy and manifest checks observe every shard. A manifest change also needs the generator scripts.
    extractGuardArchive(root, tree, ['src', 'scripts/generation-jobs.json', 'scripts/shard-coupling.mjs', 'scripts/legacy-shards.mjs', 'lint/legacy-shards.json', ...(manifest ? ['scripts/gen-shards.mjs', 'scripts/gen-shard-words.mjs'] : [])], scratch);
    await materialize(scratch); // Only staged hash-pinned JSON bytes may supplement the immutable source tree.
    linkNodeModules(root, scratch); // E432: @wildshard/* resolve to the snapshot, not the working tree
    const configFile = join(scratch, '.oxlintrc.json'), hard = hardRules(configFile);
    const config = readLintConfig(configFile);
    // No type info here, so type-aware rules never fire and their disable comments would read as unused: the full
    // type-aware lint (the push gate, CI) is what checks for unused directives.
    config.options = { ...config.options, typeAware: false, reportUnusedDisableDirectives: 'off' };
    const ratchet = JSON.parse(readFileSync(join(scratch, '.oxlintrc.ratchet.json'), 'utf8'));
    config.overrides.push({ files: ['src/**'], rules: ratchet.rules });
    const guardConfig = join(scratch, '.oxlintrc.precommit.json');
    writeFileSync(guardConfig, JSON.stringify(config));
    // G349: compare actual HEAD debt, not a stale ceiling awaiting regeneration.
    // Both sides observe immutable dependency trees and only this commit's paths.
    const debtStarted = performance.now(), beforeRoot = join(scratch, 'before');
    mkdirSync(beforeRoot);
    const beforeSnapshot = guardSnapshot(root, 'HEAD', beforeRoot, paths);
    extractGuardArchive(root, 'HEAD', ['scripts/generation-jobs.json'], beforeRoot);
    await materialize(beforeRoot);
    linkNodeModules(root, beforeRoot);
    const beforeConfig = join(beforeRoot, '.oxlintrc.precommit.json');
    writeFileSync(beforeConfig, JSON.stringify(config));
    const beforePaths = paths.filter(path => beforeSnapshot.paths.includes(path));
    const beforeLint = beforePaths.length > 0 ? spawnAsync(beforeRoot, process.execPath, [resolve(root, 'node_modules/oxlint/bin/oxlint'), '-c', beforeConfig, '--disable-nested-config', '-f', 'json', ...beforePaths], { ...process.env, WS_HTML_LINT_FILES: JSON.stringify(beforePaths) }) : null;
    if (beforeLint !== null) children.push(beforeLint);
    const existing = new Set(snapshot.paths);
    const lintPaths = paths.filter((p) => existing.has(p));
    const startLint = () => {
      if (lintPaths.length === 0) return null;
      const started = performance.now();
      return spawnAsync(scratch, process.execPath, [resolve(root, 'node_modules/oxlint/bin/oxlint'), '-c', guardConfig, '--disable-nested-config', '-f', 'json', ...lintPaths], { ...process.env, WS_HTML_LINT_FILES: JSON.stringify(lintPaths) }).then(result => {
        console.log(`precommit-guards: source lint ${((performance.now() - started) / 1000).toFixed(3)}s`);
        return result;
      });
    };
    let lint = startLint();
    if (lint !== null) children.push(lint);
    if (inputsDone !== undefined && inputsDone !== '') {
      // G367: index-reading checks see the producer's final index. Only source-independent tables may overlay `tree`.
      console.log('precommit-guards: waiting for final inputs');
      const status = await inputsStatus(inputsDone);
      if (status !== 0) throw new Error('Architecture guards stopped: scripts/precommit-inputs.mjs failed');
      const final = run(root, 'git', ['write-tree']).trim();
      if (final !== tree) {
        const moved = run(root, 'git', ['diff-tree', '-r', '--no-renames', '--name-only', '-z', tree, final]).split('\0').filter(Boolean);
        const witnesses = moved.filter(isWitnessManifest);
        let producedWitness = false;
        try { producedWitness = witnesses.length > 0 && verifyCommitProduced(root, final, witnesses, tree); }
        catch { /* Unbound/corrupt receipts require the full final-tree guard. */ }
        const overlay = moved.every(path => {
          if (!STAGED_TABLES.has(path) && path !== 'lint/ratchet.json' && !(producedWitness && isWitnessManifest(path))) return false;
          if (spawnSync('git', ['cat-file', '-e', `${tree}:${path}`], { cwd: root }).status !== 0
            || spawnSync('git', ['cat-file', '-e', `${final}:${path}`], { cwd: root }).status !== 0) return false;
          return canOverlayGuardTable(path, run(root, 'git', ['show', `${tree}:${path}`]), run(root, 'git', ['show', `${final}:${path}`]), producedWitness);
        });
        if (!overlay) {
          await Promise.allSettled(children);
          rmSync(scratch, { recursive: true, force: true });
          await precommitGuards(root, '');
          return;
        }
        // Lint vocabulary changes can alter a diagnostic on unchanged source.
        // Settle its reader before replacing tables, then lint the final words.
        const vocabularyChanged = moved.some(path => path === 'lint/ask-ids.json' || path === 'lint/shard-words.generated.json');
        if (vocabularyChanged) await Promise.allSettled([lint]);
        console.log(`precommit-guards: overlay ${moved.length} final tables; source analysis retained`);
        for (const path of moved) {
          // Witness outcomes are unchanged and outside guardSnapshot's source
          // inventory. Their exact produced headers need no source materialization.
          if (isWitnessManifest(path)) continue;
          const target = join(scratch, path), present = spawnSync('git', ['cat-file', '-e', `${final}:${path}`], { cwd: root }).status === 0;
          if (present) writeFileSync(target, spawnSync('git', ['show', `${final}:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).stdout);
          else rmSync(target, { force: true });
        }
        if (vocabularyChanged) {
          lint = startLint();
          if (lint !== null) children.push(lint);
        }
      }
    }
    const frozen = legacyInventory(scratch);
    const counts = {}, failures = [...checkPlatformRatchets(predecessor, scratch), ...checkLegacyInventory(scratch, frozen)];
    // Settle every child before reading any result, so a failure never leaves one running against a deleted scratch.
    const debt = Promise.allSettled([lint, beforeLint]).then(results => ({ results, seconds: (performance.now() - debtStarted) / 1000 }));
    const [coupled, checked] = await Promise.allSettled([coupling, debt]);
    if (coupled.status === 'rejected') throw coupled.reason;
    if (checked.status === 'rejected') throw checked.reason;
    const [linted, previous] = checked.value.results;
    if (linted.status === 'rejected') throw linted.reason;
    if (previous.status === 'rejected') throw previous.reason;
    const baseline = {};
    if (previous.value !== null) {
      if (previous.value.status !== 0 && previous.value.status !== 1) throw new Error(`HEAD oxlint failed: ${previous.value.stderr}`);
      const output = JSON.parse(previous.value.stdout);
      if (!Array.isArray(output.diagnostics)) throw new Error('HEAD oxlint returned no diagnostics');
      const beforeFrozen = legacyInventory(beforeRoot);
      for (const diagnostic of output.diagnostics) {
        const match = /^wildshard\(([^)]+)\)$/u.exec(diagnostic.code ?? '');
        const key = match ? `wildshard/${match[1]}` : null;
        if (!key || hard.has(key) || !Object.hasOwn(ratchet.rules, key) || registeredLegacyFile(beforeFrozen, diagnostic.filename)) continue;
        baseline[key] ??= {};
        baseline[key][diagnostic.filename] = (baseline[key][diagnostic.filename] ?? 0) + 1;
      }
    }
    const result = linted.value;
    if (result !== null) {
      if (result.status !== 0 && result.status !== 1) throw new Error(`oxlint failed (${result.status}): ${result.stderr}`);
      const output = JSON.parse(result.stdout);
      if (!Array.isArray(output.diagnostics)) throw new Error('oxlint returned no diagnostics');
      for (const diagnostic of output.diagnostics) {
        const match = /^wildshard\(([^)]+)\)$/u.exec(diagnostic.code ?? '');
        const key = match ? `wildshard/${match[1]}` : null;
        if (!key || hard.has(key)) { failures.push(`${diagnostic.filename}: ${diagnostic.code}: ${diagnostic.message}`); continue; }
        if (!Object.hasOwn(ratchet.rules, key)) throw new Error(`Unexpected custom diagnostic: ${diagnostic.code}`);
        if (registeredLegacyFile(frozen, diagnostic.filename)) continue;
        counts[key] ??= {};
        counts[key][diagnostic.filename] = (counts[key][diagnostic.filename] ?? 0) + 1;
      }
      if (result.status === 1 && output.diagnostics.length === 0) throw new Error(`oxlint failed without diagnostics: ${result.stderr}`);
    }
    const compared = compareCounts(baseline, counts, hard, paths, false, true, true);
    console.log(`precommit-debt: ${checked.value.seconds.toFixed(3)}s, ${paths.length} committed paths, shrink-only`);
    failures.push(...compared.failures);
    for (const warning of compared.warnings) console.warn(warning);
    if (slugs.size > 0) {
      const layout = JSON.parse(readFileSync(join(scratch, 'lint/shard-layout.json'), 'utf8'));
      failures.push(...checkShardLayout(shardEntries(snapshot.paths, slugs, Object.values(layout.dataHomes ?? {})), layout, snapshot.readSource, JSON.parse(readFileSync(join(scratch, 'lint/shard-platform.json'), 'utf8')).baseline, frozen));
    }
    if (manifest) {
      // Generator checks belong to the staged tree too (its small scripts were exported above, never public assets).
      // Runtime tables are intentionally untracked. Check committed ownership data and existing outputs,
      // initializing absent ephemeral tables in this index export during the same deterministic pass.
      run(scratch, process.execPath, ['--input-type=module', '-e', "import { genShards } from './scripts/gen-shards.mjs'; genShards(undefined, true, true);"]);
    }
    if (failures.length > 0) throw new Error(`Architecture pre-commit failed:\n${failures.join('\n')}`);
  } finally {
    await Promise.allSettled(children);
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const requirement=process.argv[2]==='--required-receipt' ? process.argv[3] : undefined;
    if (requirement!==undefined) beginGuardRequirement(resolve(import.meta.dirname,'..'),requirement);
    await precommitGuards();
    if (requirement!==undefined) completeGuardRequirement(resolve(import.meta.dirname,'..'),requirement);
  }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

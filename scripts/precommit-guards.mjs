// E362 AG20: inspect the commit's index tree, never the shared working copy.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { pathToFileURL } from 'node:url';
import { compareCounts, hardRules, readLintConfig } from './guard-counts.mjs';
import { checkShardLayout, shardEntries } from './check-shards.mjs';
import { checkPlatformRatchets, PLATFORM_LISTS } from './check-platform-ratchets.mjs';
import { guardSnapshot } from './guard-snapshot.mjs';
import { checkLegacyInventory, legacyInventory, registeredLegacyFile } from './legacy-shards.mjs';

const run = (cwd, command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
};

/** spawnSync's result shape, without blocking: the guards' slow children run side by side (SF74 W14). */
async function spawnAsync(cwd, command, args) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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

/**
 * The commit holds the shared index.lock for the whole pre-commit hook, so every second here is every agent's wait
 * (SF74 W14: 138 lock collisions in 6 h, ~6 s per src commit). Setup runs once; shard-coupling (~3 s) and oxlint then
 * run side by side on the same immutable export.
 */
export async function precommitGuards(root = resolve(import.meta.dirname, '..')) {
  if (process.env.SKIP_ARCH_GUARDS === '1') {
    appendFileSync(resolve(root, 'project/sweepguard-ledger.md'), `\n- ${new Date().toISOString()} SKIP_ARCH_GUARDS=1: architecture pre-commit checks bypassed.\n`);
    console.warn('Architecture guards skipped; recorded in project/sweepguard-ledger.md');
    return;
  }
  const changed = run(root, 'git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z']).split('\0').filter(Boolean);
  const paths = changed.filter((p) => /^src\/.*\.[jt]s$/u.test(p) && !p.endsWith('.generated.ts'));
  const slugs = new Set(changed.flatMap((p) => /^src\/shards\/([^/]+)\//u.exec(p)?.[1] ?? []));
  const platform = changed.some((p) => PLATFORM_LISTS.includes(p));
  if (paths.length === 0 && slugs.size === 0 && !platform) return;
  // macOS /var aliases /private/var; oxlint override globs must share the canonical cwd/config path.
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'wildshard-precommit-')));
  try {
    // write-tree observes Git's pathspec temporary index too. Exporting it prevents dependency reads from WIP.
    const tree = run(root, 'git', ['write-tree']).trim();
    const manifest = changed.some((p) => /^src\/shards\/[^/]+\/manifest\.ts$/u.test(p));
    const predecessor = join(scratch, 'predecessor');
    mkdirSync(predecessor);
    const predecessorLists = PLATFORM_LISTS.filter((list) => !['lint/weapon-subclasses.json', 'lint/runtime-performance.json', 'lint/legacy-shards.json'].includes(list) || spawnSync('git', ['cat-file', '-e', `HEAD:${list}`], { cwd: root }).status === 0);
    extractGuardArchive(root, 'HEAD', predecessorLists, predecessor);
    const snapshot = guardSnapshot(root, tree, scratch, paths);
    // SF2 observes every shard, including inherited context/class types outside changed files. A manifest change also
    // needs the generator scripts; one extraction, so no child reads a file while another tar rewrites it.
    extractGuardArchive(root, tree, ['src', 'scripts/shard-coupling.mjs', 'scripts/legacy-shards.mjs', 'lint/legacy-shards.json', ...(manifest ? ['scripts/gen-shards.mjs', 'scripts/gen-shard-words.mjs'] : [])], scratch);
    linkNodeModules(root, scratch); // E432: @wildshard/* resolve to the snapshot, not the working tree
    const baseline = JSON.parse(readFileSync(join(scratch, 'lint/ratchet.json'), 'utf8'));
    const configFile = join(scratch, '.oxlintrc.json'), hard = hardRules(configFile);
    const config = readLintConfig(configFile);
    // No type info here, so type-aware rules never fire and their disable comments would read as unused: the full
    // type-aware lint (the push gate, CI) is what checks for unused directives.
    config.options = { ...config.options, typeAware: false, reportUnusedDisableDirectives: 'off' };
    const ratchet = JSON.parse(readFileSync(join(scratch, '.oxlintrc.ratchet.json'), 'utf8'));
    config.overrides.push({ files: ['src/**'], rules: ratchet.rules });
    const guardConfig = join(scratch, '.oxlintrc.precommit.json');
    writeFileSync(guardConfig, JSON.stringify(config));
    const existing = new Set(snapshot.paths);
    const lintPaths = paths.filter((p) => existing.has(p));
    const frozen = legacyInventory(scratch);
    const counts = {}, failures = [...checkPlatformRatchets(predecessor, scratch), ...checkLegacyInventory(scratch, frozen)];
    const coupling = runAsync(scratch, process.execPath, ['scripts/shard-coupling.mjs', '--check']);
    const lint = lintPaths.length > 0 ? spawnAsync(scratch, process.execPath, [resolve(root, 'node_modules/oxlint/bin/oxlint'), '-c', guardConfig, '--disable-nested-config', '-f', 'json', ...lintPaths]) : null;
    // Settle every child before reading any result, so a failure never leaves one running against a deleted scratch.
    const [coupled, linted] = await Promise.allSettled([coupling, lint]);
    if (coupled.status === 'rejected') throw coupled.reason;
    if (linted.status === 'rejected') throw linted.reason;
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
    const compared = compareCounts(baseline, counts, hard, paths, false, true);
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
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { await precommitGuards(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

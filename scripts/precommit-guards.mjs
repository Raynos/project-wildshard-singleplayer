// E362 AG20: inspect the commit's index tree, never the shared working copy.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { pathToFileURL } from 'node:url';
import { compareCounts, hardRules, readLintConfig } from './guard-counts.mjs';
import { checkShardLayout, shardEntries } from './check-shards.mjs';
import { guardSnapshot } from './guard-snapshot.mjs';

const run = (cwd, command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
};

export function precommitGuards(root = resolve(import.meta.dirname, '..')) {
  if (process.env.SKIP_ARCH_GUARDS === '1') {
    appendFileSync(resolve(root, 'project/sweepguard-ledger.md'), `\n- ${new Date().toISOString()} SKIP_ARCH_GUARDS=1: architecture pre-commit checks bypassed.\n`);
    console.warn('Architecture guards skipped; recorded in project/sweepguard-ledger.md');
    return;
  }
  const changed = run(root, 'git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z']).split('\0').filter(Boolean);
  const paths = changed.filter((p) => /^src\/.*\.[jt]s$/u.test(p) && !p.endsWith('.generated.ts'));
  const slugs = new Set(changed.flatMap((p) => /^src\/shards\/([^/]+)\//u.exec(p)?.[1] ?? []));
  if (paths.length === 0 && slugs.size === 0) return;
  // macOS /var aliases /private/var; oxlint override globs must share the canonical cwd/config path.
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'wildshard-precommit-')));
  try {
    // write-tree observes Git's pathspec temporary index too. Exporting it prevents dependency reads from WIP.
    const tree = run(root, 'git', ['write-tree']).trim();
    const manifest = changed.some((p) => /^src\/shards\/[^/]+\/manifest\.ts$/u.test(p));
    const snapshot = guardSnapshot(root, tree, scratch, paths);
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
    const counts = {}, failures = [];
    if (lintPaths.length > 0) {
      const result = spawnSync(process.execPath, [resolve(root, 'node_modules/oxlint/bin/oxlint'), '-c', guardConfig, '--disable-nested-config', '-f', 'json', ...lintPaths], { cwd: scratch, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      if (result.error) throw result.error;
      if (result.status !== 0 && result.status !== 1) throw new Error(`oxlint failed (${result.status}): ${result.stderr}`);
      const output = JSON.parse(result.stdout);
      if (!Array.isArray(output.diagnostics)) throw new Error('oxlint returned no diagnostics');
      for (const diagnostic of output.diagnostics) {
        const match = /^wildshard\(([^)]+)\)$/u.exec(diagnostic.code ?? '');
        const key = match ? `wildshard/${match[1]}` : null;
        if (!key || hard.has(key)) { failures.push(`${diagnostic.filename}: ${diagnostic.code}: ${diagnostic.message}`); continue; }
        if (!Object.hasOwn(ratchet.rules, key)) throw new Error(`Unexpected custom diagnostic: ${diagnostic.code}`);
        counts[key] ??= {};
        counts[key][diagnostic.filename] = (counts[key][diagnostic.filename] ?? 0) + 1;
      }
      if (result.status === 1 && output.diagnostics.length === 0) throw new Error(`oxlint failed without diagnostics: ${result.stderr}`);
    }
    const compared = compareCounts(baseline, counts, hard, paths);
    failures.push(...compared.failures);
    for (const warning of compared.warnings) console.warn(warning);
    if (slugs.size > 0) failures.push(...checkShardLayout(shardEntries(snapshot.paths, slugs), JSON.parse(readFileSync(join(scratch, 'lint/shard-layout.json'), 'utf8')), snapshot.readSource));
    if (manifest) {
      // Generator checks belong to the staged tree too; export only their small scripts, never public assets.
      const scripts = run(root, 'git', ['archive', tree, '--', 'src', 'scripts/gen-shards.mjs', 'scripts/gen-shard-words.mjs'], { encoding: 'buffer' });
      run(root, 'tar', ['-xf', '-', '-C', scratch], { input: scripts });
      // Runtime tables are intentionally untracked. Check committed ownership data and existing outputs,
      // initializing absent ephemeral tables in this index export during the same deterministic pass.
      run(scratch, process.execPath, ['--input-type=module', '-e', "import { genShards } from './scripts/gen-shards.mjs'; genShards(undefined, true, true);"]);
    }
    if (failures.length > 0) throw new Error(`Architecture pre-commit failed:\n${failures.join('\n')}`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { precommitGuards(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

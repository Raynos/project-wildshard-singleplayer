// G636: parallel exact-source checks within one five-second wall budget.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { linkNodeModules } from './link-node-modules.mjs';
import { commitGuards, runCommitJobs } from './precommit-jobs.mjs';

/** Check staged text only; no mirror, generator, app build or related walk.
 * @param {string} [root] @param {string} [executable] */
export async function precommitInputs(root = resolve(import.meta.dirname, '..'), executable = resolve(root, 'node_modules/.bin/oxlint')) {
  const started = performance.now(), deadline = started + 5_000;
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const initial = git(['ls-files', '--stage', '-z']);
  const changed = git(['diff', '--cached', '--name-only', '-z', '--no-renames', '--diff-filter=ACMRD']).split('\0').filter(Boolean);
  const deleted = git(['diff', '--cached', '--name-only', '-z', '--no-renames', '--diff-filter=D']).split('\0').filter(Boolean);
  const source = changed.filter(path => /\.[cm]?[jt]sx?$/u.test(path) && !deleted.includes(path));
  const config = initial.includes('\t.oxlintrc.json\0') ? git(['show', ':.oxlintrc.json']) : '{}';
  const patterns = /"ignorePatterns"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1] ?? '';
  const ignored = [...patterns.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
  const files = source.filter(path => !ignored.some(pattern => {
    if (path.startsWith(pattern)) return true;
    return !pattern.slice(0, -1).includes('/') && path.includes(`/${pattern}`);
  }));
  const defer = () => {
    if (files.length === 0) return;
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    const path = resolve(common, 'push-deferred-types.json');
    const pending = existsSync(path) ? v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync(path, 'utf8'))) : {};
    for (const file of files) {
      const blob = git(['rev-parse', `:${file}`]).trim();
      pending[file] = [...new Set([...(Object.hasOwn(pending, file) ? pending[file] : []), blob])];
    }
    const temporary = `${path}.${process.pid}`;
    writeFileSync(temporary, JSON.stringify(pending)); renameSync(temporary, path);
  };
  const same = files.length > 0 && git(['diff', '--name-only', '--', ...files]).trim() === '';
  /** @type {import('./precommit-jobs.mjs').CommitJob[]} */
  const early = [];
  if (existsSync(resolve(root, 'scripts/repo-size.mjs'))) early.push({ name: 'storage', command: [process.execPath, 'scripts/repo-size.mjs', '--index'] });
  if (same) early.push({ name: 'typed lint', command: [executable, '--type-check', '--type-aware', '-c', '.oxlintrc.json', ...files] });
  else if (files.length > 0) { defer(); console.warn('pre-commit: staged patch differs from working files; exact typed checks deferred to push'); }
  const running = runCommitJobs(root, early, deadline);
  let tree;
  try {
    /** @type {import('./precommit-jobs.mjs').CommitResult[]} */
    let checked = [];
    if (changed.length > 0) {
      mkdirSync(resolve(root, 'tmp'), { recursive: true });
      tree = mkdtempSync(resolve(root, 'tmp/commit-source-'));
      const preparation = await runCommitJobs(root, [{ name: 'staged source', command: ['python3', resolve(import.meta.dirname, 'precommit-source.py'), root, tree,
        String((Date.now() + Math.max(0, deadline - performance.now())) / 1000)] }], deadline);
      const failed = preparation.find(result => result.code !== 0);
      if (failed !== undefined) throw new Error(`${failed.name}: ${failed.output || 'five-second deadline exceeded'}`);
      linkNodeModules(root, tree);
      writeFileSync(resolve(tree, '.commit-files.json'), JSON.stringify(files));
      writeFileSync(resolve(tree, '.commit-deleted.json'), JSON.stringify(deleted));
      // Immutable predecessor allowance; the candidate cannot grant itself debt.
      const policy = 'lint/ratchet.json';
      if (existsSync(resolve(tree, policy))) {
        const baseline = execFileSync('git', ['show', `HEAD:${policy}`], { cwd: root, encoding: 'utf8' });
        writeFileSync(resolve(tree, '.commit-baseline-ratchet.json'), baseline);
      }
      const stagedWorker = resolve(tree, 'scripts/precommit-checks.mjs');
      const worker = existsSync(stagedWorker) ? stagedWorker : resolve(import.meta.dirname, 'precommit-checks.mjs');
      const jobs = [];
      if (files.length > 0) jobs.push({ name: 'fast lint', command: [process.execPath, worker, 'fast', executable] });
      if (existsSync(resolve(tree, policy))) {
        jobs.push({ name: 'closed components', command: [process.execPath, worker, 'closed'] });
        jobs.push({ name: 'ratchet', command: [process.execPath, worker, 'ratchet', executable] });
      }
      if (deleted.length > 0) jobs.push({ name: 'deleted paths', command: [process.execPath, worker, 'deleted'] });
      const guards = commitGuards(changed).filter(file => existsSync(resolve(tree, file)));
      if (guards.length > 0) jobs.push({ name: 'inventory guards', command: [process.execPath, resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'scripts/vitest-push-guards.config.ts', ...guards] });
      checked = await runCommitJobs(tree, jobs, deadline);
    }
    const results = [...await running, ...checked];
    const failures = [];
    for (const result of results) {
      if (result.output !== '') console.error(result.output.trimEnd());
      if (result.name === 'typed lint' && result.timedOut && !/\berror (?:[a-z]+\(|[a-z]+\/)/u.test(result.output)) {
        defer(); console.warn('pre-commit: typed check reached the five-second wall cap; exact blobs deferred to push');
      } else if (result.code !== 0) failures.push(`${result.name}: ${result.timedOut ? 'five-second wall cap exceeded' : 'refused'}`);
    }
    if (git(['ls-files', '--stage', '-z']) !== initial) throw new Error('Commit index changed during checks');
    if (same && git(['diff', '--name-only', '--', ...files]).trim() !== '') throw new Error('Commit inputs changed during checks');
    if (failures.length > 0) throw new Error(failures.join('\n'));
    console.info(`pre-commit: parallel checks ${(performance.now() - started).toFixed(0)} ms`);
  } finally { await running; if (tree !== undefined) rmSync(tree, { recursive: true, force: true }); }
}

if (import.meta.main) {
  try { await precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

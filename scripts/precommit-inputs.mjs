// G636: parallel exact-source checks within one five-second wall budget.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import * as v from 'valibot';
import { parseSync } from 'vite';
import { ratchetApprovalFailures } from './ratchet-approval.mjs';
import { linkNodeModules } from './link-node-modules.mjs';
import { commitCheckFailed, commitGuards, runCommitJobs } from './precommit-jobs.mjs';

/** Only exact declared generated imports may be absent from a cold sealed
 * snapshot. Ordinary missing modules remain failures of the selected guard.
 * @param {string} root @param {string} guard @returns {string[]} */
export function missingInventoryGeneration(root, guard) {
  if(!existsSync(resolve(root,'scripts/generation-jobs.json'))||!existsSync(resolve(root,'scripts/source-generation-outputs.json')))return [];
  const catalogue=v.parse(v.object({jobs:v.array(v.object({outputs:v.array(v.string())}))}),JSON.parse(readFileSync(resolve(root,'scripts/generation-jobs.json'),'utf8')));
  const source=v.parse(v.object({producers:v.record(v.string(),v.array(v.string()))}),JSON.parse(readFileSync(resolve(root,'scripts/source-generation-outputs.json'),'utf8')));
  const generated=new Set([...catalogue.jobs.flatMap(job=>job.outputs),...Object.values(source.producers).flat()]);
  const parsed=parseSync(guard,readFileSync(resolve(root,guard),'utf8'));
  if(parsed.errors.length>0)throw new Error(`Invalid inventory guard: ${guard}`);
  const missing=[];
  for(const row of parsed.program.body)if(row.type==='ImportDeclaration'&&row.source.value.startsWith('.')) {
    const target=posix.normalize(posix.join(posix.dirname(guard),row.source.value));
    const file=[target,`${target}.ts`,`${target}.json`,`${target}.js`].find(name=>generated.has(name));
    if(file!==undefined&&!existsSync(resolve(root,file)))missing.push(file);
  }
  return [...new Set(missing)];
}

/** Staged guards plus CF1 related tests; no mirror, generator or app build.
 * @param {string} [root] @param {string} [executable] */
export async function precommitInputs(root = resolve(import.meta.dirname, '..'), executable = resolve(root, 'node_modules/.bin/oxlint')) {
  const started = performance.now(), deadline = started + 5_000;
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 });
  const initial = git(['ls-files', '--stage', '-z']);
  const changed = git(['diff', '--cached', '--name-only', '-z', '--no-renames', '--diff-filter=ACMRD']).split('\0').filter(Boolean);
  const deleted = git(['diff', '--cached', '--name-only', '-z', '--no-renames', '--diff-filter=D']).split('\0').filter(Boolean);
  const sourcePolicy = changed.some(path => path.startsWith('src/') ? true : path === 'lint/ratchet.json');
  const guards = commitGuards(changed);
  if (changed.includes('lint/ratchet.json')) {
    const before = JSON.parse(git(['show', 'HEAD:lint/ratchet.json']));
    const after = JSON.parse(git(['show', ':lint/ratchet.json']));
    const failures = ratchetApprovalFailures(before, after, process.env.WS_COMMIT_MESSAGE ?? '');
    if (failures.length > 0) throw new Error(failures.join('\n'));
  }
  const source = changed.filter(path => /\.[cm]?[jt]sx?$/u.test(path) && !deleted.includes(path));
  const config = initial.includes('\t.oxlintrc.json\0') ? git(['show', ':.oxlintrc.json']) : '{}';
  const patterns = /"ignorePatterns"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1] ?? '';
  const ignored = [...patterns.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
  const files = source.filter(path => !ignored.some(pattern => {
    if (posix.matchesGlob(path, pattern) || path.startsWith(pattern)) return true;
    return !pattern.slice(0, -1).includes('/') && path.includes(`/${pattern}`);
  }));
  const recordDeferred = (/** @type {string} */ name, /** @type {string[]} */ paths) => {
    if (paths.length === 0) return;
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    const path = resolve(common, name);
    const pending = existsSync(path) ? v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync(path, 'utf8'))) : {};
    for (const file of paths) {
      const blob = git(['rev-parse', `:${file}`]).trim();
      pending[file] = [...new Set([...(Object.hasOwn(pending, file) ? pending[file] : []), blob])];
    }
    const temporary = `${path}.${process.pid}`;
    writeFileSync(temporary, JSON.stringify(pending)); renameSync(temporary, path);
  };
  const defer = (check = 'typed lint') => {
    recordDeferred('push-deferred-types.json', files);
    if (sourcePolicy && ['staged source', 'closed components', 'ratchet'].includes(check))
      recordDeferred('push-deferred-policy.json', changed.filter(path => !deleted.includes(path)));
  };
  const same = files.length > 0 && git(['diff', '--name-only', '--', ...files]).trim() === '';
  /** @type {import('./precommit-jobs.mjs').CommitJob[]} */
  const early = [];
  if (existsSync(resolve(root, 'scripts/repo-size.mjs'))) early.push({ name: 'storage', command: [process.execPath, 'scripts/repo-size.mjs', '--index'] });
  if (same) early.push({ name: 'typed lint', command: [executable, '--type-aware', '-c', '.oxlintrc.json', ...files] });
  else if (files.length > 0) { defer(); console.warn('pre-commit: staged patch differs from working files; exact typed checks deferred to push'); }
  // Inspect exact staged JSON and generated-source declarations, including
  // ignored generated TS that ordinary lint intentionally never selects.
  /** @type {string | undefined} */
  let binaryTree;
  if (changed.some(path => path.endsWith('.json') || path.startsWith('src/') || path === 'scripts/generated-source.mjs')
    && (initial.includes('\tlint/no-binary-json.json\0') || changed.includes('lint/no-binary-json.json'))) {
    mkdirSync(resolve(root, 'tmp'), { recursive: true });
    binaryTree = mkdtempSync(resolve(root, 'tmp/commit-binary-'));
    const checker = resolve(binaryTree, 'no-binary-json.mjs');
    writeFileSync(checker, git(['show', ':scripts/no-binary-json.mjs']));
    if (initial.includes('\tscripts/generated-source.mjs\0')) writeFileSync(resolve(binaryTree, 'generated-source.mjs'), git(['show', ':scripts/generated-source.mjs']));
    early.push({ name: 'binary JSON', command: [process.execPath, checker, '--staged'] });
  }
  const running = runCommitJobs(root, early, deadline);
  /** @type {string | undefined} */
  let tree;
  try {
    /** @type {import('./precommit-jobs.mjs').CommitResult[]} */
    let checked = [];
    if (files.length > 0 || changed.some(path => /^(?:src|scripts|test|lint)\//u.test(path))) {
      mkdirSync(resolve(root, 'tmp'), { recursive: true });
      tree = mkdtempSync(resolve(root, 'tmp/commit-source-'));
      const preparation = await runCommitJobs(root, [{ name: 'staged source', command: ['python3', resolve(import.meta.dirname, 'precommit-source.py'), root, tree,
        String((Date.now() + Math.max(0, deadline - performance.now())) / 1000), '-',
        JSON.stringify({ files, changed, guards, closed: sourcePolicy, deleted: deleted.length > 0 })] }], deadline);
      const failed = preparation.find(result => result.code !== 0);
      if (failed !== undefined && commitCheckFailed(failed)) throw new Error(`${failed.name}: ${failed.output}`);
      if (failed !== undefined) {
        defer('staged source'); console.warn('pre-commit: source preparation reached the five-second cap; cheap checks deferred to push/CI');
      } else {
      linkNodeModules(root, tree);
      writeFileSync(resolve(tree, '.commit-files.json'), JSON.stringify(files));
      writeFileSync(resolve(tree, '.commit-deleted.json'), JSON.stringify(deleted));
      // Immutable predecessor allowance; the candidate cannot grant itself debt.
      const policy = 'lint/ratchet.json';
      if (existsSync(resolve(tree, policy))) {
        const baseline = execFileSync('git', ['show', `HEAD:${policy}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 });
        writeFileSync(resolve(tree, '.commit-baseline-ratchet.json'), baseline);
        const sections = 'lint/custom-sections.json';
        if (execFileSync('git', ['ls-tree', '--name-only', 'HEAD', sections], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }).trim() === sections)
          writeFileSync(resolve(tree, '.commit-baseline-custom-sections.json'),
            execFileSync('git', ['show', `HEAD:${sections}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }));
      }
      const stagedWorker = resolve(tree, 'scripts/precommit-checks.mjs');
      const worker = existsSync(stagedWorker) ? stagedWorker : resolve(import.meta.dirname, 'precommit-checks.mjs');
      const jobs = [];
      if (files.length > 0) jobs.push({ name: 'fast lint', command: [process.execPath, worker, 'fast', executable] });
      if (sourcePolicy && existsSync(resolve(tree, policy))) {
        jobs.push({ name: 'closed components', command: [process.execPath, worker, 'closed'] });
        jobs.push({ name: 'ratchet', command: [process.execPath, worker, 'ratchet', executable, root] });
      }
      if (deleted.length > 0) jobs.push({ name: 'deleted paths', command: [process.execPath, worker, 'deleted'] });
      for (const file of guards) if (!existsSync(resolve(tree, file))) throw new Error(`Missing selected staged inventory guard: ${file}`);
      const readyGuards=[];
      for(const guard of guards) {
        const missing=missingInventoryGeneration(tree,guard);
        if(missing.length===0)readyGuards.push(guard);
        else {
          recordDeferred('push-deferred-inventory.json',[guard]);
          console.warn(`pre-commit: inventory guard ${guard} missing verified generated inputs: ${missing.join(', ')}; exact guard deferred to CI`);
        }
      }
      if (readyGuards.length > 0) jobs.push({ name: 'inventory guards', command: [process.execPath, resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'scripts/vitest-push-guards.config.ts', ...readyGuards] });
      checked = await runCommitJobs(tree, jobs, deadline);
      }
    }
    if (checked.length === 0 && guards.length > 0 && !changed.some(path => /^(?:src|scripts|test|lint)\//u.test(path)))
      console.warn('pre-commit: docs-only inventory checks deferred to push/CI');
    const results = [...await running, ...checked];
    const failures = [];
    for (const result of results) {
      if (result.output !== '') console.error(result.output.trimEnd());
      if ((result.timedOut || result.code === 124) && !commitCheckFailed(result)) {
        defer(result.name); console.warn(`pre-commit: ${result.name} reached the five-second wall cap; exact inputs deferred to push/CI`);
      } else if (result.code !== 0) failures.push(`${result.name}: ${result.timedOut ? 'five-second wall cap exceeded' : 'refused'}`);
    }
    if (git(['ls-files', '--stage', '-z']) !== initial) throw new Error('Commit index changed during checks');
    if (same && git(['diff', '--name-only', '--', ...files]).trim() !== '') throw new Error('Commit inputs changed during checks');
    if (failures.length > 0) throw new Error(failures.join('\n'));
    console.info(`pre-commit: parallel checks ${(performance.now() - started).toFixed(0)} ms`);
    // Shared hooks execute loose source. Keep a new CF1 implementation inert
    // until its defining helper has actually landed, never activate a draft.
    try {
      const relatedLanded = git(['ls-tree', '--name-only', 'HEAD', '--', 'scripts/precommit-related.mjs']).trim() === 'scripts/precommit-related.mjs';
      if (!relatedLanded) console.info('CF1: inactive until the defining helper lands');
      else {
        const { commitRelated } = await import('./precommit-related.mjs');
        await commitRelated(root, changed);
        if (git(['ls-files', '--stage', '-z']) !== initial)
          console.warn('CF1 DEFERRED TO CI: candidate index changed during related checks; no exact related proof');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'CommitRelatedRefusalError') throw error;
      console.warn(`CF1 DEFERRED TO CI: hook tooling: ${String(error)}`);
    }
  } finally { await running; if (binaryTree !== undefined) rmSync(binaryTree, { recursive: true, force: true }); if (tree !== undefined) rmSync(tree, { recursive: true, force: true }); }
}

if (import.meta.main) {
  try { await precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

// G367: build the exact temporary/private index, never an agent's working copy.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { saveCommitInputs } from './commit-inputs.mjs';

/** Top-level folders no generator reads; the export leaves them out (4 GB of mockups and receipts). */
const UNEXPORTED = new Set(['art', 'progress', 'sources', 'ios', 'android', '.claude']);

/** @param {string} root @param {string[]} args @param {{env?: NodeJS.ProcessEnv, input?: string | Uint8Array}} [options] */
const gitIn = (root, args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options }).trim();

/** The staged tree without UNEXPORTED, as a tree object (one `mktree` over the top level). @param {string} root @param {string} tree */
function exportTree(root, tree) {
  const rows = gitIn(root, ['ls-tree', '-z', tree]).split('\0').filter(row => row !== '' && !UNEXPORTED.has(row.slice(row.indexOf('\t') + 1)));
  return gitIn(root, ['mktree', '-z'], { input: `${rows.join('\0')}\0` });
}

/** A fresh export of `tree` in a private temporary folder (the fallback when the persistent export is busy). */
function freshExport(/** @type {string} */ root, /** @type {string} */ tree) {
  const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-commit-inputs-')));
  const archive = resolve(scratch, 'source.tar');
  gitIn(root, ['archive', tree, '--output', archive]);
  execFileSync('tar', ['-xf', archive, '-C', scratch]);
  rmSync(archive);
  return { dir: scratch, release: () => { rmSync(scratch, { recursive: true, force: true }); } };
}

const alive = (/** @type {number} */ pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error instanceof Error && 'code' in error && error.code === 'EPERM'; } };

/** One lease on the checkout's persistent export (`<git-common-dir>/commit-export`), or null when another commit holds it. */
function lease(/** @type {string} */ base) {
  const lock = `${base}.lock`, owner = join(lock, 'pid');
  for (let attempt = 0; attempt < 2; attempt++) {
    try { mkdirSync(lock); writeFileSync(owner, String(process.pid)); return () => { rmSync(lock, { recursive: true, force: true }); }; }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      let pid = Number.NaN;
      try { pid = Number(readFileSync(owner, 'utf8')); } catch { /* holder still writing its pid */ }
      if (!Number.isSafeInteger(pid) || alive(pid)) return null;
      rmSync(lock, { recursive: true, force: true }); // a crashed commit's lease
    }
  }
  return null;
}

/**
 * The staged tree, exactly, in a persistent folder Git updates in place (bench-max 2026-10-13: the full archive and
 * extraction of ~0.9 GB cost 3-6 s per commit). Before each update every tracked file is verified against the export's
 * own index and restored, and every untracked file (the previous run's outputs) is removed, so the folder holds exactly
 * `git archive <tree>` minus UNEXPORTED. Any failure rebuilds it from scratch; a concurrent commit takes a fresh export.
 * @param {string} root @param {string} tree
 */
function stagedExport(root, tree) {
  const common = gitIn(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const base = resolve(realpathSync(common), 'commit-export');
  const release = lease(base);
  if (release === null) return freshExport(root, exportTree(root, tree));
  try {
    const target = exportTree(root, tree);
    const env = { ...process.env, GIT_INDEX_FILE: `${base}.index` };
    delete env.GIT_WORK_TREE;
    const git = (/** @type {string[]} */ args, /** @type {string | undefined} */ input) => gitIn(root, ['--work-tree', base, ...args], { env, input });
    const rebuild = () => {
      rmSync(base, { recursive: true, force: true }); rmSync(`${base}.index`, { force: true }); rmSync(`${base}.index.lock`, { force: true });
      mkdirSync(base);
      git(['read-tree', target]);
      git(['checkout-index', '--all', '--force', '-u']);
    };
    try {
      if (!existsSync(base) || !existsSync(`${base}.index`)) rebuild();
      else {
        git(['update-index', '-q', '--refresh', '--unmerged', '--ignore-missing']);
        const dirty = git(['diff-files', '--name-only', '-z']);
        if (dirty !== '') git(['checkout-index', '--force', '-u', '-z', '--stdin'], dirty);
        git(['clean', '-fdxq']);
        git(['read-tree', '-m', '-u', target]);
        if (git(['diff-files', '--name-only']) !== '' || git(['write-tree']) !== target) rebuild();
      }
    } catch { rebuild(); }
    return { dir: base, release };
  } catch (error) { release(); throw error; }
}

export function precommitInputs(root = resolve(import.meta.dirname, '..')) {
const git = (/** @type {string[]} */ args, /** @type {Uint8Array | undefined} */ input) => gitIn(root, args, { input });
const paths = git(['diff', '--cached', '--name-only'], undefined).split('\n').filter(Boolean);
if (paths.some(path => /^(src|scripts|lint|public|test|music|sfx)\//u.test(path) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(path))) {
  const started = performance.now(), before = git(['write-tree'], undefined);
  const exported = stagedExport(root, before), scratch = exported.dir;
  const ready = performance.now();
  try {
    linkNodeModules(root, scratch);
    execFileSync(process.execPath, ['scripts/gen.mjs', '--build-inputs'], { cwd: scratch, stdio: 'inherit' });
    const generated = performance.now();
    const tracked = new Set(git(['ls-tree', '-r', '--name-only', before], undefined).split('\n'));
    // Only these declared tracked tables are written by the boot generator.
    const tables = ['lint/ask-ids.json', 'lint/shard-words.generated.json'];
    for (const file of tables) {
      const bytes = readFileSync(resolve(scratch, file));
      if (bytes.equals(execFileSync('git', ['show', `${before}:${file}`], { cwd: root }))) continue;
      const blob = git(['hash-object', '-w', '--stdin'], bytes);
      git(['update-index', '--add', '--cacheinfo', '100644', blob, file], undefined);
    }
    const files = globSync('src/**/*.generated.*', { cwd: scratch }).map(String).filter(path => !tracked.has(path));
    /** @type {{jobs: {buildOutputs?: Record<string,string>}[]}} */
    const catalogue = JSON.parse(readFileSync(resolve(scratch, 'scripts/generation-jobs.json'), 'utf8'));
    for (const job of catalogue.jobs) for (const file of Object.keys(job.buildOutputs ?? {})) if (existsSync(resolve(scratch, file)) && !tracked.has(file)) files.push(file);
    const final = git(['write-tree'], undefined);
    saveCommitInputs(root, final, scratch, [...new Set(files)]);
    const seconds = (/** @type {number} */ from, /** @type {number} */ to) => ((to - from) / 1000).toFixed(3);
    console.log(`precommit-inputs: ${seconds(started, performance.now())}s (export ${seconds(started, ready)}s, gen ${seconds(ready, generated)}s, save ${seconds(generated, performance.now())}s); staged generation inputs cached`);
  } finally { exported.release(); }
}

}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

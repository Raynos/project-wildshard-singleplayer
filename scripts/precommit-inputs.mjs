// G367: build the exact temporary/private index, never an agent's working copy.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';
import { inputKey, restoreCommitInputs, saveCommitInputs } from './commit-inputs.mjs';
import { requiredGuardRules } from './guard-counts.mjs';
import { recordCommitProduced } from './commit-produced.mjs';

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
    /** @type {NodeJS.ProcessEnv} */
    const env = { ...process.env, GIT_INDEX_FILE: `${base}.index` };
    delete env.GIT_WORK_TREE;
    /** @param {string[]} args @param {string} [input] */
    const git = (args, input) => gitIn(root, ['--work-tree', base, ...args], { env, input });
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

export function precommitInputs(root = resolve(import.meta.dirname, '..'), /** @type {{guardRequirement?: string}} */ options = {}) {
const {guardRequirement}=options;
const git = (/** @type {string[]} */ args, /** @type {Uint8Array | undefined} */ input) => gitIn(root, args, { input });
const paths = git(['diff', '--cached', '--name-only'], undefined).split('\n').filter(Boolean);
if (paths.some(path => /^(src|scripts|lint|public|test|music|sfx)\//u.test(path) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(path))) {
  const started = performance.now(), before = git(['write-tree'], undefined), base = git(['rev-parse', 'HEAD'], undefined);
  const exported = stagedExport(root, before), scratch = exported.dir;
  const ready = performance.now();
  try {
    linkNodeModules(root, scratch);
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], undefined);
    // Producers run in an immutable filesystem export, not the caller's Git
    // checkout. Hook transport changes must not reach or steer that producer.
    const producerEnv = { ...process.env, WS_COMMIT_WITNESS_CACHE: resolve(common, 'commit-inputs/witnesses'), WS_PRECOMMIT_BOOT_CACHE: resolve(common, 'commit-inputs/boot'), WS_SHARD_PARSE_CACHE: resolve(common, 'commit-inputs/parse') };
    for (const key of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_PREFIX', 'WS_COMMIT_INTENT', 'WS_PRECOMMIT_INPUTS_DONE', 'SHLVL', '_']) delete producerEnv[key];
    if (existsSync(resolve(common, 'commit-inputs', `${inputKey(root, before)}.json`))) {
      restoreCommitInputs(root, before, scratch);
      console.log('precommit-inputs: verified generation cache');
    } else execFileSync(process.execPath, [...(existsSync(resolve(scratch, 'scripts/gen-boot-cache.mjs')) ? ['--import', './scripts/bake-loader.mjs', '--import', './scripts/gen-boot-cache.mjs'] : []), 'scripts/gen.mjs', '--build-inputs'], { cwd: scratch, stdio: 'inherit',
      env: producerEnv });
    const generated = performance.now();
    if (guardRequirement!==undefined) requiredGuardRules(scratch,guardRequirement,paths);
    /** @type {string[]} */
    let produced = [];
    if (existsSync(resolve(scratch, 'src/shards'))) {
      const result = resolve(scratch, '.commit-produced-paths.json');
      const producer = `import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {regenerateCheapBakes,refreshRecordedCommitInputs} from './scripts/precommit-bakes.mjs';
const files=await regenerateCheapBakes(process.cwd(),{url:process.env.WS_STAGED_MAP_URL,revision:process.env.WS_STAGED_MAP_REVISION,stagedPaths:JSON.parse(process.argv[2]),guardRequirement:process.argv[3]||undefined});
const catalogue=JSON.parse(readFileSync('scripts/generation-jobs.json','utf8'));
if(catalogue.jobs.some(job=>(job.inputRoots??[]).some(root=>files.some(file=>file===root||file.startsWith(root+'/')))))
execFileSync(process.execPath,[...(existsSync('scripts/gen-boot-cache.mjs')?['--import','./scripts/bake-loader.mjs','--import','./scripts/gen-boot-cache.mjs']:[]),'scripts/gen.mjs','--build-inputs'],{stdio:'inherit'});
const recorded=await refreshRecordedCommitInputs(process.cwd(),process.env.WS_COMMIT_WITNESS_CACHE);
writeFileSync(process.argv[1],JSON.stringify([...files,...recorded]));`;
      execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', producer, result, JSON.stringify(paths), guardRequirement ?? ''], { cwd: scratch, stdio: 'inherit',
        env: producerEnv });
      produced = JSON.parse(readFileSync(result, 'utf8'));
      if (!Array.isArray(produced) || produced.some(file => typeof file !== 'string' || file.includes('\\') || file.split('/').some(part => part === '' || part === '.' || part === '..'))) throw new Error('Invalid commit producer paths');
    }
    const baked = performance.now();
    const tracked = new Set(git(['ls-tree', '-r', '--name-only', before], undefined).split('\n'));
    // Only these declared tracked tables are written by the boot generator.
    const tables = ['lint/ask-ids.json', 'lint/shard-words.generated.json'];
    for (const file of new Set([...tables, ...produced])) {
      const bytes = readFileSync(resolve(scratch, file));
      const previous = spawnSync('git', ['show', `${before}:${file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
      if (previous.error) throw previous.error;
      if (previous.status !== 0 && tracked.has(file)) throw new Error(`Cannot read staged producer output: ${file}`);
      if (previous.status === 0 && bytes.equals(previous.stdout)) continue;
      const blob = git(['hash-object', '-w', '--stdin'], bytes);
      git(['update-index', '--add', '--cacheinfo', '100644', blob, file], undefined);
    }
    const files = globSync('src/**/*.generated.*', { cwd: scratch }).map(String).filter(path => !tracked.has(path));
    /** @type {{jobs: {buildOutputs?: Record<string,string>}[]}} */
    const catalogue = JSON.parse(readFileSync(resolve(scratch, 'scripts/generation-jobs.json'), 'utf8'));
    for (const job of catalogue.jobs) for (const file of Object.keys(job.buildOutputs ?? {})) if (existsSync(resolve(scratch, file)) && !tracked.has(file)) files.push(file);
    const final = git(['write-tree'], undefined);
    // An idempotent retry must retain the original source-to-output receipt.
    if (final !== before) recordCommitProduced(root, before, [...tables, ...produced], base);
    saveCommitInputs(root, final, scratch, [...new Set(files)]);
    const seconds = (/** @type {number} */ from, /** @type {number} */ to) => ((to - from) / 1000).toFixed(3);
    console.log(`precommit-inputs: ${seconds(started, performance.now())}s (export ${seconds(started, ready)}s, gen ${seconds(ready, generated)}s, bakes ${seconds(generated, baked)}s, save ${seconds(baked, performance.now())}s); staged generation inputs cached`);
  } finally { exported.release(); }
}

}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { precommitInputs(undefined,{guardRequirement:process.argv[2]==='--guard-required' ? process.argv[3] : undefined}); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

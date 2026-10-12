import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/** @param {string} root @param {string[]} args @param {NodeJS.ProcessEnv} [env] */
function git(root, args, env = process.env) {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
/** @param {string} root @param {string} lock @param {NodeJS.ProcessEnv} env */
function holder(root, lock, env) {
  const result = spawnSync('lsof', ['-t', lock], { encoding: 'utf8', timeout: 1000 });
  const candidate = result.error ? '' : result.stdout.trim().split('\n')[0] ?? '';
  const pid = candidate === '' ? '?' : candidate;
  let lane = '?';
  try {
    /** @type {unknown} */
    const row = JSON.parse(readFileSync(join(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'], env), 'commit-message-holder.json'), 'utf8'));
    if (typeof row === 'object' && row !== null && 'pid' in row && String(row.pid) === pid && 'lane' in row && typeof row.lane === 'string') lane = row.lane;
  } catch { /* An index owner need not hold a commit-message lock. */ }
  return `PID ${pid}, lane/pane ${lane}`;
}

/** Atomically align only unchanged generated entries, preserving all foreign stages.
 * Own Git's index.lock before inspecting or replacing the index; private updates never nest that lock.
 * @param {string} root
 * @param {readonly {file: string, before: string | null, after: string}[]} entries
 * @param {number} [waitMs]
 * @returns {Promise<string[]>} Entries whose working copies may be checked for synchronization.
 */
export async function alignGeneratedIndex(root, entries, waitMs = 30_000) {
  if (!Number.isFinite(waitMs) || waitMs <= 0 || waitMs > 30_000) throw new Error('Generated index wait must be in (0, 30000] ms');
  const baseEnv = { ...process.env };
  for (const key of git(root, ['rev-parse', '--local-env-vars']).split('\n')) delete baseEnv[key];
  const index = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index'], baseEnv), lock = `${index}.lock`;
  const started = performance.now();
  let announced = false, descriptor;
  while (descriptor === undefined) {
    try { descriptor = openSync(lock, 'wx'); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      if (!announced) {
        console.warn(`generated-index: waiting up to ${waitMs / 1000}s for ${lock} (${holder(root, lock, baseEnv)})`);
        announced = true;
      }
      if (performance.now() - started >= waitMs) throw new Error(`Generated index wait expired after ${waitMs / 1000}s; ${holder(root, lock, baseEnv)} still holds ${lock}; peer lock was preserved`, { cause: error });
      await sleep(Math.min(100, waitMs));
    }
  }
  let scratch;
  try {
    scratch = mkdtempSync(join(dirname(index), 'generated-index-'));
    const privateIndex = join(scratch, 'index'), env = { ...baseEnv, GIT_INDEX_FILE: privateIndex };
    if (existsSync(index)) copyFileSync(index, privateIndex);
    else git(root, ['read-tree', '--empty'], env);
    const aligned = [];
    for (const { file, before, after } of entries) {
      const current = git(root, ['ls-files', '--stage', '--', file], env);
      const expected = before === null ? '' : `100644 ${before} 0\t${file}`;
      if (current !== expected && current !== `100644 ${after} 0\t${file}`) {
        console.warn(`generated-index: preserved independently staged ${file}`);
        continue;
      }
      git(root, ['update-index', '--add', '--cacheinfo', '100644', after, file], env);
      aligned.push(file);
    }
    renameSync(privateIndex, index);
    return aligned;
  } finally {
    closeSync(descriptor);
    rmSync(lock);
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  }
}

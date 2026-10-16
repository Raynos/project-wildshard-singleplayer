#!/usr/bin/env node
// The shared index can retain an ancestor after a private-index landing. Clear
// only that obsolete stage: the working file must already equal HEAD, while the
// staged blob must be a different, previously committed version of that path.
// Always inspect the shared index, never the caller's private commit index.
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, openSync, renameSync, unlinkSync } from 'node:fs';

const env = { ...process.env };
delete env.GIT_INDEX_FILE;
/** @param {string[]} args @param {NodeJS.ProcessEnv} [environment] */
const git = (args, environment = env) => execFileSync('git', ['--literal-pathspecs', ...args], { env: environment, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
/** @param {string[]} args @param {NodeJS.ProcessEnv} [environment] */
function unchanged(args, environment = env) {
  const result = spawnSync('git', ['--literal-pathspecs', ...args], { env: environment, stdio: 'pipe' });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr.toString());
  return result.status === 0;
}
/** Read raw Git records without treating whitespace or newlines as path separators.
 * @param {string} raw @returns {{path: string, before: string, after: string, mode: string}[]} */
function records(raw) {
  const fields = raw.split('\0'), rows = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const header = fields.at(i)?.trim().split(/\s+/u);
    const path = fields.at(i + 1);
    if (header?.length !== 5 || path === undefined || header.at(0)?.startsWith(':') !== true) throw new Error('index-hygiene: unreadable Git record');
    const mode = header.at(1), before = header.at(2), after = header.at(3);
    if (mode === undefined || before === undefined || after === undefined) throw new Error('index-hygiene: incomplete Git record');
    rows.push({ path, before, after, mode });
  }
  return rows;
}

const head = git(['rev-parse', 'HEAD']).trim();
const staged = () => records(git(['diff-index', '--cached', '--raw', '-z', '--no-abbrev', '--no-renames', head]));
/** @param {{path: string, before: string, after: string, mode: string}} row */
const eligible = (row) => row.before !== row.after && /^(?:100(?:644|755)|120000)$/u.test(row.mode)
  && !/^0+$/u.test(row.after)
  && unchanged(['diff', '--quiet', '--no-ext-diff', '--no-textconv', head, '--', row.path]);
const possible = staged().filter(eligible);
if (possible.length > 0) {
  const historical = records(git(['log', '--format=', '--raw', '-z', '--no-abbrev', '--no-renames', head, '--', ...possible.map(row => row.path)]));
  const obsolete = possible.filter(row => historical.some(old => old.path === row.path && old.after === row.after));
  if (obsolete.length > 0) {
    const index = git(['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
    const lock = `${index}.lock`;
    let fd;
    try { fd = openSync(lock, 'wx'); } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      console.log('index-hygiene: shared index busy; leave stages unchanged');
    }
    if (fd !== undefined) {
      closeSync(fd);
      let published = false;
      try {
        // Hold Git's actual index lock while restoring into its private copy.
        // Re-read under that lock so a newly staged peer edit cannot be lost.
        copyFileSync(index, lock);
        const current = staged();
        const safe = obsolete.filter(row => current.some(now => now.path === row.path && now.after === row.after && now.mode === row.mode) && eligible(row));
        if (safe.length > 0 && git(['rev-parse', 'HEAD']).trim() === head) {
          git(['restore', '--source', head, '--staged', '--', ...safe.map(row => row.path)], { ...env, GIT_INDEX_FILE: lock });
          if (git(['rev-parse', 'HEAD']).trim() === head && safe.every(eligible)) {
            renameSync(lock, index);
            published = true;
            for (const row of safe) console.log(`index-hygiene: unstaged obsolete ${JSON.stringify(row.path)}`);
          }
        }
      } finally { if (!published) unlinkSync(lock); }
    }
  }
}

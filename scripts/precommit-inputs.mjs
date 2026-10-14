// G416: compiler and lint/layer checks on the actual private/pathspec staged tree.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';

/** Check source in an isolated index export; generated inputs remain build/cache outputs. */
export function precommitInputs(root = resolve(import.meta.dirname, '..')) {
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const changed = git(['diff', '--cached', '--name-only', '--no-renames']).split('\n').filter(Boolean);
  if (!changed.some(file => /^(src|scripts|lint|test|api|admin|drafts)\//u.test(file) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(file))) return;
  const scratch = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-staged-check-')));
  try {
    const archive = resolve(scratch, 'source.tar');
    execFileSync('git', ['archive', git(['write-tree']), '--output', archive], { cwd: root });
    execFileSync('tar', ['-xf', archive, '-C', scratch]); rmSync(archive);
    linkNodeModules(root, scratch);
    const env = { ...process.env };
    for (const key of git(['rev-parse', '--local-env-vars']).split('\n')) delete env[key];
    const run = (/** @type {string} */ command, /** @type {string[]} */ args) => execFileSync(command, args, { cwd: scratch, env, stdio: 'inherit' });
    run(process.execPath, ['scripts/gen.mjs', '--build-inputs']);
    const present = changed.filter(file => existsSync(resolve(scratch, file)) && /\.[cm]?[jt]sx?$/u.test(file));
    if (present.length > 0) {
      const input = resolve(scratch, '.staged-source-changes.json'); writeFileSync(input, JSON.stringify(present));
      run(process.execPath, ['scripts/local-gate-checks.mjs', 'types', input]);
      // oxlint exits 1 on 'No files found to lint' when every staged file is in its ignorePatterns (e.g. test/fixtures/).
      // .oxlintrc.json is JSONC (comments, globs with '/*'), so read only its ignorePatterns array.
      const ignoreList = /"ignorePatterns"\s*:\s*\[([^\]]*)\]/u.exec(readFileSync(resolve(scratch, '.oxlintrc.json'), 'utf8'))?.[1] ?? '';
      const ignored = [...ignoreList.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
      // gitignore-style: a pattern with an inner '/' is anchored at the root, otherwise it matches at any depth.
      const isIgnored = (/** @type {string} */ file) => ignored.some(pattern => pattern.slice(0, -1).includes('/')
        ? file.startsWith(pattern) : file.startsWith(pattern) || file.includes(`/${pattern}`));
      const lintable = present.filter(file => !isIgnored(file));
      if (lintable.length > 0) run('pnpm', ['exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', ...lintable]);
      run(process.execPath, ['scripts/check-graph.mjs', '--source-only']);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try { precommitInputs(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

// D9: one native invocation performs TypeScript diagnostics and typed lint.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Check only the named commit files. No mirror, generator, build or tests.
 * @param {string} [root] @param {string} [executable] */
export function precommitInputs(root = resolve(import.meta.dirname, '..'), executable = resolve(root, 'node_modules/.bin/oxlint')) {
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const changed = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0').filter(Boolean);
  const source = changed.filter(path => /\.[cm]?[jt]sx?$/u.test(path) && existsSync(resolve(root, path)));
  if (source.length === 0) return;
  const config = readFileSync(resolve(root, '.oxlintrc.json'), 'utf8');
  const patterns = /"ignorePatterns"\s*:\s*\[([^\]]*)\]/u.exec(config)?.[1] ?? '';
  const ignored = [...patterns.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
  const files = source.filter(path => !ignored.some(pattern => {
    if (path.startsWith(pattern)) return true;
    return !pattern.slice(0, -1).includes('/') && path.includes(`/${pattern}`);
  }));
  if (files.length === 0) return;
  execFileSync(executable, ['--type-check', '--type-aware', '-c', '.oxlintrc.json', ...files],
    { cwd: root, stdio: 'inherit', timeout: 5_000 });
  if (git(['diff', '--name-only', '--', ...files]).trim() !== '') throw new Error('Commit inputs changed during checks; retry');
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  try { precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

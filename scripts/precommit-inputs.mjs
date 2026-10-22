// D9: one native invocation performs TypeScript diagnostics and typed lint.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';

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
  const defer = () => {
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    const path = resolve(common, 'push-deferred-types.json');
    const pending = existsSync(path) ? v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync(path, 'utf8'))) : {};
    for (const file of files) {
      const blob = git(['rev-parse', `:${file}`]).trim();
      const previous = Object.hasOwn(pending, file) ? pending[file] : [];
      pending[file] = [...new Set([...previous, blob])];
    }
    const temporary = `${path}.${process.pid}`;
    writeFileSync(temporary, JSON.stringify(pending)); renameSync(temporary, path);
  };
  if (git(['diff', '--name-only', '--', ...files]).trim() !== '') {
    defer();
    console.warn('pre-commit: patched source differs from working files; exact staged typed checks run at pre-push');
    return;
  }
  const result = spawnSync(executable, ['--type-check', '--type-aware', '-c', '.oxlintrc.json', ...files],
    { cwd: root, encoding: 'utf8', timeout: 5_000 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (output !== '') console.error(output.trimEnd());
  if (result.error !== undefined && 'code' in result.error && result.error.code === 'ETIMEDOUT'
    && !/\berror (?:[a-z]+\(|[a-z]+\/)/u.test(output)) {
    defer();
    console.warn('pre-commit: typed check exceeded the soft 5 s budget; these exact files must pass at pre-push');
  } else if (result.status !== 0) throw result.error ?? new Error('Commit type/lint check refused');
  if (git(['diff', '--name-only', '--', ...files]).trim() !== '') throw new Error('Commit inputs changed during checks; retry');
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { precommitInputs(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

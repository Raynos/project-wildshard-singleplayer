// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real Git staging in an isolated Node fixture.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this tiny fixture owns and removes its files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the fixture inside the repository's ignored tmp directory.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Strip inherited Git overrides before entering the fixture repository.
import { env as processEnv } from 'node:process';
import { afterEach, expect, it } from 'vitest';

const script = resolve('scripts/index-hygiene.mjs');
const roots: string[] = [];
const env = { ...processEnv };
for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/index-hygiene-test-'));
  roots.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' });
  git('init', '--quiet');
  git('config', 'user.name', 'Index fixture');
  git('config', 'user.email', 'index@example.invalid');
  git('config', 'core.hooksPath', '/dev/null');
  const paths = ['stale file.txt', 'valid.txt', 'dirty.txt', 'unknown.txt'];
  for (const path of paths) writeFileSync(join(root, path), 'old\n');
  git('add', '--', ...paths);
  git('commit', '--quiet', '-m', 'old');
  const old = git('rev-parse', 'HEAD:stale file.txt').trim();
  for (const path of paths) writeFileSync(join(root, path), 'current\n');
  git('commit', '--quiet', '-am', 'current');
  return { root, git, old, run: (extra = {}) => execFileSync('node', [script], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' }) };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('clears only historical stages whose working file already equals HEAD', () => {
  const f = fixture();
  for (const path of ['stale file.txt', 'dirty.txt']) f.git('update-index', '--cacheinfo', `100644,${f.old},${path}`);
  writeFileSync(join(f.root, 'valid.txt'), 'new staged work\n');
  f.git('add', '--', 'valid.txt');
  writeFileSync(join(f.root, 'dirty.txt'), 'unfinished work\n');
  const unknown = f.git('hash-object', '-w', '--stdin');
  f.git('update-index', '--cacheinfo', `100644,${unknown.trim()},unknown.txt`);
  const before = f.git('diff', '--cached', '--raw');
  expect(before).toContain('stale file.txt');
  expect(f.run()).toBe('index-hygiene: unstaged obsolete "stale file.txt"\n');
  expect(f.git('diff', '--cached', '--name-only').trim().split('\n')).toEqual(['dirty.txt', 'unknown.txt', 'valid.txt']);
  expect(readFileSync(join(f.root, 'dirty.txt'), 'utf8')).toBe('unfinished work\n');
  expect(f.run()).toBe('');
});

it('leaves a private index untouched and respects a busy shared index', () => {
  const f = fixture(), privateIndex = join(f.root, '.git/private-index');
  execFileSync('git', ['read-tree', 'HEAD'], { cwd: f.root, env: { ...env, GIT_INDEX_FILE: privateIndex } });
  const privateBytes = readFileSync(privateIndex);
  f.git('update-index', '--cacheinfo', `100644,${f.old},stale file.txt`);
  writeFileSync(join(f.root, '.git/index.lock'), 'peer lock');
  expect(f.run()).toContain('shared index busy');
  expect(f.git('diff', '--cached', '--name-only').trim()).toBe('stale file.txt');
  expect(readFileSync(join(f.root, '.git/index.lock'), 'utf8')).toBe('peer lock');
  rmSync(join(f.root, '.git/index.lock'));
  expect(f.run({ GIT_INDEX_FILE: privateIndex })).toContain('unstaged obsolete');
  expect(readFileSync(privateIndex)).toEqual(privateBytes);
  expect(f.git('diff', '--cached', '--name-only')).toBe('');
  expect(spawnSync('git', ['diff', '--quiet', 'HEAD'], { cwd: f.root, env }).status).toBe(0);
});

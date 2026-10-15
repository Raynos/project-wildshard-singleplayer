// oxlint-disable-next-line import/no-nodejs-modules -- Commit into an owned throwaway Git repository.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Every write is confined to an owned fixture under ./tmp.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The mirror root comes from the fixture's environment.
import { env as processEnv } from 'node:process';
import { afterEach, expect, it } from 'vitest';
import { openMirror } from '../scripts/build-mirror.mjs';

const owned: string[] = [];
afterEach(() => { for (const dir of owned.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(): { repo: string; commit: (files: Record<string, string | null>) => string; env: NodeJS.ProcessEnv } {
  const scratch = resolve('tmp');
  mkdirSync(scratch, { recursive: true });
  const base = mkdtempSync(join(scratch, 'build-mirror-test-'));
  owned.push(base);
  const repo = join(base, 'repo');
  mkdirSync(join(repo, 'node_modules', '@wildshard'), { recursive: true });
  writeFileSync(join(repo, '.gitignore'), 'node_modules\ndist/\n');
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const commit = (files: Record<string, string | null>): string => {
    for (const [path, body] of Object.entries(files)) {
      if (body === null) { rmSync(join(repo, path)); continue; }
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), body);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  return { repo, commit, env: { ...processEnv, WILDSHARD_BUILD_MIRROR: join(base, 'mirror') } };
}

it('syncs only what differs, drops art/progress/sources, and leaves the checkout untouched', () => {
  const { repo, commit, env } = fixture();
  const first = commit({ 'src/a.ts': 'a1', 'src/b.ts': 'b1', 'src/keep.ts': 'k', 'index.html': 'i1', 'art/big.png': 'x', 'progress/p.png': 'x', 'sources/s.blend': 'x' });
  const second = commit({ 'src/a.ts': 'a2', 'src/b.ts': null });

  const one = openMirror(first, { repo, env });
  one.release();
  expect(readFileSync(join(one.dir, 'src/b.ts'), 'utf8')).toBe('b1');
  expect(['art', 'progress', 'sources'].filter((d) => existsSync(join(one.dir, d)))).toEqual([]);
  const untouched = lstatSync(join(one.dir, 'src/keep.ts')).ino;
  writeFileSync(join(one.dir, 'index.html'), 'tampered');
  writeFileSync(join(one.dir, 'src/stray.ts'), 'left behind');
  mkdirSync(join(one.dir, 'dist'));
  writeFileSync(join(one.dir, 'dist/out.js'), 'kept');

  const two = openMirror(second, { repo, env });
  two.release();
  expect(two.dir).toBe(one.dir);
  expect(readFileSync(join(two.dir, 'src/a.ts'), 'utf8')).toBe('a2');
  expect(existsSync(join(two.dir, 'src/b.ts'))).toBe(false);
  expect(existsSync(join(two.dir, 'src/stray.ts'))).toBe(false);
  expect(readFileSync(join(two.dir, 'index.html'), 'utf8')).toBe('i1');
  expect(readFileSync(join(two.dir, 'dist/out.js'), 'utf8')).toBe('kept');
  expect(lstatSync(join(two.dir, 'src/keep.ts')).ino).toBe(untouched);
  expect(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' })).toBe('');
  expect(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: two.dir, encoding: 'utf8' }).status).not.toBe(0);

  const full = openMirror(second, { repo, env, slot: 'full', full: true });
  full.release();
  expect(readFileSync(join(full.dir, 'art/big.png'), 'utf8')).toBe('x');
});

it('links workspace packages to the mirror sources, takes over a dead lock and queue ticket, rejects bad slots', () => {
  const { repo, commit, env } = fixture();
  const sha = commit({ 'src/engine/package.json': '{"name":"@wildshard/engine"}', 'src/engine/index.ts': 'e' });
  const lock = join(env['WILDSHARD_BUILD_MIRROR'] ?? '', 'check.lock');
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, 'owner'), '999999\n');
  const queue = join(env['WILDSHARD_BUILD_MIRROR'] ?? '', 'check.queue');
  mkdirSync(queue, { recursive: true });
  writeFileSync(join(queue, '000000000000001-999999'), '');
  const mirror = openMirror(sha, { repo, env });
  expect(readdirSync(queue)).toEqual([]);
  expect(resolve(join(mirror.dir, 'node_modules', '@wildshard'), readlinkSync(join(mirror.dir, 'node_modules', '@wildshard', 'engine')))).toBe(join(mirror.dir, 'src', 'engine'));
  mirror.release();
  expect(existsSync(lock)).toBe(false);
  expect(() => openMirror(sha, { repo, env, slot: '../escape' })).toThrow(/invalid slot/u);
});

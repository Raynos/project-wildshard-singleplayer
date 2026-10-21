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
  const inventory: unknown=JSON.parse(readFileSync(processEnv['WS_GENERATION_TREE_FILES'] ?? '', 'utf8'));
  expect(inventory).toMatchObject({root:one.dir});
  expect(inventory).toHaveProperty('files',expect.arrayContaining(['src/a.ts','src/keep.ts']));
  expect(processEnv['WS_GENERATION_TREE_ROOT']).toBe(one.dir);
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

  const full = openMirror(second, { repo, env, slot: 'check2', full: true });
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
  expect(() => openMirror(sha, { repo, env, slot: 'check6' })).toThrow(/invalid slot/u);
  expect(() => openMirror(sha, { repo, env, slot: 'lane-x6' })).toThrow(/invalid slot/u);
  for (const slot of ['gate', 'commit', 'check', 'check2', 'check3', 'check4', 'check5']) {
    const admitted = openMirror(sha, { repo, env, slot }); admitted.release();
  }
});

it('keeps whole generated jobs, invalidates partial jobs and prunes retired outputs', () => {
  const { repo, commit, env } = fixture();
  const catalog = (outputs: string[]): string => JSON.stringify({ jobs: [{ buildTimeOutputs: outputs }] });
  const paths = ['dist/rows.json', 'assets/creature', 'assets/retained'];
  const first = commit({ 'scripts/generation-jobs.json': catalog(paths), 'assets/retained': 'authored' });
  const one = openMirror(first, { repo, env });
  mkdirSync(join(one.dir, 'assets'), { recursive: true });
  mkdirSync(join(one.dir, 'dist'), { recursive: true });
  writeFileSync(join(one.dir, 'dist/rows.json'), 'metadata');
  writeFileSync(join(one.dir, 'assets/creature'), 'blob');
  one.release();
  const two = openMirror(first, { repo, env });
  expect(readFileSync(join(two.dir, 'assets/creature'), 'utf8')).toBe('blob');
  expect(readFileSync(join(two.dir, 'dist/rows.json'), 'utf8')).toBe('metadata');
  rmSync(join(two.dir, 'assets/creature'));
  two.release();
  const partial = openMirror(first, { repo, env });
  expect(existsSync(join(partial.dir, 'dist/rows.json'))).toBe(false);
  expect(readFileSync(join(partial.dir, 'assets/retained'), 'utf8')).toBe('authored');
  writeFileSync(join(partial.dir, 'dist/rows.json'), 'metadata');
  writeFileSync(join(partial.dir, 'assets/creature'), 'blob');
  partial.release();
  const second = commit({ 'scripts/generation-jobs.json': catalog(['assets/retained']) });
  const retired = openMirror(second, { repo, env });
  expect(existsSync(join(retired.dir, 'dist/rows.json'))).toBe(false);
  expect(existsSync(join(retired.dir, 'assets/creature'))).toBe(false);
  expect(readFileSync(join(retired.dir, 'assets/retained'), 'utf8')).toBe('authored');
  retired.release();
  // Git removes a formerly tracked blob when it becomes a generated output.
  // Its remaining ignored metadata must not survive as a seemingly ready job.
  const third = commit({ 'scripts/generation-jobs.json': catalog(['dist/rows.json', 'assets/retained']), 'assets/retained': null });
  writeFileSync(join(retired.dir, 'dist/rows.json'), 'stale metadata');
  const migrated = openMirror(third, { repo, env });
  expect(existsSync(join(migrated.dir, 'dist/rows.json'))).toBe(false);
  expect(existsSync(join(migrated.dir, 'assets/retained'))).toBe(false);
  migrated.release();
});

// oxlint-disable-next-line import/no-nodejs-modules -- Every write is confined to an owned fixture under ./tmp.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { reuseOrBuild, shardfileKey, treeHashes } from '../scripts/shardfile-cache.mjs';

const owned: string[] = [];
afterEach(() => { for (const dir of owned.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(files: Record<string, string>): string {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(join(resolve('tmp'), 'shardfile-cache-test-'));
  owned.push(root);
  write(root, files);
  return root;
}
function write(root: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); }
}
const built = ['alpha', 'beta'];
const keys = (root: string): { alpha: string; beta: string } => {
  const files = treeHashes(root);
  return { alpha: shardfileKey(files, 'alpha', built, []), beta: shardfileKey(files, 'beta', built, []) };
};

it('re-keys only the shard whose own files change, and every shard on a shared change', () => {
  const root = fixture({ 'src/engine/a.ts': '1', 'src/shards/alpha/x.ts': '1', 'src/shards/beta/y.ts': '1', 'public/assets/beta/m.bin': '1',
    'public/assets/models/shared.glb': '1', 'docs/n.md': '1', 'public/shardfiles/alpha/shard.json': '{}' });
  const before = keys(root);
  write(root, { 'src/shards/beta/y.ts': '2' });
  const afterBeta = keys(root);
  expect(afterBeta.alpha).toBe(before.alpha);
  expect(afterBeta.beta).not.toBe(before.beta);
  write(root, { 'public/assets/beta/m.bin': '2', 'docs/n.md': '2', 'public/shardfiles/alpha/shard.json': '{"x":1}' });
  const afterAssets = keys(root);
  expect(afterAssets.alpha).toBe(before.alpha);
  expect(afterAssets.beta).not.toBe(afterBeta.beta);
  write(root, { 'public/assets/models/shared.glb': '2' });
  const afterShared = keys(root);
  expect(afterShared.alpha).not.toBe(before.alpha);
  write(root, { 'src/engine/a.ts': '2' });
  expect(keys(root).alpha).not.toBe(afterShared.alpha);
});

it('reuses a published product and rebuilds on a new key', async () => {
  const root = fixture({});
  const cacheRoot = join(root, 'cache'), destination = join(root, 'out');
  let builds = 0;
  const build = (body: string) => (out: string): Promise<void> => { builds++; write(out, { 'shard.json': body }); return Promise.resolve(); };
  expect(await reuseOrBuild({ slug: 'alpha', key: 'a'.repeat(64), destination, cacheRoot, build: build('one') })).toBe('built');
  expect(await reuseOrBuild({ slug: 'alpha', key: 'a'.repeat(64), destination, cacheRoot, build: build('two') })).toBe('slot');
  rmSync(destination, { recursive: true });
  expect(await reuseOrBuild({ slug: 'alpha', key: 'a'.repeat(64), destination, cacheRoot, build: build('two') })).toBe('cache');
  expect(readFileSync(join(destination, 'shard.json'), 'utf8')).toBe('one');
  expect(await reuseOrBuild({ slug: 'alpha', key: 'b'.repeat(64), destination, cacheRoot, build: build('three') })).toBe('built');
  expect(readFileSync(join(destination, 'shard.json'), 'utf8')).toBe('three');
  // A full build always builds and serves its own bytes.
  expect(await reuseOrBuild({ slug: 'alpha', key: 'b'.repeat(64), destination, cacheRoot, fresh: true, build: build('four') })).toBe('built');
  expect(readFileSync(join(destination, 'shard.json'), 'utf8')).toBe('four');
  expect(builds).toBe(3);
  expect(existsSync(join(cacheRoot, 'alpha', 'a'.repeat(64), 'shard.json'))).toBe(true);
});

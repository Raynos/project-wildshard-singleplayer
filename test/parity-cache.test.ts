import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { mkdtempSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { join } from 'node:path';
import { cachedTree } from '../scripts/parity/serve.mjs';
import { evictBuildCache } from '../scripts/parity/cache.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'parity-speed-test-'));
  const put = (path: string, content: string) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content); };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 'p1@example.invalid'); git('config', 'user.name', 'P1 test');
  put('.vercelignore', '/docs\n/test/parity\n'); put('docs/note.md', 'ignored');
  put('src/engine/shared.ts', 'export const shared=1;'); put('src/engine/only-a.ts', 'export const a=1;');
  for (const shard of ['a', 'b', 'c', 'd']) put(`src/shards/${shard}/manifest.ts`, `import '@wildshard/engine/shared';${shard === 'a' ? "import '@wildshard/engine/only-a';" : ''}`);
  put('test/parity/baselines/m5/a.phone.json', '{"sha":"first"}'); put('scripts/parity.mjs', 'harness');
  git('add', '.'); git('commit', '-qm', 'fixture');
  return { root, put, git, close: () => rmSync(root, { recursive: true, force: true }) };
}

describe('parity build-cache eviction', () => {
  it('keeps the newest three completed entries by mtime and supports a different limit', () => {
    const root = mkdtempSync(join(tmpdir(), 'parity-eviction-test-'));
    const keys = [1, 2, 3, 4, 5].map((n) => n.toString(16).padStart(64, '0'));
    try {
      keys.forEach((key, i) => {
        const dir = join(root, key); mkdirSync(join(dir, 'tree/dist'), { recursive: true });
        writeFileSync(join(dir, 'ready.json'), '{}'); writeFileSync(join(dir, 'tree/dist/version.json'), '{}');
        utimesSync(dir, new Date(1000 * (i + 1)), new Date(1000 * (i + 1)));
      });
      mkdirSync(join(root, 'unrelated')); mkdirSync(join(root, 'a'.repeat(64)));
      writeFileSync(join(root, 'rotation.json'), '{}');
      expect(evictBuildCache(root)).toEqual([keys[1], keys[0]]);
      expect(readdirSync(root)).toEqual(expect.arrayContaining(keys.slice(2)));
      expect(readdirSync(root)).toContain('unrelated'); expect(readdirSync(root)).toContain('a'.repeat(64));
      expect(evictBuildCache(root, 1)).toEqual([keys[3], keys[2]]);
      expect(() => evictBuildCache(root, 0)).toThrow('positive integer');
      expect(() => evictBuildCache(root, 1.5)).toThrow('positive integer');
      expect(evictBuildCache(join(root, 'missing'))).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('retains old builds while a preview uses them, then evicts them after cleanup', async () => {
    const f = fixture(), cache = join(f.root, 'cache');
    const build = (tree: string) => { mkdirSync(join(tree, 'dist')); writeFileSync(join(tree, 'dist/version.json'), '{}'); };
    try {
      const sha = f.git('rev-parse', 'HEAD');
      const first = await cachedTree(f.root, sha, cache, build);
      const secondReader = await cachedTree(f.root, sha, cache, build);
      expect(secondReader.hit).toBe(true);
      f.put('src/engine/shared.ts', 'export const shared=2;');
      f.git('add', 'src/engine/shared.ts'); f.git('commit', '-qm', 'next runtime');
      const second = await cachedTree(f.root, f.git('rev-parse', 'HEAD'), cache, build);
      const locked = 'b'.repeat(64), dir = join(cache, locked);
      mkdirSync(join(dir, 'tree/dist'), { recursive: true });
      writeFileSync(join(dir, 'ready.json'), '{}'); writeFileSync(join(dir, 'tree/dist/version.json'), '{}');
      utimesSync(dir, new Date(1000), new Date(1000)); mkdirSync(`${dir}.lock`);
      expect(evictBuildCache(cache, 1)).toEqual([]);
      first.cleanup(); expect(evictBuildCache(cache, 1)).toEqual([]);
      secondReader.cleanup(); expect(evictBuildCache(cache, 1)).toEqual([first.key]);
      second.cleanup(); rmSync(`${dir}.lock`, { recursive: true });
      expect(evictBuildCache(cache, 1)).toEqual([locked]);
    } finally { f.close(); }
  });
});

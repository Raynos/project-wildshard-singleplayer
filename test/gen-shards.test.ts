// oxlint-disable-next-line import/no-nodejs-modules -- Generator integration fixtures own temporary directories.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator fixtures stay outside the shared working tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator fixtures require host filesystem paths.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { genShards, manifestClosure } from '../scripts/gen-shards.mjs';
import { splitKtx2 } from '../scripts/ktx2-tables.mjs';

describe('shard generation', () => {
  it('follows static runtime imports and re-exports, excluding types and lazy plugin thunks', () => {
    const root = mkdtempSync(join(tmpdir(), 'manifest-closure-'));
    try {
      const dir = join(root, 'src/shards/new-shard'); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'manifest.ts'), "import { data } from './data'; import type { Shape } from './types'; export default { data, load: () => import('./plugin') }; ");
      writeFileSync(join(dir, 'data.ts'), "export { more } from './more'; export type { Shape } from './types';");
      writeFileSync(join(dir, 'more.ts'), 'export const more = 1;');
      writeFileSync(join(dir, 'types.ts'), 'export interface Shape {}');
      writeFileSync(join(dir, 'plugin.ts'), 'throw new Error("must stay lazy");');
      expect(manifestClosure(root)['new-shard']).toEqual(['src/shards/new-shard/data.ts', 'src/shards/new-shard/manifest.ts', 'src/shards/new-shard/more.ts']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('discovers a new manifest and the hidden template without a KTX2 file; checks determinism and stale output', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-'));
    try {
      for (const slug of ['new-shard', '_template']) {
        const dir = join(root, 'src/shards', slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'manifest.ts'), 'export default {};');
      }
      mkdirSync(join(root, 'src/shards/not-a-shard'));
      genShards(root);
      const out = join(root, 'src/game/shard/shards.generated.ts');
      const source = readFileSync(out, 'utf8');
      expect(source).toContain("from '#shards/new-shard/manifest'");
      expect(source).toContain('"_template" | "new-shard"');
      expect(source).not.toContain('ktx2');
      expect(source).not.toContain('not-a-shard');
      genShards(root);
      expect(readFileSync(out, 'utf8')).toBe(source);
      expect(() => genShards(root, true)).not.toThrow();
      writeFileSync(out, 'stale');
      expect(() => genShards(root, true)).toThrow('stale');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('partitions KTX2 by shard-owned source paths and preserves shared layer mappings', () => {
    const map = { phone: { '/assets/new-shard/a.glb': '/assets/gpu/new-shard/a.glb', '/assets/tex/shared.jpg#layer': '/assets/gpu/tex/shared.ktx2', '/assets/legacy/a.jpg': '/assets/gpu/legacy/a.ktx2' }, desktop: {} };
    const result = splitKtx2(map, [{ slug: 'new-shard', assetGlobs: ['public/assets/legacy/**'] }]);
    expect(result.get('new-shard')?.phone).toEqual({ '/assets/new-shard/a.glb': '/assets/gpu/new-shard/a.glb', '/assets/legacy/a.jpg': '/assets/gpu/legacy/a.ktx2' });
    expect(result.get('engine')?.phone).toEqual({ '/assets/tex/shared.jpg#layer': '/assets/gpu/tex/shared.ktx2' });
    expect(() => splitKtx2(map, [{ slug: 'new-shard' }, { slug: 'other', assetGlobs: ['public/assets/new-shard/**'] }])).toThrow('ambiguous');
  });
});

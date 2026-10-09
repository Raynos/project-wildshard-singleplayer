import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { GridAssembly } from '../../../src/game/grid/assembly';
import { ResidencyAllocator } from '../../../src/game/grid/allocator';
import { gridShardfileProduct } from '../../../src/game/grid/products';
import { installShards, shards } from '../../../src/game/shard/list';
import { prepareTrustedRuntime } from '../../../src/game/shardfile/runtime';
import manifest from '../../../src/shards/nine-dragon-stack/manifest';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { NdPlugin, resolveTrustedRuntime } from '../../../src/shards/nine-dragon-stack/plugin';

const originalCatalogue = shards();
const originalFetch = globalThis.fetch, originalNavigator = globalThis.navigator;
afterEach(() => { installShards(originalCatalogue); vi.stubGlobal('fetch', originalFetch); vi.stubGlobal('navigator', originalNavigator); });

describe('Nine Dragon DEVSERVER grid admission (SF51-g)', () => {
  it('keeps the cell DEVSERVER-only at its stable (+1, -1) placement', () => {
    expect(new GridAssembly({ developer: true, devserver: false }).cells.some(row => row.slug === manifest.slug)).toBe(false);
    const cell = new GridAssembly({ developer: true, devserver: true }).cell(manifest.slug);
    expect(cell).toMatchObject({ instance: manifest.slug, slug: manifest.slug, cell: [1, -1], origin: { x: 555, y: 0, z: -555 } });
    expect(manifest.shardfile).toBeUndefined(); // SHARD SELECT keeps its native entry.
    expect(resolveTrustedRuntime('runtime/index.ts')).toBe(NdPlugin);
    expect(() => resolveTrustedRuntime('runtime/other.ts')).toThrow('Unknown trusted runtime');
  });

  it('admits the real declared product and resolves its runtime without the far-proxy fallback', async () => {
    installShards([...originalCatalogue.filter(row => row.slug !== manifest.slug), manifest]);
    vi.stubGlobal('navigator', { onLine: true });
    const fetchSource = vi.fn(() => Promise.resolve(Response.json(source)));
    vi.stubGlobal('fetch', fetchSource);
    const allocator = new ResidencyAllocator(), scope = new Scope('nine.grid-admission');
    try {
      const pending = gridShardfileProduct(manifest.slug, { allocator, scope });
      if (pending === null) throw new Error('Nine unexpectedly remains a far proxy');
      const product = await pending;
      expect(fetchSource.mock.calls).toEqual([['http://localhost:5173/shardfiles/nine-dragon-stack/shard.json']]);
      expect(product.admitted.source.runtime).toEqual(source.runtime);
      expect(product.options.firstParty).toBe(true);
      const trusted = manifest.trustedRuntime, runtime = product.admitted.source.runtime;
      if (trusted === undefined || runtime === null) throw new Error('Missing admitted native runtime');
      const Runtime = await prepareTrustedRuntime(runtime, manifest.slug, true, [{ ...trusted,
        load: () => Promise.resolve({ default: resolveTrustedRuntime(trusted.entry) }) }]);
      expect(Runtime).toBe(NdPlugin);
      product.release();
    } finally { scope.dispose(); }
    expect(allocator.entries()).toEqual([]);
  });
});

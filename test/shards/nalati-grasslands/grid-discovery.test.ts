import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { ResidencyAllocator } from '../../../src/game/grid/allocator';
import { gridShardfileProduct } from '../../../src/game/grid/products';
import { regionalRuntimeAccountedBytes } from '../../../src/game/grid/regionalRuntime';
import { NALATI_GRASSLANDS } from '../../../src/shards/nalati-grasslands/manifest';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { NALATI_RUNTIME_COST } from '../../../src/shards/nalati-grasslands/data/runtimeCost';
import { NALATI_RUNTIME_SPAWNS } from '../../../src/shards/nalati-grasslands/data/spawns';

const originalFetch = globalThis.fetch, originalNavigator = globalThis.navigator;
afterEach(() => { vi.stubGlobal('fetch', originalFetch); vi.stubGlobal('navigator', originalNavigator); });

it('discovers Nalati grid data without changing its standalone descriptor or trusted entry', async () => {
  expect(NALATI_GRASSLANDS.shardfile).toBeUndefined();
  expect(NALATI_GRASSLANDS.gridShardfile).toBe('/shardfiles/nalati-grasslands/shard.json');
  expect(NALATI_GRASSLANDS.trustedRuntime).toEqual({ slug: source.identity.slug, entry: 'runtime/index.ts' });
  const fetchSource = vi.fn(() => Promise.resolve(Response.json(source)));
  vi.stubGlobal('fetch', fetchSource); vi.stubGlobal('navigator', { onLine: true });
  const allocator = new ResidencyAllocator(), scope = new Scope('grid.nalati.discovery');
  try {
    const product = await gridShardfileProduct('nalati-grasslands', { allocator, scope });
    if (product === null) throw new Error('Nalati grid declaration missing');
    expect(fetchSource.mock.calls).toEqual([['http://localhost:5173/shardfiles/nalati-grasslands/shard.json']]);
    expect(product.options.firstParty).toBe(true);
    expect(product.admitted.source.runtime).toEqual({ entry: 'runtime/index.ts', cost: NALATI_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns'], spawns: NALATI_RUNTIME_SPAWNS });
    expect(product.admitted.source.edge).toEqual(source.edge);
    expect(regionalRuntimeAccountedBytes(product.admitted, NALATI_GRASSLANDS)).toBe(197_073_318);
    product.release();
  } finally { scope.dispose(); }
  expect(allocator.entries()).toEqual([]);
});
it('refuses a runtime cost that differs from the reviewed first-party declaration', () => {
  expect(() => regionalRuntimeAccountedBytes({ source }, { ...NALATI_GRASSLANDS,
    runtimeCost: { ...NALATI_RUNTIME_COST, glMB: NALATI_RUNTIME_COST.glMB - 1 } })).toThrow('differs');
});

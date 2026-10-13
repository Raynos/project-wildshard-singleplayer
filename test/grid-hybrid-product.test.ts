import { afterEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Serve the real declared immutable assets through bounded product admission.
import { readFileSync } from 'node:fs';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { gridShardfileProduct } from '../src/game/grid/products';
import { installShards, shards } from '../src/game/shard/list';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import pineSource from '../src/shards/pine-hollow/shard.config';

const catalogue = shards();
const originalFetch = globalThis.fetch, originalNavigator = globalThis.navigator;
afterEach(() => { installShards(catalogue); vi.stubGlobal('fetch', originalFetch); vi.stubGlobal('navigator', originalNavigator); });

function productFetch(descriptor: string) {
  return vi.fn((url: string) => {
    if (url === descriptor) return Promise.resolve(Response.json(pineSource));
    const file = pineSource.files.find(row => url === new URL(row.hash, descriptor).href);
    if (file === undefined) throw new Error(`Undeclared Pine product fetch: ${url}`);
    const bytes = readFileSync(new URL(`../src/shards/pine-hollow/assets/${file.hash}`, import.meta.url));
    return Promise.resolve(new Response(Uint8Array.from(bytes)));
  });
}

describe('first-party grid hybrid discovery', () => {
  it('admits the real Pine declaration once without changing its standalone boot descriptor', async () => {
    expect(PINE_HOLLOW.shardfile).toBeUndefined();
    expect(PINE_HOLLOW.gridShardfile).toBe('/shardfiles/pine-hollow/shard.json');
    const descriptor = 'http://localhost:5173/shardfiles/pine-hollow/shard.json';
    const fetchSource = productFetch(descriptor);
    vi.stubGlobal('fetch', fetchSource); vi.stubGlobal('navigator', { onLine: true });
    const allocator = new ResidencyAllocator(), scope = new Scope('grid.hybrid.discovery');
    try {
      const owner = { allocator, scope };
      const [first, second] = await Promise.all([gridShardfileProduct('pine-hollow', owner), gridShardfileProduct('pine-hollow', owner)]);
      if (first === null || second === null) throw new Error('Pine grid declaration was not discovered');
      expect(fetchSource.mock.calls).toEqual([[descriptor], ...pineSource.files.map(file => [new URL(file.hash, descriptor).href])]);
      expect(first.admitted).toBe(second.admitted);
      expect(first.admitted.assets.size).toBe(pineSource.files.length);
      expect(first.admitted.source.runtime).toEqual(pineSource.runtime);
      expect(first.admitted.source.edge).toEqual(pineSource.edge);
      expect(first.options.firstParty).toBe(true);
      expect(allocator.entries()).toHaveLength(1);
      first.release(); expect(allocator.entries()[0]?.needed).toBe(true);
      second.release(); expect(allocator.entries()[0]?.needed).toBe(false);
      expect(PINE_HOLLOW.shardfile).toBeUndefined();
    } finally { scope.dispose(); }
    expect(allocator.entries()).toHaveLength(0);
  });

  it('prefers the ordinary data descriptor and keeps undiscovered shards fenced', async () => {
    installShards([{ ...PINE_HOLLOW, shardfile: '/ordinary/shard.json' }]);
    const descriptor = 'http://localhost:5173/ordinary/shard.json';
    const fetchSource = productFetch(descriptor);
    vi.stubGlobal('fetch', fetchSource); vi.stubGlobal('navigator', { onLine: true });
    const allocator = new ResidencyAllocator(), scope = new Scope('grid.hybrid.precedence');
    try {
      expect(gridShardfileProduct('missing-shard', { allocator, scope })).toBeNull();
      const product = await gridShardfileProduct('pine-hollow', { allocator, scope });
      if (product === null) throw new Error('Ordinary data descriptor was not discovered');
      expect(fetchSource.mock.calls).toEqual([[descriptor], ...pineSource.files.map(file => [new URL(file.hash, descriptor).href])]);
      expect(product.admitted.assets.size).toBe(pineSource.files.length);
      product.release();
    } finally { scope.dispose(); }
    expect(allocator.entries()).toHaveLength(0);
  });
});

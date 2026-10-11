import { expect, it } from 'vitest';
import { createCatalogue } from '../src/commons/catalogue';
import { starterArmClipsPack } from '@wildshard/commons/packs/arms';
import { commonsRequirements } from '../src/sdk/commons';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';
import { Scope } from '../src/engine/app/scope';
import { ContentCache } from '../src/engine/boot/contentCache';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';

const binaryPack = { id: 'shared', version: '1.0.0', entries: [{ id: 'bridge', kind: 'binary' as const,
  bytes: new Uint8Array([1, 2, 3]), credit: 'Fixture', licence: 'CC0-1.0' }] };

it.each([
  { label: 'pinned binary', pack: binaryPack, entry: 'shared/bridge', shards: ['bridge-first', 'bridge-second'], firstParty: false },
  { label: 'v1 arm aliases', pack: starterArmClipsPack({ credit: 'Wildshard', licence: 'First-party' }), entry: 'arm-clips/aliases', shards: ['driftwood-isle', 'nine-dragon-stack'], firstParty: true },
])('downloads $label once for two shards and charges it once while both own crossroads leases', async ({ pack, entry, shards, firstParty }) => {
  const bytes = pack.entries[0]?.bytes;
  if (bytes === undefined) throw new Error('Missing shared asset');
  const built = createCatalogue([pack]);
  const requirements = commonsRequirements(built, [entry]), stored = new Map<string, Response>(), visited = new Map<string, CachedProduct>();
  const address = (request: RequestInfo | URL) => typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  const content = new ContentCache({ origin: 'https://platform.test/', hash: payload => Promise.resolve(contentHash(payload)), now: () => 1, storage: { open: () => Promise.resolve({
    match: request => Promise.resolve(stored.get(address(request))?.clone()),
    put: (request, response) => { stored.set(address(request), response.clone()); return Promise.resolve(); },
    delete: request => Promise.resolve(stored.delete(address(request))),
    keys: () => Promise.resolve([...stored.keys()].map(url => new Request(url))),
  }) } });
  const cache: ProductCache = {
    product: base => Promise.resolve(visited.get(base) ?? null), putProduct: (base, product) => { visited.set(base, product); return Promise.resolve(); },
    asset: (_base, hash) => content.get(hash), putAsset: (_base, hash, payload) => content.put(hash, payload),
  };
  const allocator = new ResidencyAllocator(), scopes: Scope[] = []; let downloads = 0;
  try {
    for (const slug of shards) {
      const source = emptyShardfile({ slug, name: slug, author: 'Fixture', seed: 1, revision: 1 });
      source.requires = { ...source.requires, ...requirements }; source.library = requirements.commons.map(hash => `commons:${hash}`);
      const product = await admitProduct(source, { base: `https://platform.test/${slug}/`, offline: false, firstParty, cache, hash: payload => Promise.resolve(contentHash(payload)), fetch: () => { downloads++; return Promise.resolve(new Response(Uint8Array.from(bytes))); } });
      const scope = new Scope(slug); scopes.push(scope); leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
    }
    expect(downloads).toBe(1); expect(await content.stats()).toEqual({ bytes: bytes.length, entries: 1 });
    expect(allocator.entries()).toHaveLength(1); expect(allocator.entries()[0]).toMatchObject({ bytes: bytes.length, refs: 2, category: 'commons', owner: 'platform' });
    expect(allocator.cost().input.commons).toBe(bytes.length);
    scopes[0]?.dispose(); expect(allocator.entries()[0]?.refs).toBe(1);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});

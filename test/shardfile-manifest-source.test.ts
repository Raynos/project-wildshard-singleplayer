import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { emptyShardfileSource, installManifestShardfile } from '../src/game/shardfile/loader';
import { installShards, shards } from '../src/game/shard/list';
import type { ShardManifest } from '../src/game/shard/manifest';
import type { ShardfileClientBindings } from '../src/game/shardfile/client';
import type { CachedProduct, ProductOptions } from '../src/game/shardfile/product';

const bindings: ShardfileClientBindings = { instance: 'ignored-author-instance', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() };
function fixture() {
  const source = emptyShardfile({ slug: 'template', name: 'Author name', author: 'Fixture', revision: 1, seed: 357 });
  const selected: ShardManifest = { ...emptyShardfileSource(source), slug: '_template', name: 'Picker name', status: 'hidden',
    shardfile: '/shardfiles/_template/shard.json', card: { thumb: 'thumb.jpg', portrait: 'portrait.jpg', landscape: 'landscape.jpg' },
    minimap: { image: '/assets/_template/map/top.webp' } };
  let visited: CachedProduct | null = null, requests = 0;
  const options: ProductOptions = { base: 'https://fixture.test/', firstParty: true, offline: false,
    fetch: (url) => { expect(url).toBe('https://fixture.test/shardfiles/_template/shard.json'); requests++; return Promise.resolve(Response.json(source)); },
    hash: () => Promise.reject(new Error('No immutable asset in this fixture')),
    cache: { product: () => Promise.resolve(visited), asset: () => Promise.resolve(null), putAsset: () => Promise.resolve(),
      putProduct: (_key, value) => { visited = value; return Promise.resolve(); } },
  };
  installShards([selected]);
  return { source, selected, options, requests: () => requests };
}

it('hydrates through the normal data plugin while retaining canonical discovery identity and picker art', async () => {
  const f = fixture(), hydrated = await installManifestShardfile(f.selected, f.options, bindings);
  expect(hydrated.slug).toBe('_template'); expect(hydrated.name).toBe('Picker name'); expect(hydrated.card).toEqual(f.selected.card);
  expect(hydrated.minimap).toEqual({ image: '/assets/_template/map/top.webp' }); // G252b: the baked map survives admission
  expect(shards()).toEqual([hydrated]); expect(hydrated.load).toBeTypeOf('function'); expect(f.requests()).toBe(1);
  const offline = await installManifestShardfile(f.selected, { ...f.options, offline: true, fetch: () => Promise.reject(new Error('Offline cannot fetch')) }, bindings);
  expect(offline.slug).toBe('_template'); expect(f.requests()).toBe(1);
});

it('refuses source identity substitutions and untrusted/cross-origin descriptors before allocating a client', async () => {
  const f = fixture();
  await expect(installManifestShardfile(f.selected, { ...f.options, firstParty: false }, bindings)).rejects.toThrow('first-party provenance');
  await expect(installManifestShardfile({ ...f.selected, shardfile: 'https://foreign.test/shard.json' }, f.options, bindings)).rejects.toThrow('same-origin');
  await expect(installManifestShardfile(f.selected, { ...f.options, fetch: () => Promise.resolve(Response.json({ ...f.source, identity: { ...f.source.identity, slug: 'substitute' } })) }, bindings)).rejects.toThrow('identities differ');
  await expect(installManifestShardfile(f.selected, { ...f.options, offline: true }, bindings)).rejects.toThrow('not been visited');
  expect(shards()).toEqual([f.selected]);
});

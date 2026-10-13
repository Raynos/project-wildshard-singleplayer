import { expect, it } from 'vitest';
import { PageResidency } from '../src/game/grid/pageResidency';
import { emptyShardfile } from '@wildshard/sdk/author';
import { contentHash } from '@wildshard/sdk/project';
import { emptyShardfileSource, installManifestShardfile } from '../src/game/plugin/ui';
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
  expect(hydrated.minimap).toEqual({}); // SF66: an unadmitted manifest URL never becomes the map image.
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

it('preserves the placed home identity and allocator already owned by the page during manifest admission', async () => {
  const f = fixture(), residency = new PageResidency();
  const source = { ...f.source, budgets: { ...f.source.budgets, sim: { ...f.source.budgets.sim, resident: 1 } } };
  try {
    await installManifestShardfile(f.selected, { ...f.options, fetch: () => Promise.resolve(Response.json(source)) }, { ...bindings, instance: 'template-2', residency });
    expect(residency.home().instance).toBe('template-2');
    expect(residency.home().allocator).toBe(residency.allocator);
    expect(residency.allocator.has('sim:template-2')).toBe(true);
    expect(residency.allocator.has('sim:template-solo')).toBe(false);
  } finally { residency.dispose(); }
});


it.each(['/shardfiles/_template/shard.json', '/content/nested/template/source.json'])('fetches and revisits immutable files beside the descriptor %s', async (descriptor) => {
  const f = fixture(), bytes = new TextEncoder().encode('{"value":1}'), hash = contentHash(bytes);
  f.source.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  f.source.library.push(hash); f.source.budgets.library = { compressed: bytes.length, resident: bytes.length };
  const descriptorUrl = `https://fixture.test${descriptor}`, base = new URL('.', descriptorUrl).href;
  const requests: string[] = [], products = new Map<string, CachedProduct>(), assets = new Map<string, Uint8Array>();
  const options: ProductOptions = { ...f.options, hash: (value) => Promise.resolve(contentHash(value)),
    fetch: (url) => {
      requests.push(url);
      if (url === descriptorUrl) return Promise.resolve(Response.json(f.source));
      if (url === `${base}${hash}`) return Promise.resolve(new Response(Uint8Array.from(bytes)));
      return Promise.reject(new Error(`Unexpected product URL: ${url}`));
    },
    cache: {
      product: (key) => { expect(key).toBe(base); return Promise.resolve(products.get(key) ?? null); },
      asset: (key, file) => { expect(key).toBe(base); return Promise.resolve(assets.get(file) ?? null); },
      putAsset: (key, file, value) => { expect(key).toBe(base); assets.set(file, value); return Promise.resolve(); },
      putProduct: (key, value) => { expect(key).toBe(base); products.set(key, value); return Promise.resolve(); },
    },
  };
  const selected = { ...f.selected, shardfile: descriptor };
  expect((await installManifestShardfile(selected, options, bindings)).slug).toBe('_template');
  expect(requests).toEqual([descriptorUrl, `${base}${hash}`]);
  expect([...products.keys()]).toEqual([base]);
  expect((await installManifestShardfile(selected, { ...options, offline: true, fetch: () => Promise.reject(new Error('Offline cannot fetch')) }, bindings)).slug).toBe('_template');
  expect(requests).toHaveLength(2);
});

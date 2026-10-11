// oxlint-disable-next-line import/no-nodejs-modules -- Qualify real generated native rigs, not invented skeleton data.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { speciesRestPack } from '@wildshard/commons/packs/species';
import { readRigRest } from '@wildshard/sdk/bake/rig';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { BOAR_LOOK } from '../src/game/systems/species/view/boar';
import { BEAR_LOOK } from '../src/game/systems/species/view/bear';
import { BOAR } from '../src/game/systems/species/boar';
import { BEAR } from '../src/game/systems/species/bear';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { Rng } from '../src/engine/core/rng';
import { setLowPoly } from '../src/engine/entities/species/loft';
import { createCatalogue } from '../src/commons/catalogue';
import { commonsRequirements } from '../src/sdk/commons';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { ContentCache } from '../src/engine/boot/contentCache';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';

const rows = [
  { kind: 'boar', hull: 'boar', variant: 'boar', species: speciesWithLook(BOAR, BOAR_LOOK) },
  { kind: 'bear', hull: 'bear-black', variant: 'black', species: speciesWithLook(BEAR, BEAR_LOOK) },
  { kind: 'bear', hull: 'bear-brown', variant: 'brown', species: speciesWithLook(BEAR, BEAR_LOOK) },
];
const recording = (hull: string): Uint8Array => Uint8Array.from(readFileSync(new URL(`../public/assets/pine-hollow/creatures/${hull}.phone.rigged.glb`, import.meta.url)));
const provenance = { credit: 'Wildshard shared boar/bear rest rig; authored Pine hull', licence: 'First-party' };

it.each(rows)('qualifies $hull joints exactly against both native procedural styles without claiming shared geometry', async ({ kind, hull, variant, species }) => {
  const bytes = recording(hull), pack = await speciesRestPack(kind, bytes, provenance), native = await readRigRest(bytes);
  const v = species.variants.find(value => value.id === variant);
  if (v === undefined) throw new Error('Missing native species variant');
  try {
    for (const lowPoly of [true, false]) {
      setLowPoly(lowPoly);
      const body = species.build(v, new Rng(1));
      setLowPoly(false);
      const parts = [...body.furParts, ...body.hardParts, ...body.eyeParts];
      try {
        expect(body.bones).toHaveLength(20);
        expect(new TextDecoder().decode(pack.entries[0]?.bytes)).toBe(encodeCanonicalJson({ version: 1, space: 'model', bones: body.bones }));
        expect(native.bones).toEqual(body.bones.map(({ name, pos }) => ({ name, pos })));
        expect(parts.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0)).not.toBe(native.geometry.getAttribute('position').count);
      } finally { for (const geometry of parts) geometry.dispose(); }
    }
    expect(createCatalogue([pack]).json).toBe(createCatalogue([await speciesRestPack(kind, bytes, provenance)]).json);
  } finally { native.geometry.dispose(); setLowPoly(false); }
});

it('downloads and claims each real shared rest rig once for Driftwood and Pine, then releases independent leases', async () => {
  const built = createCatalogue(await Promise.all([['boar', 'boar'], ['bear', 'bear-black']].map(([kind, hull]) => {
    if (kind === undefined || hull === undefined) throw new Error('Missing species source');
    return speciesRestPack(kind, recording(hull), provenance);
  })));
  const requirements = commonsRequirements(built, built.catalogue.entries.map(row => row.id));
  const stored = new Map<string, Response>(), products = new Map<string, CachedProduct>(), downloads = new Map<string, number>();
  const address = (request: RequestInfo | URL): string => typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  const content = new ContentCache({ origin: 'https://platform.test/', hash: bytes => Promise.resolve(contentHash(bytes)), now: () => 1,
    storage: { open: () => Promise.resolve({ match: key => Promise.resolve(stored.get(address(key))?.clone()),
      put: (key, value) => { stored.set(address(key), value.clone()); return Promise.resolve(); },
      delete: key => Promise.resolve(stored.delete(address(key))), keys: () => Promise.resolve([...stored.keys()].map(key => new Request(key))) }) } });
  const cache: ProductCache = { product: base => Promise.resolve(products.get(base) ?? null),
    putProduct: (base, product) => { products.set(base, product); return Promise.resolve(); },
    asset: (_base, hash) => content.get(hash), putAsset: (_base, hash, bytes) => content.put(hash, bytes) };
  const allocator = new ResidencyAllocator(), scopes: Scope[] = [];
  const fetchAsset = (url: string): Promise<Response> => {
    const hash = new URL(url).pathname.split('/').at(-1), bytes = hash === undefined ? undefined : built.assets.get(hash);
    if (hash === undefined || bytes === undefined) throw new Error('Unexpected rest rig request');
    downloads.set(hash, (downloads.get(hash) ?? 0) + 1); return Promise.resolve(new Response(Uint8Array.from(bytes)));
  };
  try {
    for (const slug of ['driftwood-isle', 'pine-hollow']) {
      const shard = emptyShardfile({ slug, name: slug, author: 'Wildshard', seed: 1, revision: 1 });
      shard.requires = { ...shard.requires, ...requirements }; shard.library = requirements.commons.map(hash => `commons:${hash}`);
      const options = { base: `https://platform.test/${slug}/`, offline: false, firstParty: true, cache,
        hash: (bytes: Uint8Array) => Promise.resolve(contentHash(bytes)), fetch: fetchAsset };
      const product = await admitProduct(shard, options);
      const scope = new Scope(slug); scopes.push(scope); leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
      const reader = new ClientAssets(product.source, product.assets, options);
      for (const entry of built.catalogue.entries) expect(await reader.read(`commons:${entry.hash}`)).toEqual(built.assets.get(entry.hash));
    }
    expect([...downloads.values()]).toEqual([1, 1]); expect(allocator.entries()).toHaveLength(2);
    expect(allocator.entries().every(entry => entry.refs === 2 && entry.category === 'commons')).toBe(true);
    expect(allocator.cost().input.commons).toBe([...built.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0));
    scopes[0]?.dispose(); expect(allocator.entries().every(entry => entry.refs === 1)).toBe(true);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});

it('refuses invalid identities before decoding and refuses truncated native rigs', async () => {
  await expect(speciesRestPack('../boar', new Uint8Array(), provenance)).rejects.toThrow('Invalid species rest kind');
  await expect(speciesRestPack('boar', recording('boar').subarray(0, -1), provenance)).rejects.toThrow('complete GLB');
});

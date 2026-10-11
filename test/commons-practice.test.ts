// oxlint-disable-next-line import/no-nodejs-modules -- Validate real committed recordings, not synthetic audio bytes.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readRigMotion } from '@wildshard/sdk/bake/rig';
import { practiceMotionPack } from '@wildshard/commons/packs/practice';
import { createCatalogue } from '../src/commons/catalogue';
import { commonsRequirements } from '../src/sdk/commons';
import { parseGlb } from '../src/sdk/assets';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { ContentCache } from '../src/engine/boot/contentCache';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { admitProduct, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';

const recording = (): Uint8Array => Uint8Array.from(readFileSync(new URL('../public/assets/practice/dummies/unimate-motion.glb', import.meta.url)));

it('packs the original eighteen practice clips unchanged and downloads once for Driftwood and Pine', async () => {
  const pack = await practiceMotionPack(recording(), { credit: 'Wildshard UniMate practice motion', licence: 'First-party' });
  const built = createCatalogue([pack]), repeated = createCatalogue([await practiceMotionPack(recording(),
    { credit: 'Wildshard UniMate practice motion', licence: 'First-party' })]);
  expect(pack.version).toBe('1.0.0'); expect(built.json).toBe(repeated.json);
  const clipBytes = pack.entries[0]?.bytes; if (clipBytes === undefined) throw new Error('Missing original practice motion');
  expect(clipBytes).toEqual(recording());
  const cost = parseGlb(clipBytes), resident = cost.decoded + cost.gpu;
  expect(built.catalogue.entries[0]?.cost).toEqual(cost); expect(resident).toBeGreaterThan(clipBytes.length);
  expect(cost.triangles).toBe(0); expect(cost.gpu).toBeGreaterThanOrEqual(0);
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
  try {
    for (const slug of ['driftwood-isle', 'pine-hollow']) {
      const shard = emptyShardfile({ slug, name: slug, author: 'Wildshard', seed: 1, revision: 1 });
      shard.requires = { ...shard.requires, ...requirements }; shard.library = requirements.commons.map(hash => `commons:${hash}`);
      const product = await admitProduct(shard, { base: `https://platform.test/${slug}/`, offline: false, firstParty: true, cache,
        hash: bytes => Promise.resolve(contentHash(bytes)), fetch: url => {
          const hash = new URL(url).pathname.split('/').at(-1), bytes = hash === undefined ? undefined : built.assets.get(hash);
          if (hash === undefined || bytes === undefined) throw new Error('Unexpected recording request');
          downloads.set(hash, (downloads.get(hash) ?? 0) + 1); return Promise.resolve(new Response(Uint8Array.from(bytes)));
        } });
      const scope = new Scope(slug); scopes.push(scope); leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
    }
    expect([...downloads.values()]).toEqual([1]); expect(allocator.entries()).toHaveLength(1);
    expect(allocator.entries().every(entry => entry.refs === 2 && entry.category === 'commons')).toBe(true);
    expect(allocator.cost().input.commons).toBe(resident);
    expect(await content.stats()).toEqual({ entries: 1, bytes: [...built.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0) });
    scopes[0]?.dispose(); expect(allocator.entries().every(entry => entry.refs === 1)).toBe(true);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});

it('owns Node source Buffers and refuses missing clips or truncated GLBs', async () => {
  const original = readFileSync(new URL('../public/assets/practice/dummies/unimate-motion.glb', import.meta.url)), expected = Uint8Array.from(original);
  const pack = await practiceMotionPack(original, { credit: 'Test', licence: 'Test' });
  original.fill(0); expect(pack.entries[0]?.bytes).toEqual(expected);
  expect(() => parseGlb(expected.subarray(0, -1))).toThrow();
  await expect(readRigMotion(expected.subarray(0, -1))).rejects.toThrow('complete GLB');
  await expect(practiceMotionPack(expected.subarray(0, -1), { credit: 'Test', licence: 'Test' })).rejects.toThrow();
  const invalid = Uint8Array.from(expected), encoded = new TextEncoder().encode('wood:idle');
  const start = invalid.findIndex((_value, index) => encoded.every((value, offset) => invalid[index + offset] === value));
  if (start === -1) throw new Error('Missing original clip label');
  invalid[start + 4] = '/'.codePointAt(0) ?? 0;
  expect(() => parseGlb(invalid)).toThrow('GLB clip name');
  await expect(practiceMotionPack(invalid, { credit: 'Test', licence: 'Test' })).rejects.toThrow('GLB clip name');
  invalid[start + 4] = ':'.codePointAt(0) ?? 0; invalid[start + 8] = 'a'.codePointAt(0) ?? 0;
  await expect(practiceMotionPack(invalid, { credit: 'Test', licence: 'Test' })).rejects.toThrow('eighteen distinct');
});

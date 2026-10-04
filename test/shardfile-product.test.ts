import { expect, it } from 'vitest';
import binaryen from 'binaryen';
import { emptyShardfile } from '@wildshard/sdk/author';
import { contentHash } from '@wildshard/sdk/project';
import { admitProduct, boundedResponse, type CachedProduct, type ProductCache, type ProductOptions } from '../src/game/shardfile/product';
import { parseShardfile } from '../src/game/shardfile/schema';

const empty = () => emptyShardfile({ slug: 'product-test', name: 'Product', author: 'Local', seed: 1, revision: 1 });
const base = 'https://example.test/products/product-test/';
function cacheFixture(): ProductCache & { products: Map<string, CachedProduct>; bytes: Map<string, Uint8Array> } {
  const products = new Map<string, CachedProduct>(), bytes = new Map<string, Uint8Array>();
  return { products, bytes, product: (key) => Promise.resolve(products.get(key) ?? null), asset: (_base, key) => Promise.resolve(bytes.get(key) ?? null),
    putAsset: (_base, key, value) => { bytes.set(key, Uint8Array.from(value)); return Promise.resolve(); }, putProduct: (key, value) => { products.set(key, structuredClone(value)); return Promise.resolve(); } };
}
function fixture() {
  const cache = cacheFixture(), shard = empty(), bytes = new TextEncoder().encode('{"value":1}'), hash = contentHash(bytes); let fetches = 0;
  shard.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  const options: ProductOptions = { base, cache, offline: false, firstParty: false, hash: (value) => Promise.resolve(contentHash(value)), fetch: (url) => { expect(url).toBe(`${base}${hash}`); fetches++; return Promise.resolve(new Response(Uint8Array.from(bytes))); } };
  return { shard, hash, bytes, cache, options, fetches: () => fetches };
}
it('boots a visited product offline with no network and repeats byte admission', async () => {
  const f = fixture(), online = await admitProduct(f.shard, f.options);
  expect(online.cached).toBe(false); expect(f.fetches()).toBe(1);
  const offline = await admitProduct(f.shard, { ...f.options, offline: true, fetch: () => Promise.reject(new Error('Offline must not fetch')) });
  expect(offline.cached).toBe(true); expect(offline.source).toEqual(online.source);
  expect(offline.assets.get(f.hash)).toEqual(f.bytes);
  f.cache.bytes.set(f.hash, new Uint8Array(f.bytes.length));
  await expect(admitProduct(f.shard, { ...f.options, offline: true })).rejects.toThrow('hash mismatch');
});
it('does not publish an incomplete or understated product as visited', async () => {
  const f = fixture(), file = f.shard.files[0]; if (file === undefined) throw new Error('Missing file'); file.decoded = 0;
  await expect(admitProduct(f.shard, f.options)).rejects.toThrow('understated'); expect(f.cache.products.size).toBe(0); expect(f.cache.bytes.size).toBe(0);
  await expect(admitProduct(f.shard, { ...f.options, offline: true })).rejects.toThrow('incomplete');
});
it('allows previous format only from a visited first-party cache while offline', async () => {
  const f = fixture(); f.options.firstParty = true; await admitProduct(f.shard, f.options);
  const versions = { current: 1, readers: new Map([[0, parseShardfile], [1, parseShardfile]]) };
  const previous = await admitProduct({ version: 1 }, { ...f.options, versions, offline: true });
  expect(previous.source.version).toBe(0);
  await expect(admitProduct(f.shard, { ...f.options, versions })).rejects.toThrow('compatible client');
  await expect(admitProduct(f.shard, { ...f.options, versions, offline: true, firstParty: false })).rejects.toThrow('compatible client');
  f.cache.products.set(base, { source: f.shard, firstParty: false });
  await expect(admitProduct(f.shard, { ...f.options, versions, offline: true })).rejects.toThrow('compatible client');
  await expect(admitProduct(f.shard, { ...f.options, versions: { current: 2, readers: versions.readers }, offline: true })).rejects.toThrow('compatible client');
});
it('re-admits forged valid-hash cached Wasm before any instance is created', async () => {
  const module = binaryen.parseText('(module (import "env" "memory" (memory 1 64)) (func (export "on_tick") (loop $spin (br $spin))))');
  let bytes: Uint8Array; try { bytes = module.emitBinary(); } finally { module.dispose(); }
  const hash = contentHash(bytes), cache = cacheFixture(), shard = empty();
  shard.files.push({ hash, kind: 'wasm', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  shard.critical.push(hash); shard.sim.scripts.push(hash); shard.budgets.sim = { compressed: bytes.length, resident: 20_000_000 }; shard.serverBudget.memory = 20_000_000;
  cache.products.set(base, { source: shard, firstParty: true }); cache.bytes.set(hash, bytes);
  await expect(admitProduct(shard, { base, cache, offline: true, firstParty: true, hash: (value) => Promise.resolve(contentHash(value)), fetch: () => Promise.reject(new Error('No network')) })).rejects.toThrow();
});
it('bounds streaming bytes even when Content-Length is absent or false', async () => {
  const stream = () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(2)); controller.enqueue(new Uint8Array(2)); controller.close(); } });
  await expect(boundedResponse(new Response(stream()), 3)).rejects.toThrow('wire size');
  await expect(boundedResponse(new Response(stream(), { headers: { 'content-length': '2' } }), 3)).rejects.toThrow('wire size');
  await expect(boundedResponse(new Response(new Uint8Array(3), { headers: { 'content-length': '4' } }), 3)).rejects.toThrow('wire size');
  expect(await boundedResponse(new Response(new Uint8Array(3)), 3)).toHaveLength(3);
});

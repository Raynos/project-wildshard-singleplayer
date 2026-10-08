import { expect, it, vi } from 'vitest';
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
  shard.library.push(hash); shard.budgets.library = { compressed: bytes.length, resident: bytes.length };
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
it('keeps online admission playable when cache quota refuses bytes, without publishing an offline visit', async () => {
  const f = fixture(), leases: string[][] = []; let releases = 0;
  const cache: ProductCache = { ...f.cache, putAsset: () => Promise.resolve(false), pin: (hashes) => { leases.push([...hashes]); return () => { releases++; }; } };
  const admitted = await admitProduct(f.shard, { ...f.options, cache });
  expect(admitted.assets.get(f.hash)).toEqual(f.bytes);
  expect(f.cache.products.size).toBe(0); expect(leases).toEqual([[f.hash]]); expect(releases).toBe(1);
});
it('checks durable presence before publishing a visit, even when a cache silently evicts a completed write', async () => {
  const f = fixture(), cache: ProductCache = { ...f.cache, putAsset: () => Promise.resolve(), asset: () => Promise.resolve(null) };
  await admitProduct(f.shard, { ...f.options, cache });
  expect(f.cache.products.size).toBe(0);
});
it('allows previous format only from a visited first-party cache while offline', async () => {
  const f = fixture(); f.options.firstParty = true; await admitProduct(f.shard, f.options);
  const versions = { current: '0.2', previous: '0.1', readers: new Map([['0.1', parseShardfile], ['0.2', parseShardfile]]) };
  const previous = await admitProduct({ version: '0.2' }, { ...f.options, versions, offline: true });
  expect(previous.source.version).toBe('0.1');
  await expect(admitProduct(f.shard, { ...f.options, versions })).rejects.toThrow('compatible client');
  await expect(admitProduct(f.shard, { ...f.options, versions, offline: true, firstParty: false })).rejects.toThrow('compatible client');
  f.cache.products.set(base, { source: f.shard, firstParty: false });
  await expect(admitProduct(f.shard, { ...f.options, versions, offline: true })).rejects.toThrow('compatible client');
  await expect(admitProduct(f.shard, { ...f.options, versions: { ...versions, current: '0.3' }, offline: true })).rejects.toThrow('compatible client');
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
it('admits a visited product revision only with explicit migrations and preserves the cached predecessor on refusal', async () => {
  const f = fixture();
  f.shard.state.shared.push({ id: 7, name: 'door.open', type: 'bool', privacy: 'public', default: false });
  await admitProduct(f.shard, f.options);
  const next = structuredClone(f.shard); next.identity.revision++; next.state.version++;
  const field = next.state.shared[0]; if (field === undefined) throw new Error('Missing state field'); field.name = 'gate.open';
  await expect(admitProduct(next, f.options)).rejects.toThrow('explicit');
  expect(f.cache.products.get(base)?.source).toEqual(f.shard);
  Object.assign(next, { migrations: [{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 7, name: 'gate.open' }] }] });
  const admitted = await admitProduct(next, f.options);
  expect(admitted.source.state.shared[0]?.name).toBe('gate.open');
  expect(f.fetches()).toBe(1);
  const visited = structuredClone(f.cache.products.get(base));
  await expect(admitProduct(f.shard, f.options)).rejects.toThrow('backwards');
  expect(f.cache.products.get(base)).toEqual(visited);
  const recycling = structuredClone(next); recycling.identity.revision++; recycling.state.version++;
  Object.assign(recycling, { migrations: [{ from: 2, to: 3, fields: [{ op: 'drop', scope: 'shared', id: 7 }] }] });
  await expect(admitProduct(recycling, f.options)).rejects.toThrow('reused');
  expect(f.cache.products.get(base)).toEqual(visited);
});
it('upgrades legacy visited geometry online using strict state lineage, while offline legacy geometry remains illegal', async () => {
  const f = fixture(); f.shard.state.shared.push({ id: 7, name: 'door.open', type: 'bool', privacy: 'public', default: false });
  await admitProduct(f.shard, f.options);
  const { entryways, ...legacy } = structuredClone(f.shard); expect(entryways).toBeDefined();
  f.cache.products.set(base, { source: legacy, firstParty: true });
  await expect(admitProduct(f.shard, { ...f.options, offline: true, firstParty: true })).rejects.toThrow('entryways');
  const next = structuredClone(f.shard); next.identity.revision++;
  next.state.shared = [];
  await expect(admitProduct(next, f.options)).rejects.toThrow('explicit');
  expect(f.cache.products.get(base)?.source).toEqual(legacy);
  next.state.shared = structuredClone(f.shard.state.shared);
  expect((await admitProduct(next, f.options)).source.identity.revision).toBe(next.identity.revision);
  const corrupt = structuredClone(legacy), field = corrupt.state.shared[0]; if (field === undefined) throw new Error('Missing state field'); field.default = 2;
  f.cache.products.set(base, { source: corrupt, firstParty: true });
  await expect(admitProduct(next, f.options)).rejects.toThrow('state declaration');
  expect(f.cache.products.get(base)?.source).toEqual(corrupt);
});

function parallelFixture() {
  const shard = empty(), cache = cacheFixture(), payloads = new Map<string, Uint8Array>();
  for (let value = 0; value < 9; value++) {
    const bytes = new TextEncoder().encode(JSON.stringify({ value })), hash = contentHash(bytes);
    payloads.set(hash, bytes);
    shard.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
    shard.library.push(hash); shard.budgets.library.compressed += bytes.length; shard.budgets.library.resident += bytes.length;
  }
  const pending = new Map<string, (response: Response) => void>(); let active = 0, peak = 0, reserved = false;
  const options: ProductOptions = { base, cache, offline: false, firstParty: true,
    reserve: () => { reserved = true; }, hash: (bytes) => Promise.resolve(contentHash(bytes)),
    fetch: (url) => { expect(reserved).toBe(true); active++; peak = Math.max(peak, active);
      return new Promise<Response>((resolve) => { pending.set(url.slice(base.length), (response) => { active--; resolve(response); }); }); },
  };
  const release = (corrupt = false) => {
    const wave = [...pending].reverse(); pending.clear();
    for (const [hash, resolve] of wave) {
      const bytes = payloads.get(hash); if (bytes === undefined) throw new Error('Missing payload');
      resolve(new Response(corrupt ? new Uint8Array(bytes.length) : Uint8Array.from(bytes)));
    }
  };
  return { shard, cache, options, pending, release, peak: () => peak };
}
it('overlaps four bounded asset reads per wave, retaining authored order and offline byte identity', async () => {
  const f = parallelFixture(), run = admitProduct(f.shard, f.options);
  await vi.waitFor(() => expect(f.pending.size).toBe(4)); f.release();
  await vi.waitFor(() => expect(f.pending.size).toBe(4)); f.release();
  await vi.waitFor(() => expect(f.pending.size).toBe(1)); f.release();
  const product = await run;
  expect(f.peak()).toBe(4); expect([...product.assets.keys()]).toEqual(f.shard.library);
  const offline = await admitProduct(f.shard, { ...f.options, offline: true, fetch: () => Promise.reject(new Error('No network')) });
  expect([...offline.assets]).toEqual([...product.assets]); expect(f.cache.products.size).toBe(1);
});
it('settles a failed transport wave without starting later waves or publishing cache', async () => {
  const f = parallelFixture(), run = admitProduct(f.shard, f.options);
  const rejection = expect(run).rejects.toThrow('hash mismatch');
  await vi.waitFor(() => expect(f.pending.size).toBe(4)); f.release(true); await rejection;
  expect(f.peak()).toBe(4); expect(f.pending.size).toBe(0);
  expect(f.cache.bytes.size).toBe(0); expect(f.cache.products.size).toBe(0);
});

it('shares one transport for identical file and commons addresses', async () => {
  const f = fixture();
  f.shard.requires.commons.push(f.hash); f.shard.requires.commonsWire[f.hash] = f.bytes.length;
  f.shard.requires.commonsCosts[f.hash] = { decoded: f.bytes.length, gpu: 0, triangles: 0, draws: 0 };
  f.shard.library.push(`commons:${f.hash}`);
  f.shard.budgets.library.compressed *= 2; f.shard.budgets.library.resident *= 2;
  const product = await admitProduct(f.shard, f.options);
  expect(f.fetches()).toBe(1); expect(product.assets.get(f.hash)).toBe(product.assets.get(`commons:${f.hash}`));
});

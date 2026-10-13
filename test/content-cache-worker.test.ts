import { afterEach, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { ContentCache } from '../src/engine/boot/contentCache';
import { ContentCacheWorker, type CacheWorkerPort } from '../src/engine/boot/contentCacheWorker';
import { CacheCommandSchema, type CacheCommand, type CacheValue } from '../src/engine/boot/contentCacheProtocol';
import { admitProduct, browserContentHash, browserProductCache, type CachedProduct, type ProductCache } from '../src/game/shardfile/product';

class Disk {
  readonly rows = new Map<string, Response>();
  readonly storage = { open: () => Promise.resolve(this.cache) };
  private url(request: RequestInfo | URL): string { return request instanceof Request ? request.url : String(request); }
  readonly cache: Cache = {
    match: request => Promise.resolve(this.rows.get(this.url(request))?.clone()),
    put: (request, response) => { this.rows.set(this.url(request), response.clone()); return Promise.resolve(); },
    delete: request => Promise.resolve(this.rows.delete(this.url(request))),
    keys: () => Promise.resolve([...this.rows.keys()].map(url => new Request(url))),
    matchAll: () => Promise.resolve([...this.rows.values()].map(response => response.clone())),
    add: () => Promise.reject(new Error('Fixture never fetches')),
    addAll: () => Promise.reject(new Error('Fixture never fetches')),
  };
}
class Actor extends EventTarget implements CacheWorkerPort {
  stopped = false;
  silent = false;
  calls: string[] = [];
  private tail = Promise.resolve();
  private readonly leases = new Map<number, () => void>();
  constructor(readonly cache: ContentCache) { super(); }
  terminate(): void { this.stopped = true; }
  private live(): boolean { return !this.stopped && !this.silent; }
  private async perform(row: CacheCommand): Promise<CacheValue> {
    switch (row.op) {
      case 'get': return this.cache.get(row.hash);
      case 'has': { const bytes = await this.cache.get(row.hash); return bytes !== null && bytes.length === row.bytes; }
      case 'put': return this.cache.put(row.hash, row.bytes);
      case 'flush': await this.cache.flush(); return null;
      case 'stats': return this.cache.stats();
      case 'pin': this.leases.set(row.lease, this.cache.pin(row.hashes)); return null;
      case 'release': this.leases.get(row.lease)?.(); this.leases.delete(row.lease); return null;
      default: throw new Error('Unknown cache operation');
    }
  }
  postMessage(input: unknown): void {
    const row = v.parse(CacheCommandSchema, structuredClone(input)); this.calls.push(row.op);
    this.tail = this.tail.then(async () => {
      if (!this.live()) return undefined;
      try {
        const value = await this.perform(row);
        if (this.live()) this.dispatchEvent(new MessageEvent('message', { data: { id: row.id, ok: true, value } }));
      } catch (error: unknown) {
        this.dispatchEvent(new MessageEvent('message', { data: { id: row.id, ok: false, error: error instanceof Error ? error.message : String(error) } }));
      }
      return undefined;
    });
  }
}
const cleanup: (() => Promise<void>)[] = [];
function fixture(maxBytes = 100, maxEntries = 8, extra: { requestMs?: number; idleMs?: number; lifeMs?: number; pagehide?: EventTarget } = {}, hash = browserContentHash) {
  const disk = new Disk(), ports = { storage: disk.storage, origin: 'https://cache.test', hash, maxBytes, maxEntries, reserveBytes: 0 };
  const fallback = new ContentCache(ports), actor = new Actor(new ContentCache(ports));
  const bridge = new ContentCacheWorker(fallback, { worker: () => actor, ...extra });
  cleanup.push(async () => { await bridge.close(); await fallback.flush(); await actor.cache.flush(); });
  return { disk, fallback, actor, bridge };
}
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.useRealTimers(); });

it('verifies cold and warm bytes, snapshots puts and returns independent reads', async () => {
  const f = fixture(), input = Uint8Array.of(1, 2, 3), hash = await browserContentHash(input);
  const write = f.bridge.put(hash, input); input[0] = 99;
  expect(await write).toBe(true); expect(input.byteLength).toBe(3);
  expect(await f.bridge.has(hash, 3)).toBe(true); expect(await f.bridge.has(hash, 4)).toBe(false);
  const first = await f.bridge.get(hash); if (first === null) throw new Error('Missing verified bytes');
  expect([...first]).toEqual([1, 2, 3]); first[1] = 99;
  expect([...(await f.bridge.get(hash) ?? [])]).toEqual([1, 2, 3]);
  expect(await f.bridge.stats()).toEqual({ bytes: 3, entries: 1 });
});
it('turns corruption into a miss and keeps forged writes fatal without failover', async () => {
  const f = fixture(), bytes = Uint8Array.of(1), hash = await browserContentHash(bytes);
  await f.bridge.put(hash, bytes);
  f.disk.rows.set(`https://cache.test/__ws_content__/v0/${hash}`, new Response(Uint8Array.of(2)));
  expect(await f.bridge.get(hash)).toBeNull(); expect(await f.bridge.has(hash, 1)).toBe(false);
  await expect(f.bridge.put(hash, Uint8Array.of(2))).rejects.toThrow('Invalid immutable content bytes');
  expect(f.actor.stopped).toBe(false);
  await expect(f.bridge.put(hash, new Uint8Array(25_000_001))).rejects.toThrow('Invalid immutable content bytes');
});
it('orders pin controls before puts and carries refcounted leases into verified fallback', async () => {
  const f = fixture(1, 1), a = Uint8Array.of(1), b = Uint8Array.of(2), ha = await browserContentHash(a), hb = await browserContentHash(b);
  await f.bridge.put(ha, a);
  const release = f.bridge.pin([ha]), second = f.bridge.pin([ha]);
  expect(await f.bridge.put(hb, b)).toBe(false);
  expect(f.actor.calls.slice(-3)).toEqual(['pin', 'pin', 'put']);
  f.actor.dispatchEvent(new Event('error')); expect(f.actor.stopped).toBe(true);
  expect(await f.bridge.put(hb, b)).toBe(false); release(); release();
  expect(await f.bridge.put(hb, b)).toBe(false); second();
  expect(await f.bridge.put(hb, b)).toBe(true); expect(await f.bridge.get(ha)).toBeNull();
});
it('settles in-flight reads on worker message errors through the checked fallback', async () => {
  const f = fixture(), bytes = Uint8Array.of(3), hash = await browserContentHash(bytes);
  await f.bridge.put(hash, bytes); f.actor.silent = true;
  const read = f.bridge.get(hash); f.actor.dispatchEvent(new Event('messageerror'));
  expect([...(await read ?? [])]).toEqual([3]); expect(f.actor.stopped).toBe(true);
});
it('bounds silent worker exit and idle lifetime, flushing before graceful teardown', async () => {
  vi.useFakeTimers();
  const f = fixture(100, 8, { requestMs: 20, idleMs: 30, lifeMs: 100 });
  const bytes = Uint8Array.of(3), hash = await browserContentHash(bytes);
  await f.bridge.put(hash, bytes); f.actor.silent = true;
  const read = f.bridge.get(hash); await vi.advanceTimersByTimeAsync(20);
  expect([...(await read ?? [])]).toEqual([3]); expect(f.actor.stopped).toBe(true);
  const idle = fixture(100, 8, { requestMs: 20, idleMs: 30, lifeMs: 100 });
  await idle.bridge.put(hash, bytes); await vi.advanceTimersByTimeAsync(30);
  expect(idle.actor.stopped).toBe(true); expect(idle.actor.calls.at(-1)).toBe('flush');
});
it('falls back on startup failure and refuses malformed worker replies', async () => {
  const f = fixture(), startup = new ContentCacheWorker(f.fallback, { worker: () => { throw new Error('No worker'); } });
  cleanup.push(() => startup.close());
  const bytes = Uint8Array.of(7), hash = await browserContentHash(bytes);
  expect(await startup.put(hash, bytes)).toBe(true);
  f.actor.silent = true; const read = f.bridge.get(hash);
  f.actor.dispatchEvent(new MessageEvent('message', { data: { id: 1, ok: true, value: 'unchecked bytes' } }));
  expect([...(await read ?? [])]).toEqual([7]); expect(f.actor.stopped).toBe(true);
});
it('flushes read ages on pagehide and preserves injected CacheStorage ports', async () => {
  const page = new EventTarget(), f = fixture(100, 8, { pagehide: page }), bytes = Uint8Array.of(5), hash = await browserContentHash(bytes);
  await f.bridge.put(hash, bytes); await f.bridge.get(hash); page.dispatchEvent(new Event('pagehide'));
  await f.bridge.close(); expect(f.actor.stopped).toBe(true);
  const globals = ['window', 'location', 'navigator', 'Worker', 'caches'];
  const before = globals.map(key => ({ key, value: Reflect.get(globalThis, key) as unknown }));
  cleanup.push(() => { for (const row of before) vi.stubGlobal(row.key, row.value); return Promise.resolve(); });
  const worker = vi.fn(() => { throw new Error('Injected cache must not create a worker'); });
  vi.stubGlobal('Worker', worker); vi.stubGlobal('caches', f.disk.storage);
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('location', { origin: 'https://cache.test' });
  vi.stubGlobal('navigator', { storage: { estimate: () => Promise.resolve({}) } });
  const cache = browserProductCache(f.disk.storage);
  expect([...(await cache.asset('https://cache.test/shards/', hash) ?? [])]).toEqual([5]);
  expect(cache.verifiedPresent).toBeUndefined(); expect(worker).not.toHaveBeenCalled();
});

it('publishes only durable worker-verified files and refuses corrupt offline bytes without fetching', async () => {
  const f = fixture(), bytes = new TextEncoder().encode('{"value":7}'), hash = await browserContentHash(bytes);
  const source = emptyShardfile({ slug: 'cache-worker-fixture', name: 'Cache', author: 'Local', seed: 1, revision: 1 });
  source.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  source.library.push(hash); source.budgets.library = { compressed: bytes.length, resident: bytes.length };
  const visited = new Map<string, CachedProduct>(), present = vi.fn((key: string, size: number) => f.bridge.has(key, size));
  const cache: ProductCache = { product: key => Promise.resolve(visited.get(key) ?? null), asset: (_base, key) => f.bridge.get(key),
    verifiedPresent: present, putAsset: (_base, key, value) => f.bridge.put(key, value), pin: hashes => f.bridge.pin(hashes),
    putProduct: (key, value) => { visited.set(key, structuredClone(value)); return Promise.resolve(); } };
  const fetch = vi.fn(() => Promise.resolve(new Response(bytes)));
  const options = { base: 'https://cache.test/products/', firstParty: true, offline: false, cache, hash: browserContentHash, fetch };
  const admitted = await admitProduct(source, options);
  expect(visited.size).toBe(1); expect(present).toHaveBeenCalledWith(hash, bytes.length);
  expect([...(admitted.assets.get(hash) ?? [])]).toEqual([...bytes]);
  await admitProduct(source, { ...options, offline: true }); expect(fetch).toHaveBeenCalledTimes(1);
  f.disk.rows.set(`https://cache.test/__ws_content__/v0/${hash}`, new Response(new Uint8Array(bytes.length)));
  await expect(admitProduct(source, { ...options, offline: true })).rejects.toThrow('incomplete offline cache');
  expect(fetch).toHaveBeenCalledTimes(1);
});


it.each(['error', 'messageerror', 'deadline', 'overflow'])('drains delayed hashes in order after %s, including later requests and close', async kind => {
  let releaseHash: () => void = () => undefined, hashing: () => void = () => undefined;
  const held = new Promise<void>(resolve => { releaseHash = resolve; });
  const started = new Promise<void>(resolve => { hashing = resolve; });
  const delayedHash = async (bytes: Uint8Array) => {
    if (bytes[0] === 3) { hashing(); await held; }
    return browserContentHash(bytes);
  };
  const f = fixture(100, 100, { requestMs: 20 }, delayedHash);
  f.actor.silent = true;
  const bytes = Uint8Array.of(3), hash = await browserContentHash(bytes);
  const write = f.bridge.put(hash, bytes), read = f.bridge.get(hash);
  const overflow: Promise<boolean>[] = [];
  if (kind === 'overflow') for (let i = 0; i < 63; i++) overflow.push(f.bridge.has(hash, 1));
  else if (kind !== 'deadline') f.actor.dispatchEvent(new Event(kind));
  await started;
  const later = f.bridge.has(hash, 1);
  let closed = false;
  const close = f.bridge.close().then(() => { closed = true; return undefined; });
  await Promise.resolve(); await Promise.resolve();
  expect(closed).toBe(false); expect(f.actor.stopped).toBe(true);
  releaseHash();
  expect(await write).toBe(true); expect([...(await read ?? [])]).toEqual([3]);
  expect(await later).toBe(true); expect(await Promise.all(overflow)).toEqual(overflow.map(() => true));
  await close; expect(closed).toBe(true);
  await expect(f.bridge.put(hash, Uint8Array.of(4))).rejects.toThrow('Invalid immutable content bytes');
  expect(await f.bridge.put(hash, bytes)).toBe(true);
  expect([...(await f.bridge.get(hash) ?? [])]).toEqual([3]);
});

it('retains both live leases through delayed replay and releases them in request order', async () => {
  let releaseHash: () => void = () => undefined, hashing: () => void = () => undefined;
  const held = new Promise<void>(resolve => { releaseHash = resolve; });
  const started = new Promise<void>(resolve => { hashing = resolve; });
  const delayedHash = async (bytes: Uint8Array) => {
    if (bytes[0] === 2) { hashing(); await held; }
    return browserContentHash(bytes);
  };
  const f = fixture(1, 1, {}, delayedHash), a = Uint8Array.of(1), b = Uint8Array.of(2);
  const ha = await browserContentHash(a), hb = await browserContentHash(b);
  await f.bridge.put(ha, a);
  const first = f.bridge.pin([ha]), second = f.bridge.pin([ha]);
  f.actor.silent = true;
  const blocked = f.bridge.put(hb, b);
  first(); f.actor.dispatchEvent(new Event('error'));
  await started; second();
  const admitted = f.bridge.put(hb, b);
  releaseHash();
  expect(await blocked).toBe(false); expect(await admitted).toBe(true);
  expect(await f.bridge.get(ha)).toBeNull();
});

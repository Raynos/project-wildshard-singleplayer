import { expect, it } from 'vitest';
import { ContentCache, CONTENT_CACHE_NAME, type ContentCachePorts } from '../src/engine/boot/contentCache';
import { browserContentHash } from '../src/game/shardfile/product';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the real worker activation policy against isolated cache names.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The worker is a stamped script rather than a Node module.
import { runInNewContext } from 'node:vm';

function fixture(maxBytes = 20): { cache: ContentCache; ports: ContentCachePorts; files: Map<string, Response>; quota: (value: number) => void } {
  const files = new Map<string, Response>(); let quota = Infinity;
  const url = (value: RequestInfo | URL) => value instanceof Request ? value.url : String(value);
  const disk: Pick<Cache, 'match' | 'put' | 'delete' | 'keys'> = {
    match: (value) => Promise.resolve(files.get(url(value))?.clone()),
    put: async (value, response) => {
      if (url(value).endsWith('/index')) { files.set(url(value), response.clone()); return; }
      const next = (await response.clone().arrayBuffer()).byteLength;
      let bytes = next;
      for (const [key, old] of files) if (!key.endsWith('/index') && key !== url(value)) bytes += (await old.clone().arrayBuffer()).byteLength;
      if (bytes > quota) throw new DOMException('No disk space', 'QuotaExceededError');
      files.set(url(value), response.clone());
    },
    delete: (value) => Promise.resolve(files.delete(url(value))),
    keys: () => Promise.resolve([...files.keys()].map((key) => new Request(key))),
  };
  const ports: ContentCachePorts = { storage: { open: (name) => { expect(name).toBe(CONTENT_CACHE_NAME); return Promise.resolve(disk); } }, origin: 'https://world.test', hash: browserContentHash, maxBytes, reserveBytes: 0, now: () => 1 };
  return { cache: new ContentCache(ports), ports, files, quota: (value) => { quota = value; } };
}
const bytes = (value: number): Uint8Array => Uint8Array.from({ length: 8 }, () => value);

it('downloads each immutable address once, reloads durable cache metadata, and replays offline without a fetch', async () => {
  const f = fixture(), asset = bytes(1), hash = await browserContentHash(asset); let downloads = 0;
  const download = () => { downloads++; return Promise.resolve(asset); };
  const first = await f.cache.load(hash, download); first[0] = 99;
  expect(await f.cache.load(hash, download)).toEqual(asset);
  const reloaded = new ContentCache(f.ports);
  expect(await reloaded.load(hash, () => Promise.reject(new Error('offline network')), true)).toEqual(asset);
  expect(downloads).toBe(1); expect(await reloaded.stats()).toEqual({ bytes: 8, entries: 1 });
});

it('shares concurrent downloads and returns independent owned byte arrays', async () => {
  const f = fixture(), asset = bytes(2), hash = await browserContentHash(asset); let downloads = 0;
  const download = async () => { downloads++; await Promise.resolve(); return asset; };
  const [left, right] = await Promise.all([f.cache.load(hash, download), f.cache.load(hash, download)]);
  left[0] = 42; expect(right).toEqual(asset); expect(downloads).toBe(1);
});

it('evicts the least recently used unpinned address and keeps leases until every owner releases', async () => {
  const f = fixture(16), a = bytes(1), b = bytes(2), c = bytes(3);
  const [ha, hb, hc] = await Promise.all([a, b, c].map(browserContentHash));
  if (ha === undefined || hb === undefined || hc === undefined) throw new Error('Missing fixture address');
  await f.cache.put(ha, a); await f.cache.put(hb, b);
  const release = f.cache.pin([ha]), releaseAgain = f.cache.pin([ha]); release();
  await f.cache.put(hc, c); expect(await f.cache.get(hb)).toBeNull(); expect(await f.cache.get(ha)).toEqual(a);
  releaseAgain(); releaseAgain(); await f.cache.get(hc); await f.cache.put(hb, b);
  expect(await f.cache.get(ha)).toBeNull(); expect(await f.cache.stats()).toEqual({ bytes: 16, entries: 2 });
});

it('retries a browser quota failure after evicting old bytes, and refuses to evict protected content', async () => {
  const f = fixture(), a = bytes(1), b = bytes(2), ha = await browserContentHash(a), hb = await browserContentHash(b);
  await f.cache.put(ha, a); f.quota(8);
  const release = f.cache.pin([ha]); expect(await f.cache.put(hb, b)).toBe(false); expect(await f.cache.get(ha)).toEqual(a);
  release(); expect(await f.cache.put(hb, b)).toBe(true); expect(await f.cache.get(ha)).toBeNull();
});

it('reserves origin quota headroom and bounds the number of persistent entries', async () => {
  const f = fixture(), cache = new ContentCache({ ...f.ports, estimate: () => Promise.resolve({ quota: 40, usage: 35 }), reserveBytes: 4, maxEntries: 1 });
  const a = bytes(1), ha = await browserContentHash(a); expect(await cache.put(ha, a)).toBe(false);
  const count = new ContentCache({ ...f.ports, maxEntries: 1 }); await count.put(ha, a);
  const b = bytes(2), hb = await browserContentHash(b); await count.put(hb, b);
  expect(await count.get(ha)).toBeNull(); expect(await count.stats()).toEqual({ bytes: 8, entries: 1 });
});

it('refuses forged writes and treats corrupted stored bytes as an offline miss', async () => {
  const f = fixture(), a = bytes(1), hash = await browserContentHash(a);
  await expect(f.cache.put(hash, bytes(2))).rejects.toThrow('Invalid immutable');
  await f.cache.put(hash, a);
  const key = [...f.files.keys()].find((value) => value.endsWith(hash)); if (key === undefined) throw new Error('Missing cached address');
  f.files.set(key, new Response(Uint8Array.from(bytes(2))));
  await expect(f.cache.load(hash, () => Promise.reject(new Error('must not fetch')), true)).rejects.toThrow('unavailable offline');
  expect(await f.cache.stats()).toEqual({ bytes: 0, entries: 0 });
});

it('recovers immutable entries when the index is lost, and notices browser eviction', async () => {
  const f = fixture(), a = bytes(1), hash = await browserContentHash(a); await f.cache.put(hash, a);
  for (const key of f.files.keys()) if (key.endsWith('/index')) f.files.delete(key);
  const reloaded = new ContentCache(f.ports); expect(await reloaded.get(hash)).toEqual(a);
  for (const key of f.files.keys()) if (key.endsWith(hash)) f.files.delete(key);
  expect(await reloaded.get(hash)).toBeNull(); expect(await reloaded.stats()).toEqual({ bytes: 0, entries: 0 });
});

it('keeps content bytes and visited manifests across service-worker activation', async () => {
  let activate: ((event: { waitUntil: (work: Promise<void>) => void }) => void) | undefined;
  const names = new Set(['ws-content-v0', 'ws-shardfile-products-v0', 'ws-obsolete-build']);
  const source = readFileSync(new URL('../src/engine/pwa/sw.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/mu, '').replaceAll('__BUNDLE__', '[]').replaceAll('__FONTS__', '[]');
  runInNewContext(source, {
    URL, Request, Response, console,
    self: { location: { origin: 'https://world.test' }, clients: { claim: () => Promise.resolve() } },
    caches: { keys: () => Promise.resolve([...names]), delete: (name: string) => Promise.resolve(names.delete(name)), open: () => Promise.resolve({ keys: () => Promise.resolve([]) }) },
    workerScope: {
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Record the actual worker's event installer without running other events.
      listen: (_target: object, name: string, callback: typeof activate) => { if (name === 'activate') activate = callback; },
    },
    fetch: () => Promise.reject(new Error('offline')),
  });
  let finished: Promise<void> | undefined;
  if (activate === undefined) throw new Error('Worker activation missing');
  activate({ waitUntil: (work) => { finished = work; } }); await finished;
  expect([...names]).toEqual(['ws-content-v0', 'ws-shardfile-products-v0']);
});

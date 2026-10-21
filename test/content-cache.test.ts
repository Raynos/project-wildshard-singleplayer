import { afterEach, expect, test } from 'vitest';
import { ContentCache } from '../src/engine/boot/contentCache';
import { hashImmutableBytes } from '../src/sdk/immutable';

const stores: ContentCache[] = [];
afterEach(async () => { for (const store of stores.splice(0)) await store.flush(); });

function fixture(limits: { maxBytes?: number; maxEntries?: number } = {}): { open: () => ContentCache; disk: Map<string, Response>; writes: string[]; key: (hash: string) => string } {
  const disk = new Map<string, Response>(), writes: string[] = [], root = 'https://cache.test/__ws_content__/v0/';
  const url = (input: RequestInfo | URL): string => input instanceof Request ? input.url : String(input);
  const cache = {
    match: (input: RequestInfo | URL) => Promise.resolve(disk.get(url(input))?.clone()),
    put: (input: RequestInfo | URL, response: Response) => { const key = url(input); writes.push(key); disk.set(key, response.clone()); return Promise.resolve(); },
    delete: (input: RequestInfo | URL) => Promise.resolve(disk.delete(url(input))),
    keys: () => Promise.resolve([...disk.keys()].map(key => new Request(key))),
  };
  let time = 0;
  return { disk, writes, key: hash => `${root}${hash}`, open: () => {
    const store = new ContentCache({ storage: { open: () => Promise.resolve(cache) }, origin: 'https://cache.test',
      hash: bytes => Promise.resolve(hashImmutableBytes(bytes)), maxBytes: 1024, maxEntries: 8, reserveBytes: 0, now: () => ++time, ...limits });
    stores.push(store); return store;
  } };
}

test('blob writes are durable while index updates batch until an explicit flush', async () => {
  const ports = fixture(), store = ports.open(), one = new Uint8Array([1]), two = new Uint8Array([2, 3]);
  const first = hashImmutableBytes(one), second = hashImmutableBytes(two);
  expect(await store.put(first, one)).toBe(true);
  expect(await store.put(second, two)).toBe(true);
  expect(ports.disk.has(ports.key(first))).toBe(true);
  expect(ports.disk.has(ports.key(second))).toBe(true);
  expect(ports.writes.filter(key => key.endsWith('/index'))).toHaveLength(1); // Initial recovery only.
  expect(await store.stats()).toEqual({ bytes: 3, entries: 2 });
  expect(await store.get(first)).toEqual(one);
  await store.flush();
  expect(ports.writes.filter(key => key.endsWith('/index'))).toHaveLength(2);
  expect(await ports.open().get(second)).toEqual(two);
});

test('stale indexes recover durable blobs and batch corruption or eviction removals', async () => {
  const ports = fixture(), store = ports.open(), bytes = new Uint8Array([4, 5]), hash = hashImmutableBytes(bytes);
  expect(await store.put(hash, bytes)).toBe(true);
  // The durable blob headers recover a write whose index was not flushed.
  const reopened = ports.open();
  expect(await reopened.get(hash)).toEqual(bytes);
  expect(await reopened.stats()).toEqual({ bytes: 2, entries: 1 });
  const before = ports.writes.length;
  ports.disk.set(ports.key(hash), new Response(new Uint8Array([9])));
  expect(await reopened.get(hash)).toBeNull();
  expect(await reopened.stats()).toEqual({ bytes: 0, entries: 0 });
  expect(ports.writes).toHaveLength(before);
  await reopened.flush();
  expect(ports.writes).toHaveLength(before + 1);
});

test('pinned eviction refusals preserve exact totals before a later successful write', async () => {
  const ports = fixture({ maxBytes: 4, maxEntries: 2 }), store = ports.open();
  const one = Uint8Array.of(1, 2), two = Uint8Array.of(3, 4), three = Uint8Array.of(5, 6, 7);
  const first = hashImmutableBytes(one), second = hashImmutableBytes(two), third = hashImmutableBytes(three);
  await store.put(first, one); await store.put(second, two);
  const release = store.pin([first]);
  expect(await store.put(third, three)).toBe(false);
  expect(await store.stats()).toEqual({ bytes: 2, entries: 1 });
  expect(await store.get(first)).toEqual(one);
  expect(await store.get(second)).toBeNull();
  release();
  expect(await store.put(third, three)).toBe(true);
  expect(await store.stats()).toEqual({ bytes: 3, entries: 1 });
  await store.flush();
  expect(await ports.open().stats()).toEqual({ bytes: 3, entries: 1 });
});

test('a verified read repairs stale byte totals and browser eviction removes them', async () => {
  const ports = fixture(), store = ports.open(), bytes = Uint8Array.of(7, 8), hash = hashImmutableBytes(bytes);
  await store.put(hash, bytes); await store.flush();
  ports.disk.set(ports.key('index'), Response.json({ [hash]: { bytes: 9, used: 1 } }));
  const reopened = ports.open();
  expect(await reopened.stats()).toEqual({ bytes: 9, entries: 1 });
  expect(await reopened.get(hash)).toEqual(bytes);
  expect(await reopened.stats()).toEqual({ bytes: 2, entries: 1 });
  ports.disk.delete(ports.key(hash));
  expect(await reopened.get(hash)).toBeNull();
  expect(await reopened.stats()).toEqual({ bytes: 0, entries: 0 });
});

test('recent reads and reopening preserve durable least-recent eviction order', async () => {
  const ports = fixture({ maxEntries: 2 }), store = ports.open();
  const rows = [Uint8Array.of(1), Uint8Array.of(2, 3), Uint8Array.of(4, 5, 6), Uint8Array.of(7)];
  const hashes = rows.map(hashImmutableBytes), [first, second, third, fourth] = hashes;
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) throw new Error('Missing cache fixture');
  await store.put(first, Uint8Array.of(1)); await store.put(second, Uint8Array.of(2, 3));
  await store.get(first);
  await store.put(third, Uint8Array.of(4, 5, 6));
  expect(await store.get(second)).toBeNull();
  expect(await store.stats()).toEqual({ bytes: 4, entries: 2 });
  await store.flush();
  const reopened = ports.open();
  await reopened.put(fourth, Uint8Array.of(7));
  expect(await reopened.get(first)).toBeNull();
  expect(await reopened.stats()).toEqual({ bytes: 4, entries: 2 });
});

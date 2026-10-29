import {expect, test, vi} from 'vitest';
import {downloadSpawnManifest, type SpawnDownloadSnapshot} from '../src/game/boot/spawnDownload';
import {readSpawnManifest} from '../src/format/spawnManifest';

const files = [{url: `/shardfiles/example/blobs/bin/${'a'.repeat(64)}.bin`, bytes: 4, hash: 'a'.repeat(64)},
  {url: '/assets/code-12345678.js', bytes: 3, hash: 'b'.repeat(64)}];
const manifest = {version: 1, shard: 'example', tier: 'phone', flow: 'client', files, totalBytes: 7};
const text = JSON.stringify(manifest), address = {url: '/assets/spawn/example-1234567890abcdef.json', bytes: text.length, totalBytes: 7, files: 2};
const base = 'https://example.test/';

test('cold progress is exactly the one list, with a fixed denominator and no unrelated credit', async () => {
  const reads: string[] = [], snapshots: SpawnDownloadSnapshot[] = [];
  const download = downloadSpawnManifest(address, {cached: () => Promise.resolve(undefined), fetch: url => {
    reads.push(new URL(url).pathname);
    return Promise.resolve(new Response(url.endsWith('.json') ? text : new Uint8Array(url.endsWith('.js') ? 3 : 4)));
  }}, base);
  download.subscribe(row => {snapshots.push(row);}); await download.ready;
  expect(reads).toEqual([address.url, ...files.map(row => row.url)]);
  expect(download.snapshot()).toEqual({totalBytes: 7, completedBytes: 7, cachedBytes: 0, filesTotal: 2, filesDone: 2, complete: true, error: null});
  expect(snapshots.every(row => row.totalBytes === 7 && row.completedBytes <= 7)).toBe(true);
  expect(snapshots.map(row => row.completedBytes)).toEqual(snapshots.map(row => row.completedBytes).sort((a, b) => a - b));
});

test('a warm list completes from native presence without fetching or reading any cached file body', async () => {
  const unread: (() => void)[] = [];
  const download = downloadSpawnManifest(address, {cached: url => Promise.resolve(url.endsWith('.json') ? new Response(text)
    : (() => {const response = new Response(new Uint8Array(4)), body = response.body;
      if (body === null) throw new Error('Missing cache body');
      const reader = vi.spyOn(body, 'getReader'); unread.push(() => {expect(reader).not.toHaveBeenCalled();}); return response;})()),
    fetch: () => Promise.reject(new Error('Warm files must not be fetched'))}, base);
  await download.ready;
  for (const check of unread) check();
  expect(download.snapshot()).toMatchObject({complete: true, completedBytes: 7, cachedBytes: 7, filesDone: 2});
});

test('one native metadata census completes a warm list without per-file cache calls', async () => {
  const cached = vi.fn((url: string) => {
    if (!url.endsWith('.json')) throw new Error('Unexpected individual file census');
    return Promise.resolve(new Response(text));
  });
  const present = vi.fn((urls: readonly string[]) => Promise.resolve(new Set(urls))), fetch = vi.fn(() => Promise.reject(new Error('Unexpected warm network')));
  const download = downloadSpawnManifest(address, {cached, present, fetch}, base); await download.ready;
  expect(present).toHaveBeenCalledExactlyOnceWith(files.map(row => new URL(row.url, base).href));
  expect(cached).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
  expect(download.snapshot()).toMatchObject({complete: true, cachedBytes: 7, filesDone: 2});
});

test.each([2, 5])('a short/oversized body (%s) never completes or exceeds the manifest total', async count => {
  const download = downloadSpawnManifest({...address, files: 1, totalBytes: 4, bytes: JSON.stringify({...manifest, files: [files[0]], totalBytes: 4}).length}, {
    cached: () => Promise.resolve(undefined), fetch: url => Promise.resolve(new Response(url.endsWith('.json') ? JSON.stringify({...manifest, files: [files[0]], totalBytes: 4}) : new Uint8Array(count))),
  }, base);
  await expect(download.ready).rejects.toThrow('size differs');
  expect(download.snapshot().complete).toBe(false); expect(download.snapshot().completedBytes).toBeLessThanOrEqual(4);
});

test('bad totals/duplicate URLs refuse, and an error cached response is a miss', async () => {
  expect(() => readSpawnManifest({...manifest, totalBytes: 8})).toThrow('total differs');
  expect(() => readSpawnManifest({...manifest, files: [files[0], files[0]], totalBytes: 8})).toThrow('spawn file');
  const reads: string[] = [];
  const download = downloadSpawnManifest(address, {cached: url => Promise.resolve(url.endsWith('.json') ? new Response(text) : new Response(null, {status: 404})), fetch: url => {
    reads.push(url); return Promise.resolve(new Response(url.endsWith('.json') ? text : new Uint8Array(url.endsWith('.js') ? 3 : 4)));
  }}, base);
  await download.ready; expect(reads).toEqual(files.map(row => new URL(row.url, base).href));
  expect(download.snapshot()).toMatchObject({complete: true, cachedBytes: 0});
});

test('an uncontrolled first install fills the same cache before the next warm presence census', async () => {
  const stored = new Map<string, Uint8Array>(); let reads = 0;
  const ports = {
    cached: (url: string) => {const bytes = stored.get(url); return Promise.resolve(bytes === undefined ? undefined : new Response(new Uint8Array(bytes)));},
    fetch: (url: string) => {reads++; return Promise.resolve(new Response(url.endsWith('.json') ? text : new Uint8Array(url.endsWith('.js') ? 3 : 4)));},
    store: async (url: string, response: Response) => {stored.set(url, new Uint8Array(await response.arrayBuffer()));},
  };
  const cold = downloadSpawnManifest(address, ports, base); await cold.ready;
  expect(reads).toBe(3); expect(stored.size).toBe(3);
  expect(cold.snapshot()).toMatchObject({complete: true, cachedBytes: 0, completedBytes: 7});
  const warm = downloadSpawnManifest(address, ports, base); await warm.ready;
  expect(reads).toBe(3); expect(warm.snapshot()).toMatchObject({complete: true, cachedBytes: 7, completedBytes: 7});
});

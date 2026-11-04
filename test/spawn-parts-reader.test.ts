// @vitest-environment happy-dom
import {afterEach, expect, test, vi} from 'vitest';
import {downloadSpawnManifest, releaseSpawnMembers, type HeldParts} from '../src/game/boot/spawnDownload';

const hash = 'c'.repeat(64), base = 'https://example.test/';
// Real sha256 of each body: the reader checks every member against its manifest row.
const bin = {url: `/shardfiles/example/blobs/bin/${'a'.repeat(64)}.bin`, bytes: 4, hash: '27ecd0a598e76f8a2fd264d427df0a119903e8eae384e478902541756f089dd1'};
const glb = {url: `/shardfiles/example/blobs/glb/${'b'.repeat(64)}.glb`, bytes: 5, hash: '7dfd2b6c5b422920757984cf2cbce642dca9a05207c57af24ad995b2d90fb4e9'};
const code = {url: '/assets/code-12345678.js', bytes: 3, hash: 'd'.repeat(64)};
const part = {url: `/assets/spawn/parts/${hash.slice(0, 16)}.pack.br`, bytes: 21, hash, members: [[0, 0], [1, 16]]};
// The part holds bin at 0 and glb at 16 (16-byte aligned); the JS module stays loose.
const partBytes: Uint8Array<ArrayBuffer> = Uint8Array.from({length: 21}, (_, at) => at < 4 ? 1 : at >= 16 ? 2 : 0);
const manifest = {version: 1, shard: 'example', tier: 'phone', flow: 'grid', files: [bin, glb, code], totalBytes: 12, parts: [part]};
const text = JSON.stringify(manifest), address = {url: '/assets/spawn/example-1234567890abcdef.json', bytes: text.length, totalBytes: 12, files: 3};
const body = (url: string): Uint8Array<ArrayBuffer> => url.endsWith('.js') ? new Uint8Array(3) : url.endsWith('.bin') ? new Uint8Array(4).fill(1) : new Uint8Array(5).fill(2);
afterEach(() => {releaseSpawnMembers(); vi.restoreAllMocks();});

test('until control, a page read of a member is answered from its part; retries and other URLs reach the network', async () => {
  const network = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network')));
  // First in this file: the module's one fetch layer installs over this page's (stubbed) network.
  vi.stubGlobal('fetch', network);
  const download = downloadSpawnManifest(address, {packs: true, cached: () => Promise.resolve(undefined), fetch: url => {
    const path = new URL(url).pathname;
    return Promise.resolve(new Response(path === address.url ? text : path === part.url ? partBytes : body(path)));
  }}, base);
  await download.ready;
  const member = await window.fetch(new URL(glb.url, base).href);
  expect(new Uint8Array(await member.arrayBuffer())).toEqual(new Uint8Array(5).fill(2));
  expect(member.headers.get('content-type')).toBe('model/gltf-binary');
  expect(network).not.toHaveBeenCalled();
  await window.fetch(new URL(glb.url, base).href, {cache: 'reload'}); expect(network).toHaveBeenCalledTimes(1);
  releaseSpawnMembers();
  await window.fetch(new URL(glb.url, base).href); expect(network).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});

test('packs read each part once, cut its members, keep them under their own URLs and leave code loose', async () => {
  const reads: string[] = [], kept = new Map<string, Uint8Array>();
  const download = downloadSpawnManifest(address, {packs: true, cached: () => Promise.resolve(undefined),
    keep: async (url, response) => {kept.set(new URL(url).pathname, new Uint8Array(await response.arrayBuffer()));},
    fetch: url => {
      const path = new URL(url).pathname; reads.push(path);
      return Promise.resolve(new Response(path === address.url ? text : path === part.url ? partBytes : body(path)));
    }}, base);
  await download.ready;
  expect(reads).toEqual([address.url, part.url, code.url]);
  expect(kept.get(bin.url)).toEqual(new Uint8Array(4).fill(1)); expect(kept.get(glb.url)).toEqual(new Uint8Array(5).fill(2));
  expect(download.snapshot()).toMatchObject({complete: true, completedBytes: 12, filesDone: 3, error: null});
});

test('a failed part hands its members to their loose URLs', async () => {
  const reads: string[] = [];
  const download = downloadSpawnManifest(address, {packs: true, cached: () => Promise.resolve(undefined),
    fetch: url => {
      const path = new URL(url).pathname; reads.push(path);
      if (path === part.url) return Promise.resolve(new Response('missing', {status: 404}));
      return Promise.resolve(new Response(path === address.url ? text : body(path)));
    }}, base);
  await download.ready;
  expect(reads.slice(0, 2)).toEqual([address.url, part.url]);
  expect(reads.slice(2).sort()).toEqual([bin.url, glb.url, code.url].sort());
  expect(download.snapshot()).toMatchObject({complete: true, completedBytes: 12, filesDone: 3});
});

test('a part whose bytes differ from the manifest is never kept: its members load loose', async () => {
  const reads: string[] = [], kept: string[] = [];
  const corrupt = partBytes.map(byte => byte === 2 ? 3 : byte); // same length, wrong glb bytes
  const download = downloadSpawnManifest(address, {packs: true, cached: () => Promise.resolve(undefined),
    keep: url => {kept.push(new URL(url).pathname); return Promise.resolve();},
    fetch: url => {
      const path = new URL(url).pathname; reads.push(path);
      return Promise.resolve(new Response(path === address.url ? text : path === part.url ? corrupt : body(path)));
    }}, base);
  await download.ready;
  expect(kept).toEqual([bin.url]); // bin verified before the corrupt glb; glb never kept
  expect(reads).toContain(glb.url);
  expect(download.snapshot()).toMatchObject({complete: true, completedBytes: 12, filesDone: 3});
});

test('DL18: a warm visit answers every packed member from the held-parts index, with no part request or bulk read', async () => {
  // One in-memory asset cache shared by a cold visit and the warm visit after it.
  const disk = new Map<string, Response>(), reads: string[] = [], lookups: string[] = [];
  let index: HeldParts = {}, bulk = 0;
  const ports = () => ({packs: true, whole: true,
    cached: (url: string) => { lookups.push(new URL(url).pathname); return Promise.resolve(disk.get(url)?.clone()); },
    present: (urls: readonly string[]) => { bulk++; return Promise.resolve(new Set(urls.filter(url => disk.has(url)))); },
    keep: (url: string, response: Response) => { disk.set(url, response); return Promise.resolve(); },
    store: (url: string, response: Response) => { disk.set(url, response); return Promise.resolve(); },
    held: {read: () => Promise.resolve(index), write: (next: HeldParts) => { index = next; return Promise.resolve(); },
      keys: () => Promise.resolve(new Set(disk.keys()))},
    fetch: (url: string) => {
      const path = new URL(url).pathname; reads.push(path);
      return Promise.resolve(new Response(path === address.url ? text : path === part.url ? partBytes : body(path)));
    }});
  await downloadSpawnManifest(address, ports(), base).ready;
  expect(reads).toEqual([address.url, part.url, code.url]);
  expect(index).toEqual({[hash]: [new URL(bin.url, base).href, new URL(glb.url, base).href]});
  reads.length = 0; lookups.length = 0; bulk = 0;
  const warm = downloadSpawnManifest(address, ports(), base);
  await warm.ready;
  // The manifest and the loose module come from the cache by their own lookups; the packed members need none.
  expect(reads).toEqual([]); expect(bulk).toBe(0);
  expect(lookups.sort()).toEqual([address.url, code.url].sort());
  expect(warm.snapshot()).toMatchObject({complete: true, cachedBytes: 12, filesDone: 3});
  // The worker pruned a member: the index no longer holds its part, so the part is fetched again and re-listed.
  disk.delete(new URL(glb.url, base).href); reads.length = 0;
  await downloadSpawnManifest(address, ports(), base).ready;
  expect(reads).toEqual([part.url]);
  expect(index[hash]).toEqual([new URL(bin.url, base).href, new URL(glb.url, base).href]);
});

test('DL15: on the packs path the wire facts are the parts\' q11 bodies plus the loose files', async () => {
  // Loose q3 estimates: bin 3, glb 4, code 2 (9). The part's q11 body is 6 bytes, so the wire is 6 + 2.
  const files = [{...bin, wireBytes: 3}, {...glb, wireBytes: 4}, {...code, wireBytes: 2}];
  const wired = JSON.stringify({...manifest, files, wireBytes: 9, parts: [{...part, wireBytes: 6}]});
  const at = {...address, url: '/assets/spawn/example-wire-1234567890abcdef.json', bytes: wired.length, wireBytes: 9};
  const download = downloadSpawnManifest(at, {packs: true, cached: () => Promise.resolve(undefined), fetch: url => {
    const path = new URL(url).pathname;
    return Promise.resolve(new Response(path === at.url ? wired : path === part.url ? partBytes : body(path)));
  }}, base);
  await download.ready;
  expect(download.snapshot().wire).toEqual({totalBytes: 8, completedBytes: 8, cachedBytes: 0});
});

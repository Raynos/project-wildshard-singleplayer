// @vitest-environment happy-dom
import {afterEach, expect, test, vi} from 'vitest';
import {downloadSpawnManifest, releaseSpawnMembers, type HeldParts} from '../src/game/boot/spawnDownload';
import {progressOfCard, watchStuckStep} from '../src/engine/boot/stuckStep';

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

test('DL18: a warm visit answers every packed member from the held-parts index, with no part request or bulk read; an unfit entry refetches its part', async () => {
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
  // Every file is answered by its own cache lookup (each held member is checked: a 200, not a page, its exact length).
  expect(reads).toEqual([]); expect(bulk).toBe(0);
  expect(lookups.sort()).toEqual([address.url, bin.url, glb.url, code.url].sort());
  expect(warm.snapshot()).toMatchObject({complete: true, cachedBytes: 12, filesDone: 3});
  // The worker pruned a member, or its entry is unfit (sp-x9's review of 77f9b5489f): the part is fetched again, the
  // member re-kept and the part re-listed; the download is complete only with the right bytes.
  const glbURL = new URL(glb.url, base).href;
  for (const unfit of [undefined, new Response('gone', {status: 404}), new Response('<!doctype html>', {headers: {'content-type': 'text/html'}}),
    new Response(new Uint8Array(4), {headers: {'content-length': '4'}}), new Response(new Uint8Array(4))]) {
    if (unfit === undefined) disk.delete(glbURL); else disk.set(glbURL, unfit);
    reads.length = 0;
    const again = downloadSpawnManifest(address, ports(), base);
    await again.ready;
    expect(reads).toEqual([part.url]);
    expect(new Uint8Array(await (disk.get(glbURL)?.clone().arrayBuffer() ?? new ArrayBuffer(0)))).toEqual(new Uint8Array(5).fill(2));
    expect(again.snapshot()).toMatchObject({complete: true, filesDone: 3});
    expect(index[hash]).toEqual([new URL(bin.url, base).href, glbURL]);
  }
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

test('DL21: a part streaming one byte every 50 s, before any member verifies, keeps the stuck watch quiet', async () => {
  let push = (_bytes: Uint8Array<ArrayBuffer>): void => { throw new Error('Part stream not started'); }, close = (): void => undefined, started = false;
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({start: controller => {push = bytes => {controller.enqueue(bytes);}; close = () => {controller.close();};}});
  const download = downloadSpawnManifest(address, {packs: true, cached: () => Promise.resolve(undefined), fetch: url => {
    const path = new URL(url).pathname; if (path === part.url) started = true;
    return Promise.resolve(new Response(path === address.url ? text : path === part.url ? stream : body(path)));
  }}, base);
  // the card as the download paints it (paintSpawnDownload's data-streamed-bytes / data-read-bytes)
  const dataset: Record<string, string> = {step: 'modules'};
  download.subscribe(row => {dataset['streamedBytes'] = String(row.streamedBytes ?? row.completedBytes); dataset['readBytes'] = String(row.completedBytes);});
  let now = 0, tick = (): void => undefined;
  const stalls: [string, number][] = [];
  watchStuckStep(download.ready, {progress: () => progressOfCard({dataset}), now: () => now,
    every: (_ms, run) => {tick = run; return () => {tick = () => undefined;};}, stalled: (step, ms) => {stalls.push([step, ms]);}}, 60_000);
  const wait = (seconds: number): void => {for (let s = 0; s < seconds; s++) {now += 1000; tick();}};
  await vi.waitFor(() => {expect(started).toBe(true);});
  // bin (bytes 0..3) verifies only once all four land: three single bytes move the stream but no verified byte
  for (let at = 0; at < 3; at++) {
    const before = dataset['streamedBytes'];
    push(partBytes.slice(at, at + 1));
    await vi.waitFor(() => {expect(dataset['streamedBytes']).not.toBe(before);});
    expect(dataset['readBytes']).toBe('0');
    wait(50);
  }
  expect(stalls).toEqual([]);
  wait(61); expect(stalls).toEqual([['modules', 60_000]]);
  push(partBytes.slice(3)); close(); await download.ready;
});

test('DL13 default-path slice: until control, an uncontrolled page re-reads a stored file from the store, not the network', async () => {
  // Pine's cold first visit (DL22) re-fetched 25.4 MB of files the spawn download had already stored. The page's fetch
  // layer wraps the stubbed network below, which answers 'network' for anything the layer passes through.
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const disk = new Map<string, Response>(), plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-plain-1234567890abcdef.json', bytes: plain.length };
  const download = downloadSpawnManifest(at, {
    cached: url => Promise.resolve(disk.get(url)?.clone()),
    store: (url, response) => { disk.set(url, response); return Promise.resolve(); },
    fetch: url => { const path = new URL(url).pathname; return Promise.resolve(new Response(path === at.url ? plain : body(path))); },
  }, base);
  await download.ready;
  const binURL = new URL(bin.url, base).href, read = async (init?: RequestInit): Promise<Uint8Array> => new Uint8Array(await (await window.fetch(binURL, init)).arrayBuffer());
  expect(await read()).toEqual(new Uint8Array(4).fill(1));
  // A retry still reaches the network; after control every read does.
  expect(new TextDecoder().decode(await read({ cache: 'reload' }))).toBe('network');
  releaseSpawnMembers();
  expect(new TextDecoder().decode(await read())).toBe('network');
  vi.unstubAllGlobals();
});

test('DL13 read-once serves only the manifest\'s exact file; a fetch replaced mid-page is wrapped again (sp-x2\'s review)', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const disk = new Map<string, Response>(), plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-check-1234567890abcdef.json', bytes: plain.length };
  const ports = {
    cached: (url: string) => Promise.resolve(disk.get(url)?.clone()),
    store: (url: string, response: Response) => { disk.set(url, response); return Promise.resolve(); },
    fetch: (url: string) => { const path = new URL(url).pathname; return Promise.resolve(new Response(path === at.url ? plain : body(path))); },
  };
  await downloadSpawnManifest(at, ports, base).ready;
  const binURL = new URL(bin.url, base).href, glbURL = new URL(glb.url, base).href;
  const read = async (url: string): Promise<string> => new TextDecoder().decode(new Uint8Array(await (await window.fetch(url)).arrayBuffer()));
  // Same length, wrong bytes; a short body; a page: each goes to the network.
  disk.set(binURL, new Response(new Uint8Array(4).fill(9))); expect(await read(binURL)).toBe('network');
  disk.set(glbURL, new Response(new Uint8Array(3).fill(2))); expect(await read(glbURL)).toBe('network');
  disk.set(binURL, new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })); expect(await read(binURL)).toBe('network');
  // Something replaces fetch mid-page: the next download's serve wraps it again.
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  disk.clear();
  await downloadSpawnManifest({ ...at, url: '/assets/spawn/example-check2-1234567890abcdef.json' }, { ...ports,
    fetch: (url: string) => { const path = new URL(url).pathname; return Promise.resolve(new Response(path.endsWith('.json') ? plain : body(path))); } }, base).ready;
  expect(new Uint8Array(await (await window.fetch(glbURL)).arrayBuffer())).toEqual(new Uint8Array(5).fill(2));
  vi.unstubAllGlobals();
});

test('DL11: after the list is known, a page read of a listed file waits for that file alone, then reads the store', async () => {
  // Setup overlaps the download: a loader asks for its file mid-download and gets the stored copy, never a second fetch.
  const network = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network')));
  vi.stubGlobal('fetch', network);
  const disk = new Map<string, Response>(), plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-overlap-1234567890abcdef.json', bytes: plain.length };
  let release = (): void => undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const download = downloadSpawnManifest(at, {
    cached: url => Promise.resolve(disk.get(url)?.clone()),
    store: (url, response) => { disk.set(url, response); return Promise.resolve(); },
    fetch: async url => { const path = new URL(url).pathname; if (path === glb.url) await held; return new Response(path === at.url ? plain : body(path)); },
  }, base);
  await download.listed;
  let glbRead: Uint8Array | undefined;
  const reading = (async () => { glbRead = new Uint8Array(await (await window.fetch(new URL(glb.url, base).href)).arrayBuffer()); })();
  // the bin arrives while glb is held: its read is answered at once
  await vi.waitFor(() => { expect(disk.has(new URL(bin.url, base).href)).toBe(true); });
  expect(new Uint8Array(await (await window.fetch(new URL(bin.url, base).href)).arrayBuffer())).toEqual(new Uint8Array(4).fill(1));
  expect(glbRead).toBeUndefined();
  release(); await reading; await download.ready;
  expect(glbRead).toEqual(new Uint8Array(5).fill(2));
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('DL11: a read waiting on a file the download will not store falls through to the network', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-overlap-fail-1234567890abcdef.json', bytes: plain.length };
  // glb never arrives; the download is cancelled (a new entry, a refusal) while a loader waits on it
  const download = downloadSpawnManifest(at, {
    cached: () => Promise.resolve(undefined), store: () => Promise.resolve(),
    fetch: async (url, signal) => {
      const path = new URL(url).pathname;
      if (path === glb.url) await new Promise((_resolve, reject) => { signal.addEventListener('abort', () => { reject(new Error('aborted')); }); });
      return new Response(path === at.url ? plain : body(path));
    },
  }, base);
  await download.listed;
  const reading = window.fetch(new URL(glb.url, base).href);
  download.cancel();
  await expect(download.ready).rejects.toThrow();
  expect(await (await reading).text()).toBe('network');
  vi.unstubAllGlobals();
});

test('DL11: a cancel settles every waiting read at once, even while a storage call never returns (sp-x2\'s review)', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-overlap-held-1234567890abcdef.json', bytes: plain.length };
  // the cache census after the list hangs (an unabortable storage call)
  const download = downloadSpawnManifest(at, {
    cached: url => url.endsWith('.json') ? Promise.resolve(undefined) : new Promise<Response | undefined>(() => { /* never settles */ }),
    store: () => Promise.resolve(),
    fetch: url => Promise.resolve(new Response(new URL(url).pathname === at.url ? plain : body(new URL(url).pathname))),
  }, base);
  await download.listed;
  const reading = window.fetch(new URL(bin.url, base).href);
  download.cancel();
  await expect(download.ready).rejects.toThrow();
  expect(await (await reading).text()).toBe('network');
  vi.unstubAllGlobals();
});

test('DL11: a read made before its part starts waits for the file, then gets the member, not the network (sp-x2\'s review)', async () => {
  const network = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network')));
  vi.stubGlobal('fetch', network);
  const at = { ...address, url: '/assets/spawn/example-overlap-parts-1234567890abcdef.json' };
  let census = (): void => undefined;
  const held = new Promise<void>(resolve => { census = resolve; });
  const download = downloadSpawnManifest(at, {packs: true,
    cached: async url => { if (!url.endsWith('.json')) await held; return undefined; },
    fetch: url => { const path = new URL(url).pathname; return Promise.resolve(new Response(path === at.url ? text : path === part.url ? partBytes : body(path))); },
  }, base);
  await download.listed;
  // listed, but the census holds the parts loop: no member is keyed yet
  const reading = window.fetch(new URL(glb.url, base).href);
  census();
  expect(new Uint8Array(await (await reading).arrayBuffer())).toEqual(new Uint8Array(5).fill(2));
  await download.ready;
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('DL11: a download cancelled during its manifest store publishes no file waits (sp-x2\'s re-review)', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-overlap-store-1234567890abcdef.json', bytes: plain.length };
  let stored = (): void => undefined, storeCalled = false;
  const storing = new Promise<void>(resolve => { stored = resolve; });
  const download = downloadSpawnManifest(at, {
    cached: url => url.endsWith('.json') ? Promise.resolve(undefined) : new Promise<Response | undefined>(() => { /* the census never returns */ }),
    store: url => { if (!url.endsWith('.json')) return Promise.resolve(); storeCalled = true; return storing; },
    fetch: url => Promise.resolve(new Response(new URL(url).pathname === at.url ? plain : body(new URL(url).pathname))),
  }, base);
  await vi.waitFor(() => { expect(storeCalled).toBe(true); });
  download.cancel(); await expect(download.ready).rejects.toThrow();
  stored(); await new Promise(resolve => { setTimeout(resolve, 0); });
  // the store returned after the cancel: a later read of a listed file is not held by the cancelled job
  expect(await (await window.fetch(new URL(bin.url, base).href)).text()).toBe('network');
  vi.unstubAllGlobals();
});

test('DL13: a download cancelled during a file\'s store never serves it after control (sp-x2\'s re-read of c93770ee65)', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const disk = new Map<string, Response>(), plain = JSON.stringify({ ...manifest, parts: undefined });
  const at = { ...address, url: '/assets/spawn/example-overlap-blob-1234567890abcdef.json', bytes: plain.length };
  const binURL = new URL(bin.url, base).href;
  let storeReturns = (): void => undefined, storing = false;
  const stalled = new Promise<void>(resolve => { storeReturns = resolve; });
  const download = downloadSpawnManifest(at, {
    cached: url => Promise.resolve(disk.get(url)?.clone()),
    // the bin's store stalls (an unabortable storage call); the store itself lands when it returns
    store: async (url, response) => { if (url === binURL) { storing = true; await stalled; } disk.set(url, response); },
    fetch: url => Promise.resolve(new Response(new URL(url).pathname === at.url ? plain : body(new URL(url).pathname))),
  }, base);
  await vi.waitFor(() => { expect(storing).toBe(true); });
  download.cancel(); await expect(download.ready).rejects.toThrow();
  releaseSpawnMembers(); // control
  storeReturns(); await new Promise(resolve => { setTimeout(resolve, 0); });
  expect(await (await window.fetch(binURL)).text()).toBe('network');
  vi.unstubAllGlobals();
});

test('DL11: a page read waiting on a listed file moves it to the front of the download (Pine\'s boot tables were 649th of 651)', async () => {
  vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network'))));
  const rows = Array.from({length: 10}, (_, at) => ({url: `/shardfiles/example/blobs/bin/${at.toString(16).repeat(64)}.bin`, bytes: 4, hash: 'f'.repeat(64)}));
  const plain = JSON.stringify({version: 1, shard: 'example', tier: 'phone', flow: 'client', files: rows, totalBytes: 40});
  const at = {url: '/assets/spawn/example-demand-1234567890abcdef.json', bytes: plain.length, totalBytes: 40, files: 10};
  const order: string[] = [];
  const download = downloadSpawnManifest(at, {
    cached: () => Promise.resolve(undefined), store: () => Promise.resolve(),
    fetch: url => { const path = new URL(url).pathname; if (path !== at.url) order.push(path); return Promise.resolve(new Response(path === at.url ? plain : new Uint8Array(4))); },
  }, base);
  await download.listed;
  const last = rows[9]; if (last === undefined) throw new Error('Missing row');
  const reading = window.fetch(new URL(last.url, base).href);
  await download.ready; await reading;
  expect(order[0]).toBe(last.url);
  expect(new Set(order).size).toBe(10);
  vi.unstubAllGlobals();
});

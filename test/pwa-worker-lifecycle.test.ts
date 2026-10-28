// oxlint-disable-next-line import/no-nodejs-modules -- Execute the shipped worker source against deterministic browser boundaries.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated context executes the original worker rather than a copied implementation.
import { runInNewContext } from 'node:vm';
import { afterEach, expect, test, vi } from 'vitest';
import { contentNamed } from '../scripts/app-build/assetHashes';
import { writeCodePacks } from '../scripts/app-build/codePacks';
import { CONTENT_CACHE_NAME, CONTENT_CACHE_ROOT } from '../src/engine/boot/contentCache';
// oxlint-disable-next-line import/no-nodejs-modules -- The transport fixture owns only its exact temporary output tree.
import { resolve as resolvePath } from 'node:path';

const base = 'https://worker.test/';
const entry = '/assets/entry-aaaaaaaa.js', dependency = '/assets/shared-bbbbbbbb.js', css = '/assets/style-cccccccc.css';
const lazy = '/assets/lazy-dddddddd.js', later = '/assets/later-eeeeeeee.js';
interface WorkerEvent {
  readonly source?: { postMessage: (value: unknown) => void };
  readonly data?: { type: string; readonly [key: string]: unknown };
  readonly request?: Request;
  readonly ports?: readonly { readonly postMessage: (value: unknown) => void }[];
  waitUntil: (work: Promise<unknown>) => void;
  respondWith: (work: Promise<Response>) => void;
}
class StoredCache {
  readonly bodies = new Map<string, Response>();
  private key(input: Request | string): string { return typeof input === 'string' ? input : input.url; }
  match(input: Request | string): Promise<Response | undefined> { return Promise.resolve(this.bodies.get(this.key(input))?.clone()); }
  async put(input: Request | string, response: Response): Promise<void> {
    this.bodies.set(this.key(input), new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers }));
  }
  keys(): Promise<Request[]> { return Promise.resolve([...this.bodies.keys()].map(url => new Request(url))); }
  delete(input: Request | string): Promise<boolean> { return Promise.resolve(this.bodies.delete(this.key(input))); }
}
function fixture(read?: (url: string, init?: RequestInit) => Promise<Response>, warm: readonly string[] = [entry, dependency, css, lazy, later], packs?: unknown,
  bundle: readonly string[] = [entry, dependency, css, lazy, later], fonts: readonly string[] = []) {
  const listeners = new Map<string, ((event: WorkerEvent) => void)[]>(), books = new Map<string, StoredCache>();
  const installErrors: unknown[] = [];
  const replies: unknown[] = [];
  const responses: Response[] = [];
  const open = (name: string): Promise<StoredCache> => {
    let cache = books.get(name); if (cache === undefined) { cache = new StoredCache(); books.set(name, cache); } return Promise.resolve(cache);
  };
  const fetch = vi.fn((input: string | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url;
    if (read !== undefined) return read(url, init);
    return Promise.resolve(new Response(url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact bytes'));
  });
  const navigator = { onLine: true };
  const self = {
    navigator, location: new URL(base), registration: { scope: base },
    clients: { matchAll: () => Promise.resolve([{ postMessage: (value: unknown) => { installErrors.push(value); } }]), claim: () => Promise.resolve() },
    addEventListener: (kind: string, listener: (event: WorkerEvent) => void) => { listeners.set(kind, [...listeners.get(kind) ?? [], listener]); },
  };
  const caches = { open, keys: () => Promise.resolve([...books.keys()]), delete: (name: string) => Promise.resolve(books.delete(name)),
    match: async (url: string): Promise<Response | undefined> => {
      for (const book of books.values()) { const held = await book.match(url); if (held !== undefined) return held; } return undefined;
    } };
  const owner = readFileSync('src/engine/app/workerScope.js', 'utf8').replaceAll(/^export /gmu, '');
  const packSource = readFileSync('src/engine/pwa/codePack.js', 'utf8').replaceAll(/^export /gmu, '');
  const worker = readFileSync('src/engine/pwa/sw.js', 'utf8').replace("import { workerScope, WorkerScope } from '../app/workerScope.js';\n", '').replace("import { codePackEntries, readCodePackTransport } from './codePack.js';\n", '')
    .replaceAll('__BUILD_ID__', 'unit-build').replaceAll('__ASSET_ID__', 'unit-assets')
    .replaceAll('__CONTENT_CACHE__', CONTENT_CACHE_NAME).replaceAll('__CONTENT_ROOT__', CONTENT_CACHE_ROOT)
    .replace("'__BUNDLE__'", JSON.stringify(JSON.stringify(bundle)))
    .replace("'__WARM__'", JSON.stringify(JSON.stringify(warm)))
    .replace("'__INSTALL__'", JSON.stringify(JSON.stringify([entry, dependency, css])))
    .replace("'__CODE_PACKS__'", JSON.stringify(JSON.stringify(packs ?? { files: [], entries: {} })))
    .replace("'__FONTS__'", JSON.stringify(JSON.stringify(fonts)));
  runInNewContext(`${owner}\n${packSource}\n${worker}`, { self, caches, fetch, URL, Request, Response, Headers, Blob, ReadableStream, DecompressionStream, TextDecoder, AbortController, Error, setTimeout, clearTimeout, Date, console, crypto });
  const dispatch = async (kind: string, payload: Pick<WorkerEvent, 'data' | 'request' | 'ports'> = {}): Promise<void> => {
    const pending: Promise<unknown>[] = [];
    for (const listener of listeners.get(kind) ?? []) listener({ ...payload, source: { postMessage: (value: unknown) => { replies.push(value); } }, waitUntil: work => { pending.push(work); }, respondWith: work => { pending.push(work.then(response => { responses.push(response); return response; })); } });
    await Promise.all(pending);
  };
  return { fetch, open, dispatch, navigator, installErrors, replies, responses };
}
afterEach(() => { vi.useRealTimers(); });

test('optional fonts and icons wait for control warming, then retain offline coverage', async () => {
  const fonts = ['/fonts/needed.woff2', '/fonts/later.woff2'] as const;
  const optional = [...fonts, '/asset-index.json', '/apple-touch-icon.png', '/favicon.png', '/icon-192.png', '/icon-512.png'];
  const f = fixture(undefined, [], undefined, undefined, fonts);
  const paths = (): string[] => f.fetch.mock.calls.map(([input]) => new URL(typeof input === 'string' ? input : input.url).pathname);
  await f.dispatch('install');
  expect(paths()).toEqual(['/index.html', '/manifest.webmanifest', entry, dependency, css]);
  // A font actually used before control still reads on demand and joins the
  // same static cache. Later warming must not read it a second time.
  await f.dispatch('fetch', { request: new Request(new URL(fonts[0], base)) });
  expect(paths().filter(path => path === fonts[0])).toHaveLength(1);
  await f.dispatch('message', { data: { type: 'WARM_CODE' } });
  for (const path of optional) expect(paths().filter(value => value === path)).toHaveLength(1);
  const count = f.fetch.mock.calls.length;
  await f.dispatch('message', { data: { type: 'WARM_ALL_CODE' } });
  expect(paths().slice(count)).toEqual([lazy, later]);
  for (const path of optional) expect(paths().filter(value => value === path)).toHaveLength(1);
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  for (const path of optional) await f.dispatch('fetch', { request: new Request(new URL(path, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(count + 2);
  expect(f.installErrors).toEqual([]);
});

test('unavailable optional assets retain tolerant warming and cannot hide strict install failures', async () => {
  const font = '/fonts/unavailable.woff2';
  const f = fixture(url => Promise.resolve(new Response(url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact bytes',
    { status: url.endsWith(font) || url.endsWith('.png') || url.endsWith('/asset-index.json') ? 503 : 200 })), [], undefined, undefined, [font]);
  await f.dispatch('install');
  await f.dispatch('message', { data: { type: 'WARM_CODE' } });
  expect(f.installErrors).toEqual([]);
  expect(await (await f.open('ws-static-unit-assets')).match(new URL(font, base).href)).toBeUndefined();
  const refused = fixture(url => Promise.resolve(new Response(url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact bytes',
    { status: url.endsWith(css) ? 503 : 200 })), [], undefined, undefined, [font]);
  await expect(refused.dispatch('install')).rejects.toThrow('precache:');
  expect(refused.installErrors).toHaveLength(1);
});

test('emitted grid data stays cold at install and survives activation for offline first use', async () => {
  const assets = ['/assets/grid-strip-book-12345678.json', '/assets/grid-strip-page-23456789.json', '/assets/grid-strip-mesh-34567890.bin'];
  const bodies = new Map(assets.map((url, index) => [new URL(url, base).href, Uint8Array.of(0, index, 255, 128)]));
  const f = fixture(url => Promise.resolve(url.endsWith('/asset-manifest.json') ? Response.json({})
    : new Response(bodies.get(url)?.buffer ?? (url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact bytes'))),
  undefined, undefined, [entry, dependency, css, lazy, later, ...assets]);
  await f.dispatch('install');
  expect(f.fetch.mock.calls.some(([url]) => bodies.has(typeof url === 'string' ? url : url.url))).toBe(false);
  const cache = await f.open('ws-immutable');
  for (const [url, bytes] of bodies) {
    await f.dispatch('fetch', { request: new Request(url) });
    await vi.waitFor(async () => {
      expect(new Uint8Array(await (await cache.match(url))?.arrayBuffer() ?? [])).toEqual(bytes);
    });
  }
  await f.dispatch('activate');
  await f.dispatch('message', { data: { type: 'GC' } });
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline')); f.fetch.mockClear();
  for (const [url, bytes] of bodies) {
    await f.dispatch('fetch', { request: new Request(url) });
    expect(new Uint8Array(await (await cache.match(url))?.arrayBuffer() ?? [])).toEqual(bytes);
  }
  expect(f.fetch).not.toHaveBeenCalled();
});

test('one selected code pack publishes exact original URLs and supports offline first use', async () => {
  mkdirSync('tmp/code-pack-worker', { recursive: true });
  const root = mkdtempSync(resolvePath('tmp/code-pack-worker/selected-'));
  try {
    mkdirSync(resolvePath(root, 'assets'));
    writeFileSync(resolvePath(root, lazy.slice(1)), 'export const selected = 42;');
    writeFileSync(resolvePath(root, later.slice(1)), 'export const unselected = 99;');
    const packs = writeCodePacks(root, { selected: [[lazy, 27]], other: [[later, 29]] });
    const row = packs.entries['selected']; if (row === undefined) throw new Error('Missing selected pack');
    const wire = Uint8Array.from(readFileSync(resolvePath(root, row[0].slice(1))));
    const f = fixture(url => Promise.resolve(new Response(url.endsWith('.pack') ? wire : 'ordinary module')), undefined, packs);
    const messages: unknown[] = [];
    await f.dispatch('message', { data: { type: 'PREPARE_CODE_PACK', url: row[0], bytes: row[1], decoded: row[2] },
      ports: [{ postMessage: value => { messages.push(value); } }] });
    expect(messages).toEqual([{ type: 'CODE_PACK_STARTED' },
      { type: 'CODE_PACK_PROGRESS', url: row[0], loaded: row[1], total: row[1] },
      { type: 'CODE_PACK_DONE', status: 'stored' }]);
    expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([new URL(row[0], base).href]);
    const cache = await f.open('ws-immutable');
    expect(await (await cache.match(new URL(lazy, base).href))?.text()).toBe('export const selected = 42;');
    expect(await cache.match(new URL(later, base).href)).toBeUndefined();
    f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
    await f.dispatch('fetch', { request: scriptRequest(lazy) });
    await f.dispatch('message', { data: { type: 'PREPARE_CODE_PACK', url: row[0], bytes: row[1], decoded: row[2] },
      ports: [{ postMessage: value => { messages.push(value); } }] });
    expect(messages.at(-1)).toEqual({ type: 'CODE_PACK_DONE', status: 'hit' });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('corrupt code packs publish no module and retain the original individual fetch path', async () => {
  mkdirSync('tmp/code-pack-worker', { recursive: true });
  const root = mkdtempSync(resolvePath('tmp/code-pack-worker/corrupt-'));
  try {
    mkdirSync(resolvePath(root, 'assets')); writeFileSync(resolvePath(root, lazy.slice(1)), 'export const selected = 42;');
    const packs = writeCodePacks(root, { selected: [[lazy, 27]] });
    const row = packs.entries['selected']; if (row === undefined) throw new Error('Missing selected pack');
    const wire = Uint8Array.from(readFileSync(resolvePath(root, row[0].slice(1)))); wire[0] = 0;
    const f = fixture(url => Promise.resolve(new Response(url.endsWith('.pack') ? wire : 'ordinary module')), undefined, packs), messages: unknown[] = [];
    await f.dispatch('message', { data: { type: 'PREPARE_CODE_PACK', url: row[0], bytes: row[1], decoded: row[2] },
      ports: [{ postMessage: value => { messages.push(value); } }] });
    expect(messages.at(-1)).toEqual({ type: 'CODE_PACK_DONE', status: 'failed' });
    const cache = await f.open('ws-immutable');
    expect(await cache.match(new URL(lazy, base).href)).toBeUndefined();
    await f.dispatch('fetch', { request: scriptRequest(lazy) });
    expect(await (await cache.match(new URL(lazy, base).href))?.text()).toBe('ordinary module');
    expect(f.fetch).toHaveBeenCalledTimes(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the shell pack replaces installer module reads while every INSTALL requirement stays strict', async () => {
  mkdirSync('tmp/code-pack-worker', { recursive: true });
  const root = mkdtempSync(resolvePath('tmp/code-pack-worker/install-'));
  try {
    mkdirSync(resolvePath(root, 'assets'));
    const first = 'export const entry = 1;', second = 'export const shared = 2;';
    writeFileSync(resolvePath(root, entry.slice(1)), first); writeFileSync(resolvePath(root, dependency.slice(1)), second);
    const packs = writeCodePacks(root, { $shell: [[entry, first.length], [dependency, second.length]] }), row = packs.entries['$shell'];
    if (row === undefined) throw new Error('Missing shell packet');
    const wire = new Uint8Array(readFileSync(resolvePath(root, row[0].slice(1))));
    const read = (url: string): Promise<Response> => Promise.resolve(new Response(url.endsWith('.pack') ? wire
      : url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'original bytes'));
    const f = fixture(read, undefined, packs);
    await f.dispatch('install');
    expect(f.fetch.mock.calls.filter(([url]) => new URL(typeof url === 'string' ? url : url.url).pathname.endsWith('.pack'))).toHaveLength(1);
    expect(f.fetch.mock.calls.some(([url]) => [entry, dependency].includes(new URL(typeof url === 'string' ? url : url.url).pathname))).toBe(false);
    const cache = await f.open('ws-immutable');
    expect(await (await cache.match(new URL(entry, base).href))?.text()).toBe(first);
    expect(await (await cache.match(new URL(dependency, base).href))?.text()).toBe(second);
    const refused = fixture(url => url.endsWith(css) ? Promise.resolve(new Response('missing', { status: 404 })) : read(url), undefined, packs);
    await expect(refused.dispatch('install')).rejects.toThrow('precache');
    expect(refused.installErrors).toContainEqual(expect.objectContaining({ type: 'WS_SW_INSTALL_ERROR' }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Developer-only code stays cold until first use and then works offline', async () => {
  const f = fixture(undefined, [entry, dependency, css, lazy]);
  await f.dispatch('install');
  await f.dispatch('message', { data: { type: 'WARM_CODE' } });
  expect(f.fetch.mock.calls.some(([url]) => new URL(typeof url === 'string' ? url : url.url).pathname === later)).toBe(false);
  await f.dispatch('fetch', { request: new Request(new URL(later, base)) });
  const requests = f.fetch.mock.calls.length;
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  await f.dispatch('fetch', { request: new Request(new URL(later, base)) });
  expect(f.fetch.mock.calls).toHaveLength(requests);
});

// Node Request cannot set destination in its init; real module fetch events
// expose script. Model that browser-owned fact on this fixture request only.
function scriptRequest(path: string): Request {
  const request = new Request(new URL(path, base));
  Object.defineProperty(request, 'destination', { value: 'script' });
  return request;
}

test('first-use code finishes its cache publication before completing the response', async () => {
  const f = fixture(undefined, [entry, dependency, css, lazy]);
  await f.dispatch('install');
  const cache = await f.open('ws-immutable'), put = cache.put.bind(cache);
  let release: () => void = () => undefined, started: () => void = () => undefined;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const writing = new Promise<void>(resolve => { started = resolve; });
  const write = vi.spyOn(cache, 'put').mockImplementation(async (request, response) => {
    started(); await blocked; await put(request, response);
  });
  let settled = false;
  const pending = (async () => {
    try { await f.dispatch('fetch', { request: scriptRequest(later) }); }
    finally { settled = true; }
  })();
  try {
    await writing;
    // Drain the response's task while the publication is explicitly blocked.
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
    expect(settled).toBe(false);
    expect(await cache.match(new URL(later, base).href)).toBeUndefined();
  } finally { release(); await pending; write.mockRestore(); }
  expect(await (await cache.match(new URL(later, base).href))?.text()).toBe('exact bytes');
  const requests = f.fetch.mock.calls.length;
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  await f.dispatch('fetch', { request: scriptRequest(later) });
  expect(f.fetch.mock.calls).toHaveLength(requests);
});

test('a failed code cache write still returns one complete online response', async () => {
  const f = fixture(), cache = await f.open('ws-immutable');
  const write = vi.spyOn(cache, 'put').mockRejectedValue(new DOMException('Cache full', 'QuotaExceededError'));
  try {
    await f.dispatch('fetch', { request: scriptRequest(later) });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  } finally { write.mockRestore(); }
});

test('installation remains strict for its complete entry graph and never reads lazy shard chunks', async () => {
  const f = fixture(), cache = await f.open('ws-immutable');
  await cache.put(new URL(dependency, base).href, new Response('unchanged'));
  await f.dispatch('install');
  const paths = f.fetch.mock.calls.map(([url]) => new URL(typeof url === 'string' ? url : url.url).pathname);
  expect(paths).toContain(entry); expect(paths).toContain(css);
  expect(paths).not.toContain(dependency); expect(paths).not.toContain(lazy); expect(paths).not.toContain(later);
  const refused = fixture(url => Promise.resolve(new Response(url.endsWith(dependency) ? 'missing' : url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact', { status: url.endsWith(dependency) ? 404 : 200 })));
  await expect(refused.dispatch('install')).rejects.toThrow('precache:');
  expect(refused.installErrors).toHaveLength(1);
  expect(JSON.stringify(refused.installErrors[0])).toContain('WS_SW_INSTALL_ERROR');
  expect(JSON.stringify(refused.installErrors[0])).toContain('precache:');
  expect(JSON.stringify(refused.installErrors[0])).toContain('unit-build');
});

test('boot JSON metadata cannot be mistaken for foreign JavaScript during installation', async () => {
  const metadata = '/assets/boot-far-reach-a7d25c3a.json';
  const f = fixture(url => Promise.resolve(new Response(url.endsWith('/index.html')
    ? `<script type="application/json">{"extras":["${metadata}"]}</script><script src="${entry}"></script>` : 'exact bytes')));
  await f.dispatch('install');
  expect(f.installErrors).toEqual([]);
  const foreign = '/assets/foreign-ffffffff.js';
  const refused = fixture(url => Promise.resolve(new Response(url.endsWith('/index.html')
    ? `<script type="application/json">{"extras":["${metadata}"]}</script><script src="${foreign}?v=1"></script>` : 'exact bytes')));
  await expect(refused.dispatch('install')).rejects.toThrow(`install: /index.html is another build's (${foreign})`);
  expect(refused.fetch).toHaveBeenCalledTimes(1);
});

test('the existing BUILD reply distinguishes waiting from completed activation', async () => {
  const f = fixture();
  await f.dispatch('message', { data: { type: 'BUILD' } });
  await f.dispatch('activate');
  await f.dispatch('message', { data: { type: 'BUILD' } });
  expect(f.replies).toEqual([
    { type: 'BUILD', build: 'unit-build', activationStage: 'waiting' },
    { type: 'BUILD', build: 'unit-build', activationStage: 'complete' },
  ]);
});

test('activation carries unchanged packs without downloading and fetches only a new content URL', async () => {
  const kept = '/assets/packs/home-aaaaaaaa.pack', changed = '/assets/packs/home-bbbbbbbb.pack';
  const obsolete = '/assets/packs/old-cccccccc.pack';
  const f = fixture(url => Promise.resolve(url.endsWith('/asset-manifest.json')
    ? Response.json({ [kept]: 'aaaaaaaa', [changed]: 'bbbbbbbb' }) : new Response('new pack bytes')));
  const old = await f.open('ws-static-previous');
  await old.put(new URL(kept, base).href, new Response('unchanged pack bytes'));
  await old.put(new URL(obsolete, base).href, new Response('retired pack bytes'));
  await f.dispatch('activate');
  await f.dispatch('message', { data: { type: 'GC' } });
  const current = await f.open('ws-static-unit-assets');
  expect(await (await current.match(new URL(kept, base).href))?.text()).toBe('unchanged pack bytes');
  expect(await current.match(new URL(obsolete, base).href)).toBeUndefined();
  f.fetch.mockClear();
  await f.dispatch('fetch', { request: new Request(new URL(kept, base)) });
  expect(f.fetch).not.toHaveBeenCalled();
  await f.dispatch('fetch', { request: new Request(new URL(changed, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(1);
  const requested = f.fetch.mock.calls[0]?.[0];
  expect(typeof requested === 'string' ? requested : requested?.url).toBe(new URL(changed, base).href);
  await vi.waitFor(async () => {
    expect(await (await current.match(new URL(changed, base).href))?.text()).toBe('new pack bytes');
  });
});

test('verified plain image aliases survive migration without an identical download or stale carry', async () => {
  const path = '/assets/title/hero.jpg', bytes = new TextEncoder().encode('unchanged hero');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hash = Array.from(digest.subarray(0, 4), byte => byte.toString(16).padStart(2, '0')).join('');
  const stale = '/assets/title/changed.jpg', removed = '/assets/title/removed.jpg';
  const f = fixture(url => Promise.resolve(url.endsWith('/asset-manifest.json')
    ? Response.json({ [path]: hash, [stale]: 'ffffffff' }) : new Response('new bytes')));
  const old = await f.open('ws-static-previous');
  await old.put(new URL(path, base).href, new Response(bytes));
  await old.put(new URL(stale, base).href, new Response('old image'));
  await old.put(new URL(removed, base).href, new Response('removed image'));
  await f.dispatch('activate');
  await f.dispatch('message', { data: { type: 'GC' } });
  const current = await f.open('ws-static-unit-assets');
  expect(await (await current.match(new URL(path, base).href))?.text()).toBe('unchanged hero');
  expect(await (await current.match(new URL(`${path}?v=${hash}`, base).href))?.text()).toBe('unchanged hero');
  expect(await current.match(new URL(stale, base).href)).toBeUndefined();
  expect(await current.match(new URL(removed, base).href)).toBeUndefined();
  f.fetch.mockClear();
  await f.dispatch('fetch', { request: new Request(new URL(path, base)) });
  await f.dispatch('fetch', { request: new Request(new URL(`${path}?v=${hash}`, base)) });
  expect(f.fetch).not.toHaveBeenCalled();
});

test('full content names survive static-cache migration without repeating baked downloads', async () => {
  const kept = `/assets/baked/fixture/${'1'.repeat(64)}.bin`, changed = `/assets/baked/fixture/${'2'.repeat(64)}.bin`;
  const removed = `/assets/baked/fixture/${'3'.repeat(64)}.bin`;
  expect(contentNamed(kept)).toBe(true);
  expect(contentNamed(`/assets/baked/fixture/${'1'.repeat(63)}.bin`)).toBe(false);
  expect(contentNamed(`/assets/baked/fixture/${'1'.repeat(65)}.bin`)).toBe(false);
  expect(contentNamed(`${kept}/mutable`)).toBe(false);
  const f = fixture(url => Promise.resolve(url.endsWith('/asset-manifest.json')
    ? Response.json({ [kept]: '11111111', [changed]: '22222222' }) : new Response('changed bytes')));
  const old = await f.open('ws-static-previous');
  await old.put(new URL(kept, base).href, new Response('unchanged bytes'));
  await old.put(new URL(`${kept}?v=11111111`, base).href, new Response('unchanged bytes'));
  await old.put(new URL(removed, base).href, new Response('removed bytes'));
  await f.dispatch('activate');
  await f.dispatch('message', { data: { type: 'GC' } });
  const current = await f.open('ws-static-unit-assets');
  expect(await (await current.match(new URL(kept, base).href))?.text()).toBe('unchanged bytes');
  expect(await current.match(new URL(removed, base).href)).toBeUndefined();
  f.fetch.mockClear();
  await f.dispatch('fetch', { request: new Request(new URL(kept, base)) });
  expect(f.fetch).not.toHaveBeenCalled();
  await f.dispatch('fetch', { request: new Request(new URL(changed, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(1);
  await vi.waitFor(async () => { expect(await (await current.match(new URL(changed, base).href))?.text()).toBe('changed bytes'); });
  await f.dispatch('fetch', { request: new Request(new URL(changed, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(1);
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  await f.dispatch('fetch', { request: new Request(new URL(kept, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(1);
});

test('a full content name reuses only its matching legacy versioned alias offline', async () => {
  const kept = `/assets/baked/fixture/${'1'.repeat(64)}.bin`, absent = `/assets/baked/fixture/${'2'.repeat(64)}.bin`;
  const f = fixture(), cache = await f.open('ws-static-unit-assets');
  await cache.put(new URL(`${kept}?v=11111111`, base).href, new Response('verified previous alias'));
  await cache.put(new URL(`${absent}?v=ffffffff`, base).href, new Response('wrong version'));
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  await f.dispatch('fetch', { request: new Request(new URL(kept, base)) });
  expect(f.fetch).not.toHaveBeenCalled();
  expect(await (await cache.match(new URL(kept, base).href))?.text()).toBe('verified previous alias');
  await expect(f.dispatch('fetch', { request: new Request(new URL(absent, base)) })).rejects.toThrow('offline');
  expect(await cache.match(new URL(absent, base).href)).toBeUndefined();
});

test('mutable unversioned bakes keep fresh network reads and their offline fallback', async () => {
  const path = '/assets/baked/fixture/current.bin';
  expect(contentNamed(path)).toBe(false);
  const f = fixture(() => Promise.resolve(new Response('fresh bytes'))), cache = await f.open('ws-static-unit-assets');
  await cache.put(new URL(path, base).href, new Response('previous bytes'));
  await f.dispatch('fetch', { request: new Request(new URL(path, base)) });
  await f.dispatch('fetch', { request: new Request(new URL(path, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  await vi.waitFor(async () => { expect(await (await cache.match(new URL(path, base).href))?.text()).toBe('fresh bytes'); });
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  await f.dispatch('fetch', { request: new Request(new URL(path, base)) });
  expect(f.fetch).toHaveBeenCalledTimes(2);
});

test('background code is serial, yields its body to foreground reads, then supports offline access', async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const signals: AbortSignal[] = []; let attempts = 0;
  const f = fixture((url, init) => {
    if (url.endsWith(lazy) && ++attempts === 1) {
      const signal = init?.signal; if (signal) signals.push(signal);
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) { signal?.addEventListener('abort', () => { controller.error(new Error('preempted')); }, { once: true }); },
      })));
    }
    return Promise.resolve(new Response(url.endsWith('/index.html') ? `<script src="${entry}"></script>` : 'exact bytes'));
  });
  await f.dispatch('install');
  const warming = f.dispatch('message', { data: { type: 'WARM_CODE' } });
  await vi.waitFor(() => { expect(attempts).toBe(1); });
  expect(f.fetch.mock.calls.filter(([url]) => url === new URL(later, base).href)).toHaveLength(0);
  expect(f.fetch.mock.calls.find(([url]) => url === new URL(lazy, base).href)?.[1]?.priority).toBe('low');
  await f.dispatch('fetch', { request: new Request(new URL('/assets/live-ffffffff.js', base)) });
  expect(signals[0]?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(499); expect(attempts).toBe(1);
  await vi.advanceTimersByTimeAsync(101); await warming;
  expect(attempts).toBe(2);
  f.navigator.onLine = false; f.fetch.mockRejectedValue(new Error('offline'));
  const before = f.fetch.mock.calls.length;
  await f.dispatch('fetch', { request: new Request(new URL(lazy, base)) });
  await f.dispatch('fetch', { request: new Request(new URL(later, base)) });
  expect(f.fetch.mock.calls).toHaveLength(before);
});


test.each([entry, css, '/shardfiles/driftwood-isle/shard.json', '/assets/map/paint.json'])(
  'a stalled %s request aborts and retries the network without publishing partial bytes', async path => {
    vi.useFakeTimers();
    let reads = 0;
    const body = path === '/index.html' ? `<script src="${entry}"></script>` : 'exact fallback bytes';
    const f = fixture(() => ++reads === 1 ? new Promise<Response>(() => { /* No headers ever arrive. */ }) : Promise.resolve(new Response(body)));
    const work = f.dispatch('fetch', { request: new Request(new URL(path, base)) });
    await vi.advanceTimersByTimeAsync(10700);
    await work;
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    const retried = f.fetch.mock.calls[1]?.[0];
    expect(retried instanceof Request && retried.cache).toBe('reload');
    expect(await f.responses[0]?.text()).toBe(body);
    expect(vi.getTimerCount()).toBe(0);
  });

test('stylesheet body stalls are bounded after successful headers and retry exact whole bytes', async () => {
  vi.useFakeTimers(); let reads = 0;
  const f = fixture(() => Promise.resolve(++reads === 1 ? new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('partial CSS')); },
  })) : new Response('complete CSS')));
  const work = f.dispatch('fetch', { request: new Request(new URL(css, base)) });
  await vi.advanceTimersByTimeAsync(10700); await work;
  expect(await f.responses[0]?.text()).toBe('complete CSS');
  expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(await (await f.open('ws-immutable')).match(new URL(css, base).href).then(response => response?.text())).toBe('complete CSS');
  expect(vi.getTimerCount()).toBe(0);
});

test('an explicit navigation reload serves its exact shell before a stalled revalidation', async () => {
  vi.useFakeTimers();
  const f = fixture(() => new Promise<Response>(() => { /* Radio remains pending. */ }));
  const previous = `<script src="${entry}"></script>previous shell`;
  await (await f.open('ws-shell-unit-build')).put(new URL('/index.html', base).href, new Response(previous));
  const work = f.dispatch('fetch', { request: new Request(new URL('/?v=reload', base)) });
  await vi.advanceTimersByTimeAsync(0);
  expect(await f.responses.at(-1)?.text()).toBe(previous);
  expect(f.fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10000); await work;
  expect(f.responses.at(-1)?.headers.get('server-timing')).toContain('ws-cache');
  f.navigator.onLine = false; f.fetch.mockClear();
  await f.dispatch('fetch', { request: new Request(new URL('/?v=offline', base)) });
  expect(f.fetch).not.toHaveBeenCalled();
  expect(await f.responses.at(-1)?.text()).toBe(previous);
});

test('all stalled script attempts terminate and publish no partial module', async () => {
  vi.useFakeTimers();
  const f = fixture(() => new Promise<Response>(() => { /* Even abort cannot settle this host. */ }));
  const work = expect(f.dispatch('fetch', { request: scriptRequest(lazy) })).rejects.toThrow('Service worker fetch stalled');
  await vi.advanceTimersByTimeAsync(32700); await work;
  expect(f.fetch).toHaveBeenCalledTimes(3);
  expect(await (await f.open('ws-immutable')).match(new URL(lazy, base).href)).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});


test('a healthy slow body keeps progressing beyond the per-stall limit without a retry', async () => {
  vi.useFakeTimers();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const f = fixture(() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } }))));
  const work = f.dispatch('fetch', { request: new Request(new URL(css, base)) });
  await vi.advanceTimersByTimeAsync(9000);
  if (stream === undefined) throw new Error('Missing body source');
  stream.enqueue(new TextEncoder().encode('first'));
  await vi.advanceTimersByTimeAsync(9000); stream.enqueue(new TextEncoder().encode('second'));
  await vi.advanceTimersByTimeAsync(9000); stream.close(); await work;
  expect(await f.responses[0]?.text()).toBe('firstsecond');
  expect(f.fetch).toHaveBeenCalledTimes(1);
  expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});


test('activation claims without downloading a manifest or traversing any cache', async () => {
  const f = fixture(() => new Promise<Response>(() => { /* A dead radio cannot block claim. */ }));
  await f.dispatch('activate');
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.replies).toEqual([]);
});

test('a cold uncached navigation has one3s total deadline even while its HTML trickles', async () => {
  vi.useFakeTimers(); let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const f = fixture(() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({ start(c) { stream = c; } }))));
  const body = async (): Promise<void> => {
    await f.dispatch('fetch', { request: new Request(new URL('/index.html', base)) });
    await f.responses[0]?.text();
  };
  const work = expect(body()).rejects.toThrow('Service worker fetch stalled');
  await vi.advanceTimersByTimeAsync(2500);
  if (stream === undefined) throw new Error('Missing response stream');
  stream.enqueue(new TextEncoder().encode('<html>'));
  await vi.advanceTimersByTimeAsync(500); await work;
  expect(f.fetch).toHaveBeenCalledTimes(1);
  expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test('post-control GC tolerates an unavailable manifest and carries offline bytes', async () => {
  vi.useFakeTimers();
  const f = fixture(() => new Promise<Response>(() => { /* Manifest cannot arrive. */ }));
  await (await f.open('ws-static-old')).put(new URL('/assets/needed.bin', base).href, new Response('old body'));
  await f.dispatch('activate');
  const work = f.dispatch('message', { data: { type: 'GC' } });
  await vi.advanceTimersByTimeAsync(10000); await work;
  expect(f.replies).toContainEqual({ type: 'GC', status: 'complete' });
  // Offline/unavailable manifest keeps carried bytes; no current-content guess.
  expect(await (await f.open('ws-static-unit-assets')).match(new URL('/assets/needed.bin', base).href).then(r=>r?.text())).toBe('old body');
});

test('versioned and content-addressed old static bodies remain usable before GC', async () => {
  const path = `/assets/baked/fixture/${'1'.repeat(64)}.bin`;
  const f = fixture();
  await (await f.open('ws-static-old')).put(new URL(path,base).href,new Response('exact visited body'));
  f.navigator.onLine=false;
  await f.dispatch('activate');
  await f.dispatch('fetch',{request:new Request(new URL(path,base))});
  expect(await f.responses[0]?.text()).toBe('exact visited body');
  expect(f.fetch).not.toHaveBeenCalled();
});


test('GC stops at30s and late cache traversal cannot delete or publish after expiry', async () => {
  vi.useFakeTimers();
  const f = fixture(() => Promise.resolve(new Response(null, { status: 204 })));
  const old = await f.open('ws-static-old'), key = new URL('/assets/needed.bin',base).href;
  await old.put(key,new Response('retained'));
  let finish: ((rows: Request[]) => void) | undefined;
  old.keys = () => new Promise<Request[]>(resolve => { finish = resolve; });
  await f.dispatch('activate');
  const work = f.dispatch('message',{data:{type:'GC'}});
  await vi.waitFor(() => { expect(finish).toBeTypeOf('function'); });
  await vi.advanceTimersByTimeAsync(30000); await work;
  expect(f.replies).toContainEqual({type:'GC',status:'timed-out'});
  if(finish===undefined)throw new Error('GC never reached old cache');
  finish([new Request(key)]); await vi.advanceTimersByTimeAsync(0);
  expect(await (await f.open('ws-static-old')).match(key).then(r=>r?.text())).toBe('retained');
  expect(await (await f.open('ws-static-unit-assets')).match(key)).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

test('GLB data reaches the page before completion and a stalled suffix cannot enter the cache', async () => {
  vi.useFakeTimers();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const f = fixture(() => Promise.resolve(new Response(new ReadableStream<Uint8Array>({
    start(c) { stream = c; c.enqueue(Uint8Array.of(1,2,3)); },
  }))));
  const path = '/assets/tex/object-aaaaaaaa.glb';
  await f.dispatch('fetch', {request:new Request(new URL(path,base))});
  const reader = f.responses[0]?.body?.getReader();
  if(reader===undefined||stream===undefined)throw new Error('Missing live data body');
  expect(await reader.read()).toEqual({done:false,value:Uint8Array.of(1,2,3)});
  const suffix=expect(reader.read()).rejects.toThrow('Service worker fetch stalled');
  await vi.advanceTimersByTimeAsync(10000);await suffix;reader.releaseLock();
  expect(f.fetch).toHaveBeenCalledTimes(1);
  expect(await(await f.open('ws-static-unit-assets')).match(new URL(path,base).href)).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

test('shard blobs reuse only the verified content cache and leave persistence to its owner', async () => {
  const hash = 'a'.repeat(64), path = `/shardfiles/sample/blobs/glb/${hash}.glb`, url = new URL(path, base).href;
  const f = fixture(() => Promise.resolve(new Response(Uint8Array.of(1,2,3))));
  const content = await f.open(CONTENT_CACHE_NAME), legacy = await f.open('ws-static-unit-assets');
  const key = new URL(hash, new URL(CONTENT_CACHE_ROOT, base)).href;
  const contentWrites = vi.spyOn(content, 'put'), legacyWrites = vi.spyOn(legacy, 'put');
  await f.dispatch('fetch', {request:new Request(url)});
  const bytes = await f.responses[0]?.arrayBuffer(); expect(new Uint8Array(bytes ?? [])).toEqual(Uint8Array.of(1,2,3));
  expect(contentWrites).not.toHaveBeenCalled(); expect(legacyWrites).not.toHaveBeenCalled();
  // The authenticated owner publishes once. The next request is offline and
  // must use that exact canonical key without another network or static copy.
  await content.put(key, new Response(bytes)); f.navigator.onLine = false;
  await f.dispatch('fetch', {request:new Request(url)});
  expect(await f.responses[1]?.arrayBuffer()).toEqual(bytes);
  expect(f.responses[1]?.headers.get('server-timing')).toContain('ws-cache');
  expect(f.fetch).toHaveBeenCalledTimes(1); expect(contentWrites).toHaveBeenCalledTimes(1); expect(legacyWrites).not.toHaveBeenCalled();
  await f.dispatch('message',{data:{type:'STORE',url,blob:new Blob([Uint8Array.of(1,2,3)])}});
  await f.dispatch('message',{data:{type:'PREFETCH',url}});
  expect(f.replies).toContainEqual({type:'STORED',status:'failed',bytes:0});
  expect(f.replies).toContainEqual({type:'PREFETCHED',status:'hit',bytes:0});
  expect(contentWrites).toHaveBeenCalledTimes(1); expect(legacyWrites).not.toHaveBeenCalled();
});

test('shard Range reads preserve their response rather than replaying a full cached body', async () => {
  const hash='b'.repeat(64), url=new URL(`/shardfiles/sample/blobs/bin/${hash}.bin`,base).href;
  const f=fixture(()=>Promise.resolve(new Response(Uint8Array.of(7,8),{status:206,headers:{'content-range':'bytes 2-3/6'}})));
  await(await f.open(CONTENT_CACHE_NAME)).put(new URL(hash,new URL(CONTENT_CACHE_ROOT,base)).href,new Response(Uint8Array.of(0,1,7,8,4,5)));
  await f.dispatch('fetch',{request:new Request(url,{headers:{range:'bytes=2-3'}})});
  expect(f.responses[0]?.status).toBe(206); expect(f.responses[0]?.headers.get('content-range')).toBe('bytes 2-3/6');
  expect(new Uint8Array(await f.responses[0]?.arrayBuffer()??[])).toEqual(Uint8Array.of(7,8));
  expect(f.fetch).toHaveBeenCalledTimes(1);
});

test('shard download slots cover whole bodies, cancel queued work, and drop to two after control', async () => {
  const sources: ReadableStreamDefaultController<Uint8Array>[]=[];
  const f=fixture(url=>Promise.resolve(url.includes('/blobs/')?new Response(new ReadableStream<Uint8Array>({start(c){sources.push(c);c.enqueue(Uint8Array.of(3));}})):Response.json({})));
  const request=(i:number,signal?:AbortSignal):Request=>new Request(new URL(`/shardfiles/sample/blobs/bin/${i.toString(16).padStart(64,'0')}.bin`,base),signal===undefined?{}:{signal});
  await Promise.all(Array.from({length:6},(_,i)=>f.dispatch('fetch',{request:request(i)})));
  expect(sources).toHaveLength(6);
  const abort=new AbortController(); const cancelled=expect(f.dispatch('fetch',{request:request(6,abort.signal)})).rejects.toThrow('cancel queue');
  abort.abort(new Error('cancel queue')); await cancelled;
  const queued=f.dispatch('fetch',{request:request(7)});
  await Promise.resolve(); expect(sources).toHaveLength(6);
  await f.responses[0]?.body?.cancel(); await queued; expect(sources).toHaveLength(7);
  await f.dispatch('message',{data:{type:'GC'}});
  const late=f.dispatch('fetch',{request:request(8)});
  // Six already-started downloads finish naturally. A post-control request
  // stays queued until fewer than two bodies are still live.
  await Promise.all(f.responses.slice(1,6).map(async r=>{await r.body?.cancel();})); await late;
  expect(sources).toHaveLength(8);
  const last=f.dispatch('fetch',{request:request(9)});
  await Promise.resolve(); expect(sources).toHaveLength(8);
  await f.responses[6]?.body?.cancel(); await last; expect(sources).toHaveLength(9);
  await Promise.all(f.responses.slice(7).map(async r=>{await r.body?.cancel();}));
  expect(f.fetch.mock.calls.filter(([input])=>(typeof input==='string'?input:input.url).includes('/blobs/'))).toHaveLength(9);
});

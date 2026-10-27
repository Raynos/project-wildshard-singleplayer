// oxlint-disable-next-line import/no-nodejs-modules -- Execute the shipped worker source against deterministic browser boundaries.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated context executes the original worker rather than a copied implementation.
import { runInNewContext } from 'node:vm';
import { afterEach, expect, test, vi } from 'vitest';
import { contentNamed } from '../scripts/app-build/assetHashes';
import { writeCodePacks } from '../scripts/app-build/codePacks';
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
function fixture(read?: (url: string, init?: RequestInit) => Promise<Response>, warm: readonly string[] = [entry, dependency, css, lazy, later], packs?: unknown) {
  const listeners = new Map<string, ((event: WorkerEvent) => void)[]>(), books = new Map<string, StoredCache>();
  const installErrors: unknown[] = [];
  const replies: unknown[] = [];
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
  const worker = readFileSync('src/engine/pwa/sw.js', 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '').replace("import { codePackEntries, readCodePackTransport } from './codePack.js';\n", '')
    .replaceAll('__BUILD_ID__', 'unit-build').replaceAll('__ASSET_ID__', 'unit-assets')
    .replace("'__BUNDLE__'", JSON.stringify(JSON.stringify([entry, dependency, css, lazy, later])))
    .replace("'__WARM__'", JSON.stringify(JSON.stringify(warm)))
    .replace("'__INSTALL__'", JSON.stringify(JSON.stringify([entry, dependency, css])))
    .replace("'__CODE_PACKS__'", JSON.stringify(JSON.stringify(packs ?? { files: [], entries: {} })))
    .replace("'__FONTS__'", JSON.stringify('[]'));
  runInNewContext(`${owner}\n${packSource}\n${worker}`, { self, caches, fetch, URL, Request, Response, Headers, Blob, DecompressionStream, TextDecoder, AbortController, setTimeout, clearTimeout, Date, console, crypto });
  const dispatch = async (kind: string, payload: Pick<WorkerEvent, 'data' | 'request' | 'ports'> = {}): Promise<void> => {
    const pending: Promise<unknown>[] = [];
    for (const listener of listeners.get(kind) ?? []) listener({ ...payload, source: { postMessage: (value: unknown) => { replies.push(value); } }, waitUntil: work => { pending.push(work); }, respondWith: work => { pending.push(work); } });
    await Promise.all(pending);
  };
  return { fetch, open, dispatch, navigator, installErrors, replies };
}
afterEach(() => { vi.useRealTimers(); });

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
    expect(messages).toEqual([{ type: 'CODE_PACK_STARTED' }, { type: 'CODE_PACK_DONE', status: 'stored' }]);
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

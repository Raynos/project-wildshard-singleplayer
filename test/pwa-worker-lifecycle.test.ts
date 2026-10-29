// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual shipped worker in an isolated browser boundary.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture executes source, never a copied cache implementation.
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';
import { ASSET_CACHE_NAME } from '../src/engine/pwa/cacheNames';

const origin = 'https://worker.test';
const url = (path: string): string => new URL(path, origin).href;
const shared = '/assets/shared-ssssssss.js';
const shell = ['/manifest.webmanifest'];
const document = '<!doctype html><html><body>worker shell π</body></html>';
interface WorkerEvent {
  request?: Request;
  data?: { type: string };
  ports?: { postMessage: (value: unknown) => void }[];
  source?: { postMessage: (value: unknown) => void };
  waitUntil: (work: Promise<unknown>) => void;
  respondWith: (work: Response | Promise<Response>) => void;
}
class StoredCache {
  readonly entries = new Map<string, Response>();
  private key(input: Request | string): string { return typeof input === 'string' ? input : input.url; }
  match(input: Request | string): Promise<Response | undefined> { return Promise.resolve(this.entries.get(this.key(input))?.clone()); }
  async put(input: Request | string, response: Response): Promise<void> {
    this.entries.set(this.key(input), new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers }));
  }
  keys(): Promise<Request[]> { return Promise.resolve([...this.entries.keys()].map(key => new Request(key))); }
  delete(input: Request | string): Promise<boolean> { return Promise.resolve(this.entries.delete(this.key(input))); }
}
function fixture(read?: (request: Request) => Promise<Response>) {
  const books = new Map<string, StoredCache>();
  const open = (name: string): Promise<StoredCache> => {
    let cache = books.get(name);
    if (cache === undefined) { cache = new StoredCache(); books.set(name, cache); }
    return Promise.resolve(cache);
  };
  const caches = { open, keys: () => Promise.resolve([...books.keys()]), delete: (name: string) => Promise.resolve(books.delete(name)) };
  const fetch = vi.fn((input: Request | string) => read?.(typeof input === 'string' ? new Request(input) : input)
    ?? Promise.resolve(new Response(`body:${typeof input === 'string' ? input : input.url}`)));
  const load = (build: string, files: string[], shellFiles = shell) => {
    const listeners = new Map<string, ((event: WorkerEvent) => void)[]>();
    const claim = vi.fn(() => Promise.resolve()), skipWaiting = vi.fn(() => Promise.resolve());
    const self = { location: new URL(origin), registration: { scope: `${origin}/` }, clients: { claim }, skipWaiting,
      addEventListener: (kind: string, listener: (event: WorkerEvent) => void) => { listeners.set(kind, [...listeners.get(kind) ?? [], listener]); } };
    const owner = readFileSync('src/engine/app/workerScope.js', 'utf8').replaceAll(/^export /gmu, '');
    const source = readFileSync('src/engine/pwa/sw.js', 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '').replaceAll('__BUILD_ID__', build)
      .replaceAll('__ASSET_CACHE__', ASSET_CACHE_NAME).replace("'__DOCUMENT__'", JSON.stringify(document)).replace("'__FILES__'", JSON.stringify(JSON.stringify(files)))
      .replace("'__SHELL_FILES__'", JSON.stringify(JSON.stringify(shellFiles)));
    // Deliberately no clock, crypto, scheduler or accounting ports.
    runInNewContext(`${owner}\n${source}`, { self, caches, fetch, URL, Request, Response, Set, JSON, encodeURIComponent });
    const dispatch = async (kind: string, payload: Pick<WorkerEvent, 'request' | 'data' | 'ports' | 'source'> = {}): Promise<Response | undefined> => {
      const work: Promise<unknown>[] = []; let response: Response | undefined;
      for (const listener of listeners.get(kind) ?? []) listener({ ...payload,
        waitUntil: promise => { work.push(promise); }, respondWith: promise => { work.push(Promise.resolve(promise).then(value => { response = value; return value; })); } });
      await Promise.all(work); return response;
    };
    return { dispatch, claim, skipWaiting };
  };
  return { caches, open, books, fetch, load };
}

test('install precaches its complete shell and hashed files before publishing a generation', async () => {
  const f = fixture(), worker = f.load('A', ['/assets/a-aaaaaaaa.js', shared]);
  await worker.dispatch('install'); await worker.dispatch('activate');
  expect(f.fetch).toHaveBeenCalledTimes(3); expect(worker.claim).not.toHaveBeenCalled();
  const assets = await f.open(ASSET_CACHE_NAME), current = await f.open('ws-shell-v3-A');
  expect(await (await assets.match(url(shared)))?.text()).toBe(`body:${url(shared)}`);
  expect(await current.match(url('/index.html'))).toBeUndefined();
  f.fetch.mockRejectedValue(new Error('offline'));
  expect(await (await worker.dispatch('fetch', { request: new Request(url(shared)) }))?.text()).toBe(`body:${url(shared)}`);
  expect(await (await worker.dispatch('fetch', { request: new Request(url('/')) }))?.text()).toBe(document);
  expect(f.fetch).toHaveBeenCalledTimes(3);
});

test('navigation serves the exact built document without any storage or network operation', async () => {
  const f = fixture(), open = vi.spyOn(f.caches, 'open').mockRejectedValue(new DOMException('denied', 'SecurityError'));
  const worker = f.load('A', []);
  for (const path of ['/', '/index.html', '/?chunk=fixture']) {
    const response = await worker.dispatch('fetch', {request: new Request(url(path))});
    expect(response?.status).toBe(200); expect(response?.headers.get('content-type')).toBe('text/html;charset=utf-8');
    expect(response?.headers.get('cache-control')).toBe('no-store'); expect(await response?.text()).toBe(document);
  }
  expect(open).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
});

test('a worker reuses its installed cache handles across navigation and content reads', async () => {
  const f = fixture(), open = vi.spyOn(f.caches, 'open');
  const file = '/assets/file-0123456789abcdef.bin', worker = f.load('A', [file]);
  await worker.dispatch('install'); await worker.dispatch('activate');
  const before = open.mock.calls.length;
  for (let visit = 0; visit < 3; visit++) {
    await worker.dispatch('fetch', {request: new Request(url('/'))});
    await worker.dispatch('fetch', {request: new Request(url(file))});
  }
  expect(open.mock.calls).toHaveLength(before);
  expect(open.mock.calls.filter(([name]) => name === ASSET_CACHE_NAME)).toHaveLength(1);
  expect(open.mock.calls.filter(([name]) => name === 'ws-shell-v3-A')).toHaveLength(1);
});

test('a rejected native cache open never poisons the next ordinary read', async () => {
  const f = fixture(), open = vi.spyOn(f.caches, 'open').mockRejectedValueOnce(new DOMException('denied', 'SecurityError'));
  const request = new Request(url('/assets/file-0123456789abcdef.bin')), worker = f.load('A', []);
  for (let visit = 0; visit < 3; visit++) {
    expect(await (await worker.dispatch('fetch', {request}))?.text()).toBe(`body:${request.url}`);
  }
  expect(open).toHaveBeenCalledTimes(2); expect(f.fetch).toHaveBeenCalledTimes(2);
});

test('named shell artwork is installed into the same asset cache its fetch route reads', async () => {
  const image = '/assets/title/hero-0123456789abcdef.jpg', f = fixture();
  const worker = f.load('A', [], ['/index.html', image]);
  await worker.dispatch('install'); await worker.dispatch('activate');
  expect(await (await f.open(ASSET_CACHE_NAME)).match(url(image))).toBeDefined();
  expect(await (await f.open('ws-shell-v3-A')).match(url(image))).toBeUndefined();
  f.fetch.mockRejectedValue(new Error('offline'));
  expect(await (await worker.dispatch('fetch', {request: new Request(url(image))}))?.text()).toBe(`body:${url(image)}`);
  expect(f.fetch).toHaveBeenCalledTimes(2);
});

test('same-build content and versioned metadata read from the one asset cache without network', async () => {
  const f = fixture(), worker = f.load('A', []);
  for (const path of [`/shardfiles/fixture/blobs/glb/${'a'.repeat(64)}.glb`, '/assets/entry-fixture-0123456789abcdef.json', '/shardfiles/fixture/shard.json?v=abcdef12']) {
    const before = f.fetch.mock.calls.length, request = new Request(url(path));
    const first = await worker.dispatch('fetch', { request });
    const second = await worker.dispatch('fetch', { request });
    expect(await first?.text()).toBe(`body:${request.url}`); expect(await second?.text()).toBe(`body:${request.url}`);
    expect(f.fetch.mock.calls.length).toBe(before + 1);
    expect(await (await f.open(ASSET_CACHE_NAME)).match(request)).toBeDefined();
    expect(second?.headers.has('server-timing')).toBe(false);
  }
});

test('retention keeps current plus previous code, shared chunks and immutable content', async () => {
  const f = fixture(), a = '/assets/a-aaaaaaaa.js', b = '/assets/b-bbbbbbbb.js', c = '/assets/c-cccccccc.js';
  const content = `/assets/models/${'d'.repeat(64)}.glb`;
  const first = f.load('A', [a, shared]); await first.dispatch('install'); await first.dispatch('activate');
  await first.dispatch('fetch', { request: new Request(url(content)) });
  const second = f.load('B', [b, shared]); await second.dispatch('install'); await second.dispatch('activate');
  const assets = await f.open(ASSET_CACHE_NAME); expect(await assets.match(url(a))).toBeDefined();
  const third = f.load('C', [c, shared]); await third.dispatch('install'); await third.dispatch('activate');
  expect(await assets.match(url(a))).toBeUndefined(); expect(await assets.match(url(b))).toBeDefined();
  expect(await assets.match(url(c))).toBeDefined(); expect(await assets.match(url(shared))).toBeDefined();
  expect(await assets.match(url(content))).toBeDefined();
  expect((await (await f.open('ws-builds-v1')).keys())).toHaveLength(2);
  expect(await f.caches.keys()).not.toContain('ws-shell-v3-A');
  expect(await f.caches.keys()).not.toContain('ws-shell-v3-B');
});

test('an incomplete install never publishes a generation or prunes working code', async () => {
  let fail = false;
  const f = fixture(request => Promise.resolve(new Response('code', { status: fail && request.url.endsWith('/assets/b-bbbbbbbb.js') ? 503 : 200 })));
  const a = f.load('A', ['/assets/a-aaaaaaaa.js']); await a.dispatch('install'); await a.dispatch('activate'); fail = true;
  const b = f.load('B', ['/assets/b-bbbbbbbb.js']); await expect(b.dispatch('install')).rejects.toThrow('Precache failed');
  expect(await (await f.open(ASSET_CACHE_NAME)).match(url('/assets/a-aaaaaaaa.js'))).toBeDefined();
  expect((await (await f.open('ws-builds-v1')).keys())).toHaveLength(1);
});

test('the one-time rewrite preserves named legacy bodies and one old code generation', async () => {
  const f = fixture(), oldCode = '/assets/old-oooooooo.js', named = `/assets/models/${'e'.repeat(64)}.glb`;
  await (await f.open('ws-immutable')).put(url(oldCode), new Response('old code'));
  await (await f.open('ws-static-old')).put(url(named), new Response('named model'));
  await (await f.open('ws-static-old')).put(url('/assets/baked/mutable.bin'), new Response('mutable old'));
  const a = f.load('A', ['/assets/a-aaaaaaaa.js']); await a.dispatch('install'); await a.dispatch('activate');
  const assets = await f.open(ASSET_CACHE_NAME);
  expect(await (await assets.match(url(oldCode)))?.text()).toBe('old code');
  expect(await (await assets.match(url(named)))?.text()).toBe('named model');
  expect(await assets.match(url('/assets/baked/mutable.bin'))).toBeUndefined();
  expect(await f.caches.keys()).not.toContain('ws-static-old'); expect(await f.caches.keys()).not.toContain('ws-immutable');
  const b = f.load('B', ['/assets/b-bbbbbbbb.js']); await b.dispatch('install'); await b.dispatch('activate');
  expect(await assets.match(url(oldCode))).toBeUndefined(); expect(await assets.match(url(named))).toBeDefined();
});

test.each([200, 204, 205, 304])('a native bodyless %i passes through without reconstruction', async status => {
  const original = new Response(null, { status }), f = fixture(() => Promise.resolve(original)), worker = f.load('A', []);
  expect(await worker.dispatch('fetch', { request: new Request(url(`/assets/${'f'.repeat(64)}.bin`)) })).toBe(original);
});

test('version, API, cross-origin, non-GET and explicit opt-out bypass the worker', async () => {
  const f = fixture(), worker = f.load('A', []);
  for (const request of [new Request(url('/version.json')), new Request(url('/api/state')), new Request('https://other.test/a.js'),
    new Request(url('/assets/a-aaaaaaaa.js?sw=0')), new Request(url('/api/write'), { method: 'POST' })]) {
    expect(await worker.dispatch('fetch', { request })).toBeUndefined();
  }
  expect(f.fetch).not.toHaveBeenCalled(); expect(await f.caches.keys()).toEqual([]);
});

test('quota denial serves online bytes; partial bodies never replace a full cache entry', async () => {
  const f = fixture(), assets = await f.open(ASSET_CACHE_NAME), worker = f.load('A', []);
  vi.spyOn(assets, 'put').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
  const request = new Request(url(`/assets/${'a'.repeat(64)}.bin`));
  expect(await (await worker.dispatch('fetch', { request }))?.text()).toBe(`body:${request.url}`);
  const partial = fixture(() => Promise.resolve(new Response('part', { status: 206 }))), ranged = partial.load('A', []);
  await ranged.dispatch('fetch', { request }); expect(await (await partial.open(ASSET_CACHE_NAME)).match(request)).toBeUndefined();
});

test('BUILD/VERSION are identity-only and SKIP_WAITING preserves the adoption protocol', async () => {
  const f = fixture(), worker = f.load('A', []), replies: unknown[] = [];
  for (const type of ['BUILD', 'VERSION']) await worker.dispatch('message', { data: { type }, ports: [{ postMessage: value => { replies.push(value); } }] });
  expect(replies).toEqual([{ type: 'BUILD', build: 'A' }, { type: 'VERSION', build: 'A' }]);
  await worker.dispatch('message', { data: { type: 'SKIP_WAITING' } }); expect(worker.skipWaiting).toHaveBeenCalledOnce();
  await worker.dispatch('message', { data: { type: 'WARM_CODE' } }); expect(f.fetch).not.toHaveBeenCalled();
  expect(await f.caches.keys()).toEqual([]);
});

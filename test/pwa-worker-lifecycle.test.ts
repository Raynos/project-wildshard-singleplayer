// oxlint-disable-next-line import/no-nodejs-modules -- Execute the shipped worker source against deterministic browser boundaries.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated context executes the original worker rather than a copied implementation.
import { runInNewContext } from 'node:vm';
import { afterEach, expect, test, vi } from 'vitest';

const base = 'https://worker.test/';
const entry = '/assets/entry-aaaaaaaa.js', dependency = '/assets/shared-bbbbbbbb.js', css = '/assets/style-cccccccc.css';
const lazy = '/assets/lazy-dddddddd.js', later = '/assets/later-eeeeeeee.js';
interface WorkerEvent {
  readonly source?: { postMessage: (value: unknown) => void };
  readonly data?: { type: string };
  readonly request?: Request;
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
function fixture(read?: (url: string, init?: RequestInit) => Promise<Response>) {
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
  const worker = readFileSync('src/engine/pwa/sw.js', 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '')
    .replaceAll('__BUILD_ID__', 'unit-build').replaceAll('__ASSET_ID__', 'unit-assets')
    .replace("'__BUNDLE__'", JSON.stringify(JSON.stringify([entry, dependency, css, lazy, later])))
    .replace("'__INSTALL__'", JSON.stringify(JSON.stringify([entry, dependency, css])))
    .replace("'__FONTS__'", JSON.stringify('[]'));
  runInNewContext(`${owner}\n${worker}`, { self, caches, fetch, URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout, Date, console });
  const dispatch = async (kind: string, payload: Pick<WorkerEvent, 'data' | 'request'> = {}): Promise<void> => {
    const pending: Promise<unknown>[] = [];
    for (const listener of listeners.get(kind) ?? []) listener({ ...payload, source: { postMessage: (value: unknown) => { replies.push(value); } }, waitUntil: work => { pending.push(work); }, respondWith: work => { pending.push(work); } });
    await Promise.all(pending);
  };
  return { fetch, open, dispatch, navigator, installErrors, replies };
}
afterEach(() => { vi.useRealTimers(); });

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

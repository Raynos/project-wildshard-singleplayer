import { workerScope } from '../app/workerScope.js';
/* MF1: one URL cache, one build shell, and one previous generation of code.
 * No fetched-body reconstruction, checksums, receipts, packs, retries or work timers. */
const BUILD = '__BUILD_ID__';
const DOCUMENT = '__DOCUMENT__';
const ASSETS = '__ASSET_CACHE__';
const BOOKS = 'ws-builds-v1';
const SHELL_PREFIX = 'ws-shell-v3-';
const SHELL = `${SHELL_PREFIX}${BUILD}`;
const FILES = JSON.parse('__FILES__');
const SHELL_FILES = JSON.parse('__SHELL_FILES__');
const NAMED = new Set(FILES);
const MATCH = { ignoreVary: true };
const abs = path => new URL(path, self.registration.scope).href;
const bookKey = build => abs(`/__ws_build__/${encodeURIComponent(build)}`);
const CONTENT = /-[a-f0-9]{8,64}\.[a-z0-9]+$|\/[a-f0-9]{64}\.[a-z0-9]+$/;
const HASH = /\/([a-f0-9]{64})\.[a-z0-9]+$/;
const immutable = url => NAMED.has(url.pathname) || CONTENT.test(url.pathname)
  || /^[a-f0-9]{8,64}$/.test(url.searchParams.get('v') ?? '');
const isHtml = response => /\btext\/html\b/i.test(response.headers.get('content-type') ?? '');

// Keep the current worker's hot handles. WebKit can take a second to reopen
// a cache during navigation; a rejected open must remain retryable.
const stores = new Map();
function store(name) {
  const existing = stores.get(name);
  if (existing !== undefined) return existing;
  const pending = (async () => {
    await Promise.resolve(); // Publish this promise before a synchronous storage refusal.
    try { return await caches.open(name); }
    catch (error) { if (stores.get(name) === pending) stores.delete(name); throw error; }
  })();
  stores.set(name, pending);
  return pending;
}

async function precache(cache, urls, contentNamed = false) {
  await Promise.all(urls.map(async path => {
    const key = abs(path);
    const held = await cache.match(key, MATCH);
    if (held !== undefined && !isHtml(held)) return;
    if (held !== undefined) await cache.delete(key);
    const response = await fetch(new Request(key, { cache: contentNamed ? 'force-cache' : 'reload' }));
    if (!response.ok || isHtml(response)) throw new Error(`Precache failed: ${path} (${response.status})`);
    await cache.put(key, response);
  }));
}

// Import old immutable entries once; mutable public URLs deliberately load cold.
async function importPrevious(assets, books) {
  if ((await books.keys()).length > 0) return;
  const code = [];
  for (const name of await caches.keys()) {
    if (name !== 'ws-immutable' && !name.startsWith('ws-static-')) continue;
    const old = await caches.open(name);
    for (const request of await old.keys()) {
      const url = new URL(request.url);
      if (name !== 'ws-immutable' && !immutable(url)) continue;
      const response = await old.match(request, MATCH);
      if (response === undefined || isHtml(response)) continue;
      await assets.put(request, response);
      if (name === 'ws-immutable') code.push(request.url);
    }
  }
  if (code.length > 0) await books.put(bookKey('previous'), Response.json({ files: code }));
}

workerScope.listen(self, 'install', event => {
  // Native cache routes avoid waking the worker for already installed title code.
  // The mutable document races its exact offline shell; neither path waits for the other.
  const pattern = pathname => ({ protocol: self.location.protocol.slice(0, -1), hostname: self.location.hostname,
    port: self.location.port, pathname, search: '' });
  const routes = typeof event.addRoutes === 'function' ? event.addRoutes([
    ...['/', '/index.html'].map(pathname => ({ condition: { urlPattern: pattern(pathname), requestMode: 'navigate', requestMethod: 'GET' }, source: 'race-network-and-fetch-handler' })),
    ...['script', 'style'].map(requestDestination => ({ condition: { urlPattern: pattern('/assets/*'), requestDestination, requestMethod: 'GET' }, source: { cacheName: ASSETS } })),
    { condition: { urlPattern: pattern('/assets/title/*'), requestDestination: 'image', requestMethod: 'GET' }, source: { cacheName: ASSETS } },
    { condition: { urlPattern: pattern('/fonts/*'), requestDestination: 'font', requestMethod: 'GET' }, source: { cacheName: SHELL } },
  ]) : undefined;
  event.waitUntil((async () => {
    await routes;
    const [assets, shell, books] = await Promise.all([store(ASSETS), store(SHELL), caches.open(BOOKS)]);
    await importPrevious(assets, books);
    const namedShell = SHELL_FILES.filter(path => immutable(new URL(abs(path))));
    await Promise.all([precache(shell, SHELL_FILES.filter(path => !namedShell.includes(path))),
      precache(assets, [...FILES, ...namedShell], true)]);
    // Only a completely installed build is a generation. Failed installs never evict working code.
    await books.put(bookKey(BUILD), Response.json({ files: FILES.map(abs) }));
  })());
});

workerScope.listen(self, 'activate', event => {
  event.waitUntil((async () => {
    const books = await caches.open(BOOKS), current = bookKey(BUILD);
    const keys = await books.keys(), previous = keys.findLast(key => key.url !== current)?.url;
    const kept = new Set(FILES.map(abs));
    if (previous !== undefined) {
      const record = await books.match(previous);
      if (record !== undefined) for (const file of (await record.json()).files) kept.add(file);
    }
    const assets = await store(ASSETS);
    for (const key of keys) {
      if (key.url === current || key.url === previous) continue;
      const record = await books.match(key);
      if (record !== undefined) for (const file of (await record.json()).files) if (!kept.has(file)) await assets.delete(file);
      await books.delete(key);
    }
    for (const name of await caches.keys()) {
      if (name === SHELL) continue;
      if (name.startsWith('ws-shell-') || name.startsWith('ws-static-') || name === 'ws-immutable') await caches.delete(name);
    }
  })());
});

async function cached(request, name) {
  let cache;
  // A visible retry must reach the origin, including past the legacy URL cache.
  const reload = request.cache === 'reload' || request.cache === 'no-store';
  try {
    cache = await store(name);
    const response = reload ? undefined : await cache.match(request, MATCH);
    if (response !== undefined && !isHtml(response)) return response;
    if (response !== undefined) await cache.delete(request);
    if (!reload && name !== ASSETS) {
      const shared = await (await store(ASSETS)).match(request, MATCH);
      if (shared !== undefined && !isHtml(shared)) return shared;
      if (shared !== undefined) await (await store(ASSETS)).delete(request);
    }
    // Wave 2 removes the old page cache. Until then retain its already named bodies.
    const hash = HASH.exec(new URL(request.url).pathname)?.[1];
    if (!reload && hash !== undefined && (await caches.keys()).includes('ws-content-v0')) {
      const old = await (await caches.open('ws-content-v0')).match(abs(`/__ws_content__/v0/${hash}`), MATCH);
      if (old !== undefined && !isHtml(old)) {
        await cache.put(request, old.clone()).catch(() => undefined);
        return old;
      }
    }
  } catch { stores.delete(name); stores.delete(ASSETS); /* Storage denial keeps online fetch working. */ }
  const response = await fetch(request);
  // Native no-body statuses pass through untouched. A range never replaces a full body.
  if (cache !== undefined && response.status === 200 && !isHtml(response)) await cache.put(request, response.clone()).catch(() => undefined);
  return response;
}

workerScope.listen(self, 'fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.get('sw') === '0') return;
  if (url.pathname === '/version.json' || url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(new Response(DOCUMENT, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } }));
    return;
  }
  if (immutable(url)) {
    event.respondWith(cached(request, ASSETS));
    return;
  }
  if (/^\/(?:assets|basis|fonts)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cached(request, SHELL));
  }
});

workerScope.listen(self, 'message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (type !== 'BUILD' && type !== 'VERSION') return;
  const value = { type, build: BUILD };
  const port = event.ports?.[0];
  if (port !== undefined) port.postMessage(value);
  else event.source?.postMessage(value);
});

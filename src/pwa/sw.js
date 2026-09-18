/* Wildshard service worker (docs/plans/LOAD-PERF.md §1b / §P3, docs/design/cache-policy.md).
 * Ported from game-demos/trials-gauntlet-demo/src/pwa/sw.js — it shipped on WebKit/Metal; port, don't redesign.
 *
 * Emitted by `vite/pwa-plugin.ts` with three stamps replaced per build:
 *   __BUILD_ID__  `<vite.config BUILD_ID>-<content hash of every emitted file + the public/ list>`. A deploy
 *                 that changes bytes is a byte-different worker (the browser installs it); a rebuild of the
 *                 same tree is the SAME worker, so a rebuild does not throw the player's 70 MB away.
 *   __ASSET_ID__  a hash of the public/assets file list + sizes alone, so the static cache survives a
 *                 JS-only deploy instead of being re-downloaded.
 *   __BUNDLE__    the emitted /assets/<name>-<hash>.* paths of this build — the worker's only name for the
 *                 content-addressed set (gauntlet had load-manifest.json for this); precached at install,
 *                 and `activate` PRUNES the immutable cache to it.
 *
 * THREE caches, because they expire on three different clocks:
 *   ws-immutable            content-addressed, therefore forever: /assets/<name>-<8>.{js,css,jpg}. `activate`
 *                           prunes it to __BUNDLE__ — it never deletes it wholesale.
 *   ws-static-<assets>      unhashed but rarely edited: /assets/tex|models|hdri/**, /basis/**, /fonts/**, root
 *                           icons. Keyed by a hash of public/ alone, so a JS-only deploy does NOT re-download
 *                           the 70 MB the boot streams. Cached on use — the boot fetches everything up front
 *                           anyway, and every one of those requests passes through `cacheFirst` below.
 *   ws-shell-<build>        the few KB that change every build: index.html, manifest.webmanifest,
 *                           asset-index.json.
 *
 *   install   precache the critical shell (strict — a failed shell fails install, so the old worker keeps
 *             serving), then the bundle + icons (tolerant, only what is missing).
 *   activate  migrate the previous ws-static-* entries whose size still matches asset-index.json into the new
 *             static cache, drop stale ws-shell/ws-static caches, prune (never wipe) the immutable cache, claim.
 *   fetch     hashed bundle: cache-first into ws-immutable;
 *             tex / models / hdri / basis / fonts / icons: cache-first into the static cache;
 *             the document: cache-first with a background revalidate (a flapping link must never hold the
 *             first paint); a `?v=` reload from the build pill (src/ui/Update.ts) is network-first;
 *             asset-index.json / sw.js / manifest.webmanifest: network-first, cache fallback;
 *             version.json: untouched (network-only — the build pill must see the server, not us);
 *             cross-origin (Google Fonts) and `?sw=0`: untouched.
 *   message   { type: 'SKIP_WAITING' } → activate now (src/boot/sw.ts `adopt()`, wired to the build pill)
 *             { type: 'VERSION' }      → what this worker holds, back on the message port.
 */
const BUILD = '__BUILD_ID__';
const ASSETS = '__ASSET_ID__';
/** @type {string[]} */
const BUNDLE = JSON.parse('__BUNDLE__');
const SHELL = `ws-shell-${BUILD}`;
const STATIC = `ws-static-${ASSETS}`;
const IMMUTABLE_CACHE = 'ws-immutable';
const KEEP = [SHELL, STATIC, IMMUTABLE_CACHE];

/** Install fails without these: an incomplete shell must not pretend to be installed. */
const SHELL_CRITICAL = ['/index.html', '/manifest.webmanifest'];
/** Nice to have at install; never fatal. */
const SHELL_OPTIONAL = ['/asset-index.json'];
const STATIC_OPTIONAL = ['/apple-touch-icon.png', '/favicon.png', '/icon-192.png', '/icon-512.png'];

/** Vite's hashed output sits directly under /assets/ — the unhashed Poly Haven dirs are one level deeper. */
const IMMUTABLE_RE = /^\/assets\/[^/]+-[\w-]{8}\.\w+$/;
const STATIC_RE = /^\/assets\/(tex|models|hdri|baked)\/|^\/basis\/|^\/fonts\/|^\/(apple-touch-icon|favicon|icon-\d+)\.png$/;
const NETWORK_FIRST_RE = /^\/(asset-index\.json|sw\.js|manifest\.webmanifest)$/;

const cacheFor = (pathname) => (IMMUTABLE_RE.test(pathname) ? IMMUTABLE_CACHE : STATIC);

/**
 * `ignoreVary` is not an optimisation, it is the whole thing working. `vite preview` (and any host that adds
 * CORS headers) answers with `Vary: Origin`; Cache Storage then refuses to match a stored entry against an
 * otherwise identical later request, so every file MISSES and goes back to the network — which looks like a
 * working offline boot only because the HTTP disk cache is quietly answering. We key these caches by URL and
 * never store content-negotiated variants, so Vary has nothing to tell us.
 *
 * `ignoreSearch` is deliberately NOT set: a versioned query must never be answered with last month's bytes.
 */
const MATCH_OPTS = { ignoreVary: true };

const abs = (p) => new URL(p, self.registration.scope).href;

/** `cache.add` only what is missing: a deploy must not spend the player's bytes re-fetching bytes it still has. */
async function fillMissing(cache, urls) {
  await Promise.all(urls.map(async (u) => ((await cache.match(abs(u), MATCH_OPTS)) ? undefined : cache.add(u).catch(() => undefined))));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(SHELL_CRITICAL); // throws → install fails → the old worker keeps serving
      await fillMissing(shell, SHELL_OPTIONAL);
      // The entry chunk was requested by the HTML before this worker controlled anything (a first visit), so
      // it never passed through `fetch` below; name it here or the second boot is not all-cache. Immutable on
      // the host, so this is served by the HTTP cache, not the network, when the page just fetched it.
      await fillMissing(await caches.open(IMMUTABLE_CACHE), BUNDLE);
      await fillMissing(await caches.open(STATIC), STATIC_OPTIONAL);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await migrateStatic();
      for (const k of await caches.keys()) if (k.startsWith('ws-') && !KEEP.includes(k)) await caches.delete(k);
      await pruneImmutable();
      await self.clients.claim();
    })(),
  );
});

/**
 * A new static cache name (one asset added, resized or removed) used to mean the previous 30 MB were thrown
 * away and the next launch re-downloaded all of it — DOWNLOAD read 100 % but every fetching step took
 * seconds (the 16 s cabins step of 2026-09-18). Carry every entry of the old ws-static-* caches over whose
 * decoded size still equals the byte the new build declares in /asset-index.json (fetched no-store); a
 * changed file is skipped and re-fetched lazily by cacheFirst, an absent one is dropped with the old cache.
 * Entries the index does not list (icons, fonts, basis) move as they are.
 */
async function migrateStatic() {
  const old = (await caches.keys()).filter((k) => k.startsWith('ws-static-') && k !== STATIC);
  if (!old.length) return;
  let sizes = null;
  try {
    const r = await fetch(abs('/asset-index.json'), { cache: 'no-store' });
    if (r.ok) sizes = await r.json();
  } catch { /* offline at activate: migrate by name only */ }
  const next = await caches.open(STATIC);
  for (const k of old) {
    const prev = await caches.open(k);
    for (const req of await prev.keys()) {
      try {
        if (await next.match(req, MATCH_OPTS)) continue;
        const res = await prev.match(req, MATCH_OPTS);
        if (!res) continue;
        const p = new URL(req.url).pathname;
        if (sizes && p.startsWith('/assets/')) {
          const want = sizes[p];
          if (typeof want !== 'number') continue; // no longer in the build
          if ((await res.clone().arrayBuffer()).byteLength !== want) continue; // edited in place: re-fetch lazily
        }
        await next.put(req, res);
      } catch { /* one bad entry must not stop the migration */ }
    }
  }
}

/** Drop only the content-addressed entries this build no longer names. An empty bundle list → no prune (never a wipe). */
async function pruneImmutable() {
  if (!BUNDLE.length) return;
  const names = new Set(BUNDLE.map((p) => new URL(p, self.registration.scope).pathname));
  const cache = await caches.open(IMMUTABLE_CACHE);
  for (const req of await cache.keys()) {
    const p = new URL(req.url).pathname;
    if (IMMUTABLE_RE.test(p) && !names.has(p)) await cache.delete(req);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'VERSION') event.waitUntil(reply(event, version()));
});

async function reply(event, work) {
  const payload = await work.catch((e) => ({ type: 'VERSION', error: String(e) }));
  const port = event.ports && event.ports[0];
  if (port) port.postMessage(payload);
  else if (event.source) event.source.postMessage(payload);
}

/** What this worker holds, so the page (and the bench) can state it rather than guess. */
async function version() {
  let entries = 0;
  let bytes = 0;
  const perCache = {};
  for (const name of KEEP) {
    const cache = await caches.open(name);
    let n = 0;
    let b = 0;
    for (const req of await cache.keys()) {
      n++;
      const res = await cache.match(req, MATCH_OPTS);
      if (!res) continue;
      const len = res.headers.get('content-length');
      b += len ? Number(len) : (await res.clone().arrayBuffer()).byteLength;
    }
    perCache[name] = { entries: n, bytes: b };
    entries += n;
    bytes += b;
  }
  return { type: 'VERSION', build: BUILD, assets: ASSETS, caches: perCache, entries, bytes };
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google Fonts: untouched
  if (url.searchParams.get('sw') === '0') return; // the bench measures the network, not the cache
  if (url.pathname === '/version.json') return; // network-only: the build pill must see the server
  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  if (isDoc) {
    event.respondWith(documentResponse(event, req, url));
    return;
  }
  if (NETWORK_FIRST_RE.test(url.pathname)) {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (IMMUTABLE_RE.test(url.pathname) || STATIC_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(req, cacheFor(url.pathname)));
    return;
  }
  event.respondWith(networkFirst(req, STATIC));
});

/**
 * The document, cache-first with a background revalidate. Network-first here is the gauntlet's B-SLOW bug:
 * a flapping radio holds the first paint behind a request whose bytes are already on disk, and `/` is
 * `no-store` on the host so the HTTP cache is not a second line of defence. A new build arrives by its own
 * worker installing and the build pill adopting it (src/boot/sw.ts), never by this revalidate — except the
 * pill's plain "reload" (`?v=<token>`, src/ui/Update.ts), which is the player asking for the server's copy:
 * that one is network-first, with the cache as the offline fallback.
 */
async function documentResponse(event, req, url) {
  const cache = await caches.open(SHELL);
  const key = abs('/index.html');
  if (url.searchParams.has('v')) return networkFirst(req, SHELL, key);
  const hit = await cache.match(key, MATCH_OPTS);
  if (hit) {
    event.waitUntil(
      fetch(req)
        .then((res) => (res.ok ? cache.put(key, res.clone()) : undefined))
        .catch(() => undefined),
    );
    return hit;
  }
  const res = await fetch(req);
  if (res.ok) cache.put(key, res.clone()).catch(() => undefined);
  return res;
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, MATCH_OPTS);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

/** @param {string} [key] store/match under this URL instead of the request's own (the document's `?v=` reload) */
async function networkFirst(req, name, key) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key || req, res.clone()).catch(() => undefined);
    return res;
  } catch (e) {
    const hit = await cache.match(key || req, MATCH_OPTS);
    if (hit) return hit;
    throw e;
  }
}

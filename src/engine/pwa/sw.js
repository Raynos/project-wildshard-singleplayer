import { workerScope, WorkerScope } from '../app/workerScope.js';
import { codePackEntries, readCodePackTransport } from './codePack.js';
/* Wildshard service worker (project/archive/2026-09-22-load-perf.md §1b / §P3, docs/design/cache-policy.md).
 * Ported from game-demos/trials-gauntlet-demo/src/pwa/sw.js — it shipped on WebKit/Metal; port, don't redesign.
 *
 * Written by `scripts/app-build/serviceWorker.ts` with three stamps replaced per build:
 *   __BUILD_ID__  `<vite.config BUILD_ID>-<content hash of every emitted file + the public/ list>`. A deploy
 *                 that changes bytes is a byte-different worker (the browser installs it); a rebuild of the
 *                 same tree is the SAME worker, so a rebuild does not throw the player's 70 MB away.
 *   __ASSET_ID__  a hash of the public/assets (+ basis, fonts) files' content alone (E160: it was list + sizes), so the
 *                 static cache survives a JS-only deploy, and any byte change names a new one.
 *   __BUNDLE__    the emitted /assets/<name>-<hash>.* paths of this build — the worker's only name for the
 *                 content-addressed set (gauntlet had load-manifest.json for this); `activate` PRUNES the immutable
 *                 cache to it. __INSTALL__ is its static entry graph plus CSS; only that subset blocks installation.
 *   __FONTS__     the self-hosted /fonts/*.woff2 — warmed after control (the first visit's CSS fetched them before
 *                 this worker controlled the page, so without this an offline launch had no type).
 *
 * OFFLINE (project/archive/2026-09-23-preload-offline.md): after one complete load the same shard boots and plays with the network off.
 * The shell + code + fonts are precached here; every file the loading bar declares (the shard's pack / files, the title
 * art, and ALL audio — every music style and every sound-effect set) passes through `cacheFirst` / `networkFirst` below
 * while the bar downloads it, so it is stored on that single download (nothing is fetched twice). A style / set switch in
 * the menu reads its files straight from Cache Storage (src/engine/audio/preload.ts cachedBytes).
 *
 * THREE caches, because they expire on three different clocks:
 *   ws-immutable            content-addressed, therefore forever: /assets/<name>-<8>.{js,css,jpg}. `activate`
 *                           prunes it to __BUNDLE__ — it never deletes it wholesale.
 *   ws-static-<assets>      unhashed but rarely edited: /assets/tex|models|hdri/**, /assets/gpu/** (KTX2, named by content
 *                           hash, E157), /assets/nalati/** (requested as
 *                           `?v=<content hash>`, src/engine/boot/bytes.ts versionedUrl, so an edit is a new key), /basis/**, /fonts/**, root
 *                           icons, and the music / sfx audio (the .m4a files under /assets/music and /assets/sfx, named
 *                           by content hash; downloaded by the loading bar and cached as they pass through here). Keyed
 *                           by a hash of public/ alone, so a JS-only deploy does NOT re-download
 *                           the 70 MB the boot streams. Cached on use — the boot fetches everything up front
 *                           anyway, and every one of those requests passes through `cacheFirst` below.
 *   ws-shell-<build>        the few KB that change every build: index.html, manifest.webmanifest,
 *                           asset-index.json.
 *
 *   install   precache the critical shell, then its static entry code and CSS, both strict: a failed shell, an index.html that
 *             names another build's code, or a code file the host no longer serves fails the install, so the old
 *             worker keeps serving (E144). Optional icons/fonts/index wait for control; everything only what is missing;
 *             hashed images on use. After control, warm lazy code serially at low priority, yielding to real reads.
 *   activate  claim immediately; no network, hashing or cache traversal may gate navigation (G837).
 *   GC        after page control, carry still-current static entries by content (E160 / E161), remove stale
 *             entries/caches and prune immutable code under one bounded background deadline.
 *   fetch     hashed bundle: cache-first into ws-immutable;
 *             `/assets/…?v=<content hash>` (src/engine/boot/bytes.ts versionedUrl, E160): cache-first into the static cache;
 *             tex / models / hdri / basis / fonts / icons / music + sfx audio: cache-first into the static cache;
 *             the music / sfx manifests (music.json, sfx.json) are compiled into the bundle and never fetched;
 *             offline (navigator.onLine false) network-first answers from the cache without trying the network;
 *             the document: cache-first with a background revalidate (a flapping link must never hold the
 *             first paint), including a `?v=` reload from the build pill (G837); a network copy is stored
 *             only when it is this build's own document (another build's would outlive its deploy);
 *             asset-index.json / sw.js / manifest.webmanifest: network-first, cache fallback;
 *             version.json: untouched (network-only — the build pill must see the server, not us);
 *             cross-origin (Google Fonts) and `?sw=0`: untouched.
 *   message   { type: 'SKIP_WAITING' } → activate now (src/engine/boot/sw.ts `adopt()`, wired to the build pill)
 *             { type: 'VERSION' }      → what this worker holds, back on the message port.
 *             { type: 'BUILD' }        → just { build }: cheap, so a page can tell whether a waiting worker is the build it
 *                                        already runs (src/engine/boot/sw.ts `announce()`, E95).
 *             { type: 'PREFETCH', url } → E158: that file into its cache unless it is there (src/engine/boot/shardPrefetch.ts, the
 *                                        other shards' boot files after playable); answers { type: 'PREFETCHED', status, bytes }.
 *             { type: 'STORE', url, blob } → a content-named file the page fetched before we controlled it (src/engine/boot/pack.ts).
 */
const BUILD = '__BUILD_ID__';
const ASSETS = '__ASSET_ID__';
/** @type {string[]} */
const BUNDLE = JSON.parse('__BUNDLE__');
/** Public title/select/grid/shardfile static closures only. Developer/legacy/
 * Explore/Sentry-only chunks remain in BUNDLE and cache on their first use. */
const WARM = JSON.parse('__WARM__');
/** @type {string[]} */
const INSTALL = JSON.parse('__INSTALL__');
/** @type {string[]} */
const FONTS = JSON.parse('__FONTS__');
/** Build-owned per-entry code transport. Unselected entries are never fetched. */
/** @type {{files: string[], entries: Record<string, readonly [string, number, number, readonly number[]]>}} */
const CODE_PACKS = JSON.parse('__CODE_PACKS__');
/** @type {Map<string, {work:Promise<string>, ports:Set<MessagePort>}>} */
const codePackJobs = new Map();
const cachePublications = new Map();
function publishCached(cache, key, response) {
  const url = typeof key === 'string' ? key : key.url;
  const work = cache.put(key, response).catch(() => undefined).finally(() => {
    if (cachePublications.get(url) === work) cachePublications.delete(url);
  });
  cachePublications.set(url, work);
}
const SHELL = `ws-shell-${BUILD}`;
const STATIC = `ws-static-${ASSETS}`;
const IMMUTABLE_CACHE = 'ws-immutable';
const CONTENT_CACHE = '__CONTENT_CACHE__', CONTENT_ROOT = '__CONTENT_ROOT__';
// Content-addressed author bytes and visited manifests have their own admission/quota policy, independent of a build.
const KEEP = [SHELL, STATIC, IMMUTABLE_CACHE, CONTENT_CACHE, '__PRODUCT_CACHE__'];
const SHARD_BLOB_RE = /^\/shardfiles\/[^/]+\/blobs\/(?:[^/]+\/)*([a-f0-9]{64})\.[a-z0-9]+$/;
let blobLimit = 6, blobActive = 0;
/** @type {{req:Request, resolve:(release:()=>void)=>void, reject:(reason:unknown)=>void, owner:WorkerScope}[]} */
const blobQueue = [];
function pumpBlobs() {
  while (blobActive < blobLimit && blobQueue.length > 0) {
    const ticket = blobQueue.shift();
    if (!ticket) break;
    ticket.owner.dispose(); blobActive++;
    let released = false;
    ticket.resolve(() => {
      if (released) return;
      released = true; blobActive--; pumpBlobs();
    });
  }
}
/** Hold a network slot through body completion, not just response headers.
 * @param {Request} req @returns {Promise<()=>void>} */
function reserveBlob(req) {
  return new Promise((resolve, reject) => {
    const owner = new WorkerScope();
    const ticket = { req, resolve, reject, owner };
    const abort = () => {
      const index = blobQueue.indexOf(ticket);
      if (index !== -1) blobQueue.splice(index, 1);
      const reason = req.signal.reason;
      owner.dispose(); reject(reason instanceof Error ? reason : new Error('Content download aborted', { cause: reason }));
    };
    if (req.signal.aborted) { abort(); return; }
    owner.listen(req.signal, 'abort', abort); blobQueue.push(ticket); pumpBlobs();
  });
}
/** E160: content names include packs, `<name>-<hash8>.<ext>` and `<sha256>.<ext>`.
 * scripts/app-build/assetHashes.ts contentNamed: keep in step. */
const CONTENT_NAMED_RE = /^\/assets\/packs\/|-[0-9a-f]{8}\.[a-z0-9]+$|\/[0-9a-f]{64}\.[a-z0-9]+$/;
const FONT_SET = new Set(FONTS);
/** what the last activate freed and kept (the VERSION reply and the console) */
const gc = { entries: 0, bytes: 0, caches: 0, kept: 0, migrated: 0, hashed: 0 };

/** Install fails without these: an incomplete shell must not pretend to be installed. */
const SHELL_CRITICAL = ['/index.html', '/manifest.webmanifest'];
/** Optional offline copies after control; never part of strict installation. */
const SHELL_OPTIONAL = ['/asset-index.json'];
const STATIC_OPTIONAL = ['/apple-touch-icon.png', '/favicon.png', '/icon-192.png', '/icon-512.png'];

/** Vite's hashed output sits directly under /assets/ — the unhashed Poly Haven dirs are one level deeper. */
const IMMUTABLE_RE = /^\/assets\/[^/]+-[\w-]{8}\.\w+$/;
const STATIC_RE = /^\/assets\/(tex|models|hdri|baked|packs|nalati|gpu|title)\/|^\/assets\/(music|sfx)\/.+\.m4a$|^\/basis\/|^\/fonts\/|^\/(apple-touch-icon|favicon|icon-\d+)\.png$/;
const NETWORK_FIRST_RE = /^\/(asset-index\.json|sw\.js|manifest\.webmanifest)$/;

const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif|svg)$/;

/** the device says it has no network: answer from the cache instead of a fetch that can only fail */
const offline = () => !self.navigator.onLine;

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

// Worker fetches own their transport: a page's synthetic response length cannot
// distinguish an HTTP-cache hit. Include install and revalidation downloads too.
const workerTransport = typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes.includes('resource');
if (workerTransport) {
  // Keep recent responses replayable across documents at the browser's existing
  // capacity. A full buffer otherwise retains old entries and drops the new
  // document's background revalidation before its message listener is ready.
  workerScope.listen(performance, 'resourcetimingbufferfull', () => { performance.clearResourceTimings(); });
  const observer = new PerformanceObserver((list) => {
    const timings = list.getEntries().filter((entry) => /^https?:/u.test(entry.name)).map((entry) => entry.toJSON());
    if (timings.length === 0) return;
    const receipt = { type: 'WS_WORKER_DOWNLOAD', origin: performance.timeOrigin, timings };
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage has no targetOrigin argument
      for (const client of clients) client.postMessage(receipt);
      return undefined;
    }).catch(() => undefined);
  });
  observer.observe({ type: 'resource' });
}

async function backgroundCache(cache, url) {
  const response = await fetchAttempt(abs(url));
  if (!response.ok) throw new Error(`precache: ${url} ${response.status}`);
  await cache.put(abs(url), response);
}

/**
 * `cache.add` only what is missing: a deploy must not spend the player's bytes re-fetching bytes it still has.
 * `strict`: a file that cannot be fetched rejects (the install fails) instead of being skipped.
 */
async function fillMissing(cache, urls, strict = false) {
  await Promise.all(urls.map(async (u) => {
    await cachePublications.get(abs(u));
    if (await cache.match(abs(u), MATCH_OPTS)) return;
    // the previous build's static cache still holds it (the icons, the fonts): a copy, not a download (E160 — an asset
    // deploy names a new static cache before `activate` carries the old one over, and install re-fetched ~0.5 MB here)
    const held = await caches.match(abs(u), MATCH_OPTS);
    if (held) { await cache.put(abs(u), held); return; }
    await (strict ? backgroundCache(cache, u) : backgroundCache(cache, u).catch(() => undefined));
  }));
}

const BUNDLE_SET = new Set(BUNDLE);
/** the hashed code a document names (its entry script, its stylesheet): `/assets/<name>-<hash>.js|css` */
const CODE_REF_RE = /\/assets\/[^/"'?#\s]+-[\w-]{8}\.(?:js|css)(?=["'?#\s<>\\)]|$)/g;

/**
 * The code files a document names that this worker's build does not hold: [] for this build's own index.html.
 * Such a document boots only while its own deploy is live on the host; kept in the shell it outlives that deploy
 * and freezes the loader (E144). An empty BUNDLE (the dev worker) has nothing to compare against: always [].
 * @param {Response} res
 */
async function foreignRefs(res) {
  if (BUNDLE.length === 0) return [];
  const refs = (await res.text()).match(CODE_REF_RE);
  return refs ? [...new Set(refs)].filter((p) => !BUNDLE_SET.has(p)) : [];
}

/**
 * Keep a network copy of the document in the shell only when it is this build's own (E144). Another build's copy
 * is still served (it is live, so its chunks are on the host right now) but never stored: that build arrives with
 * its own worker, and this nudges the browser to go and fetch it.
 */
async function putDocument(cache, key, res) {
  if (!res.ok) return;
  if ((await foreignRefs(res.clone())).length > 0) {
    self.registration.update().catch(() => undefined);
    return;
  }
  await cache.put(key, res);
}

workerScope.listen(self, 'install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const shell = await caches.open(SHELL);
        // The document must be THIS build's (E144). The host serves one deploy at a time and 404s every other deploy's
        // /assets (Vercel has no skew protection here), and deploys land minutes apart. A worker whose sw.js came from
        // deploy N but whose index.html or bundle was fetched after N+1 went live held a document it could not boot.
        // The pill adopted it, the reload ran the index chunk, and then `import(main)` 404'd: a loader frozen at
        // 00:00.0 and nothing else. A mismatch fails the install instead: the old worker keeps serving, and the next
        // update() fetches the live sw.js and tries again.
        const doc = await fetchAttempt(new Request(abs('/index.html'), { cache: 'no-store' }));
        if (!doc.ok) throw new Error(`install: /index.html ${doc.status}`);
        const foreign = await foreignRefs(doc.clone());
        if (foreign.length > 0) throw new Error(`install: /index.html is another build's (${foreign.join(', ')})`);
        await shell.put(abs('/index.html'), doc);
        await Promise.all(SHELL_CRITICAL.filter((p) => p !== '/index.html').map((p) => backgroundCache(shell, p))); // throws → install fails → the old worker keeps serving
        // The entry chunk was requested by the HTML before this worker controlled anything (a first visit), so
        // it never passed through `fetch` below; name it here or the second boot is not all-cache. Immutable on
        // the host, so this is served by the HTTP cache, not the network, when the page just fetched it.
        // Code and styles only: the hashed images (every shard's hero stills, portrait AND landscape, ~2 MB) are cached
        // by cacheFirst when the menu actually shows one — a phone never shows the landscape set (ask P5, cold bytes).
        // STRICT (E144): every static entry dependency and extracted stylesheet
        // must exist before this worker can serve its document. Lazy shard code
        // is verified on demand, then warmed after the title is usable.
        const shellPack = CODE_PACKS.entries.$shell;
        if (shellPack) await prepareWorkerCodePack(shellPack);
        await fillMissing(await caches.open(IMMUTABLE_CACHE), INSTALL, true);
      } catch (error) {
        // A rejected installer becomes redundant before a page can query it.
        // Report the original failure, then preserve that exact rejection.
        console.error('Service worker installation failed', error);
        try {
          const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const page of pages) {
            // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage has no targetOrigin parameter.
            page.postMessage({ type: 'WS_SW_INSTALL_ERROR', build: BUILD, error: String(error).slice(0, 2000) });
          }
        } catch { /* Diagnostics must never replace the original refusal. */ }
        throw error;
      }
    })(),
  );
});

let activationStage = 'waiting';
workerScope.listen(self, 'activate', (event) => {
  // Activation gates every fetch in every tab. Never put disk traversal,
  // hashing or a manifest download before this first claim.
  event.waitUntil(self.clients.claim().then(() => { activationStage = 'complete'; return undefined; }));
});

let gcWork = null, gcComplete = false;
function collectCaches() {
  if (gcComplete) return Promise.resolve({ type: 'GC', status: 'complete' });
  if (gcWork) return gcWork;
  const owner = new WorkerScope(), controller = new AbortController(), signal = controller.signal;
  const deadline = new Promise(resolve => {
    owner.timeout(30000, () => { controller.abort(); resolve('timed-out'); });
  });
  const run = async () => {
    const named = await assetManifest(signal);
    signal.throwIfAborted(); await migrateStatic(named, signal);
    signal.throwIfAborted(); await gcStatic(named, signal);
    for (const k of await caches.keys()) {
      signal.throwIfAborted();
      if (k.startsWith('ws-') && !KEEP.includes(k)) { gc.caches++; await caches.delete(k); }
    }
    signal.throwIfAborted(); await pruneImmutable(signal);
    signal.throwIfAborted(); gcComplete = true;
    return 'complete';
  };
  gcWork = Promise.race([run().catch(() => 'failed'), deadline])
    .then(status => ({ type: 'GC', status })).finally(() => { owner.dispose(); gcWork = null; });
  return gcWork;
}

/**
 * E160 / E161 — keep what the build names, by content; drop the rest.
 *
 * `/asset-manifest.json` (vite.config.ts, fetched no-store) is every file under public/assets with its content hash —
 * packs included. The page asks for an unhashed file as `<path>?v=<hash8>` (src/engine/boot/bytes.ts versionedUrl), so an entry's
 * KEY says which bytes it holds:
 *   `<path>?v=<h>`         current while the manifest still says h for that path;
 *   a content-named path   (a pack, `<name>-<hash8>.m4a`, CONTENT_NAMED_RE) current while the manifest lists it;
 *   an unhashed `<path>`   (an <img> or a worker asked without `?v=`, or a cache from before E160) current only when its
 *                          body hashes to the manifest's h — then it moves to `<path>?v=<h>`, the key the page asks for.
 * Before E160 the old cache's entries were carried over when their SIZE matched (a same-size edit or re-bake stayed
 * stale; the baked terrain was purged every deploy for that reason) and the packs, absent from asset-index.json, were
 * never carried over: every asset deploy re-downloaded every pack.
 */

/** path → hash8 of every file this build ships under public/assets, or null (offline at activate: verify nothing, drop nothing) */
async function assetManifest(signal) {
  try {
    const r = await fetchAttempt(new Request(abs('/asset-manifest.json'), { cache: 'no-store', signal }));
    if (r.ok) return await r.json();
  } catch { /* offline */ }
  return null;
}

async function hash8(res) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', await res.arrayBuffer()));
  return Array.from(d.subarray(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sizeOf(res) {
  const len = res.headers.get('content-length');
  return len ? Number(len) : (await res.clone().arrayBuffer()).byteLength;
}

/**
 * The verdict on one static entry: 'keep', 'drop', or the key it moves to (an unhashed entry whose bytes are current).
 * `fromOld`: it sits in a previous build's cache, whose unhashed entries prove nothing without their hash.
 */
async function verdict(req, res, named, fromOld) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (!p.startsWith('/assets/')) return p.startsWith('/fonts/') && !FONT_SET.has(p) ? 'drop' : 'keep'; // icons, fonts, basis
  const want = named[p];
  if (typeof want !== 'string') return 'drop'; // no longer shipped (an old pack, a removed file)
  const v = url.searchParams.get('v');
  if (v !== null) return v === want ? 'keep' : 'drop'; // an older version of the file
  if (CONTENT_NAMED_RE.test(p)) return 'keep';
  if (!fromOld) return 'keep'; // stored under this cache's name, and the name is the content of every asset: current
  gc.hashed++;
  return (await hash8(res.clone())) === want ? `${abs(p)}?v=${want}` : 'drop';
}

/** A new static cache name = some asset's bytes changed. Carry every entry of the old caches that is still current. */
async function migrateStatic(named, signal) {
  const old = (await caches.keys()).filter((k) => k.startsWith('ws-static-') && k !== STATIC);
  if (old.length === 0) return;
  const next = await caches.open(STATIC);
  for (const k of old) {
    signal.throwIfAborted();
    const prev = await caches.open(k);
    for (const req of await prev.keys()) {
      signal.throwIfAborted();
      try {
        const res = await prev.match(req, MATCH_OPTS);
        if (!res) continue;
        const to = named ? await verdict(req, res, named, true) : 'keep'; // offline: carry as is (verified next time)
        if (to === 'drop') { gc.entries++; gc.bytes += await sizeOf(res); continue; }
        // A verified plain URL still has live readers (the inline title hero).
        // Keep that alias in this content-named cache as well as its versioned
        // key, instead of downloading identical bytes on the next document.
        if (to !== 'keep' && !await next.match(req, MATCH_OPTS)) { signal.throwIfAborted(); await next.put(req, res.clone()); }
        const key = to === 'keep' ? req : to;
        if (await next.match(key, MATCH_OPTS)) continue;
        signal.throwIfAborted(); await next.put(key, res);
        gc.migrated++;
      } catch { /* one bad entry must not stop the migration */ }
    }
  }
}

/** Every entry of the current static cache the build no longer names: gone (a JS-only deploy prunes nothing it still ships). */
async function gcStatic(named, signal) {
  if (!named) return;
  const cache = await caches.open(STATIC);
  for (const req of await cache.keys()) {
    signal.throwIfAborted();
    try {
      const res = await cache.match(req, MATCH_OPTS);
      if (!res) continue;
      if ((await verdict(req, res, named, false)) === 'drop') { gc.entries++; gc.bytes += await sizeOf(res); signal.throwIfAborted(); await cache.delete(req, MATCH_OPTS); }
      else gc.kept++;
    } catch { /* keep what cannot be judged */ }
  }
}

/** Drop only the content-addressed entries this build no longer names. An empty bundle list → no prune (never a wipe). */
async function pruneImmutable(signal) {
  if (BUNDLE.length === 0) return;
  const names = new Set(BUNDLE.map((p) => new URL(p, self.registration.scope).pathname));
  const cache = await caches.open(IMMUTABLE_CACHE);
  for (const req of await cache.keys()) {
    signal.throwIfAborted();
    const p = new URL(req.url).pathname;
    if (IMMUTABLE_RE.test(p) && !names.has(p)) await cache.delete(req);
  }
}

let warming = null, warmAbort = null, foregroundAt = 0;
/** A title-ready page requests one low-priority code read at a time. A real
 * request aborts that speculative body before entering the foreground path. */
/** Warm the public entry closures (`WARM`, no images), or with `all` the whole bundle, images included: Settings'
 *  "Download everything" for offline play (G727 / iPhone downloads I9). */
async function warmBundle(all = false) {
  if (warming !== null) { await warming; if (!all) return; }
  const run = async () => {
    // The host sends WARM_CODE only after a real controllable frame. Fonts
    // needed earlier still use the ordinary cache-first fetch handler; copy
    // the complete optional offline set now, without rereading cache hits.
    await Promise.all([
      fillMissing(await caches.open(SHELL), SHELL_OPTIONAL),
      fillMissing(await caches.open(STATIC), [...STATIC_OPTIONAL, ...FONTS]),
    ]);
    const cache = await caches.open(IMMUTABLE_CACHE);
    for (const path of all ? BUNDLE : WARM.filter(p => !IMAGE_RE.test(p))) {
      if (await cache.match(abs(path), MATCH_OPTS)) continue;
      let complete = false;
      while (!complete) {
        while (Date.now() - foregroundAt < 500) await sleep(100);
        if (await cache.match(abs(path), MATCH_OPTS)) break;
        const controller = new AbortController(); warmAbort = controller;
        try {
          const response = await fetch(abs(path), { priority: 'low', signal: controller.signal });
          if (!response.ok) return; // Unavailable/offline code is never published as a successful warm.
          await cache.put(abs(path), response);
          complete = true;
        } catch {
          if (!controller.signal.aborted) return;
        } finally { if (warmAbort === controller) warmAbort = null; }
      }
    }
  };
  warming = run();
  try { await warming; } finally { warming = null; }
}

workerScope.listen(self, 'message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'WARM_CODE') event.waitUntil(warmBundle());
  else if (data.type === 'WARM_ALL_CODE') event.waitUntil(warmBundle(true));
  // A replacement document can start listening after install fetches finish.
  // Replay the browser's existing bounded timing buffer; live/replayed entries
  // share the same identity in the page accounting. Do not grow that buffer.
  else if (data.type === 'DOWNLOAD_RECEIPTS' && workerTransport) event.waitUntil(reply(event, Promise.resolve({
    type: 'WS_WORKER_DOWNLOAD', origin: performance.timeOrigin,
    timings: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
  })));
  else if (data.type === 'VERSION') event.waitUntil(reply(event, version()));
  else if (data.type === 'GC') { blobLimit = 2; event.waitUntil(reply(event, collectCaches())); }
  else if (data.type === 'BUILD') event.waitUntil(reply(event, Promise.resolve({ type: 'BUILD', build: BUILD, activationStage })));
  else if (data.type === 'PREFETCH' && typeof data.url === 'string') event.waitUntil(reply(event, prefetchOne(data.url)));
  else if (data.type === 'STORE' && typeof data.url === 'string' && data.blob instanceof Blob) event.waitUntil(reply(event, storeOne(data.url, data.blob)));
  else if (data.type === 'PREPARE_CODE_PACK' && typeof data.url === 'string') {
    const port = event.ports?.[0];
    const declared = Object.values(CODE_PACKS.entries).find(row => Array.isArray(row) && row[0] === data.url && row[1] === data.bytes && row[2] === data.decoded);
    if (!declared || !port) { if (port) port.postMessage({ type: 'CODE_PACK_DONE', status: 'unsupported' }); return; }
    port.postMessage({ type: 'CODE_PACK_STARTED' });
    let job = codePackJobs.get(data.url);
    if (!job) {
      const ports = new Set([port]);
      const work = prepareWorkerCodePack(declared, loaded => {
        for (const listener of ports) {
          // oxlint-disable-next-line unicorn/require-post-message-target-origin -- MessagePort.postMessage has no targetOrigin parameter.
          listener.postMessage({ type: 'CODE_PACK_PROGRESS', url: data.url, loaded, total: declared[1] });
        }
      }).finally(() => { codePackJobs.delete(data.url); });
      job = { work, ports }; codePackJobs.set(data.url, job);
    } else job.ports.add(port);
    const current = job;
    event.waitUntil(current.work.then(status => {
      current.ports.delete(port); port.postMessage({ type: 'CODE_PACK_DONE', status }); return status;
    }));
  }
});

/** Whole, authenticated code only; failed storage/transport keeps the original
 * complete per-module retry path. Never publish a partial/corrupt pack body.
 * @param {readonly [string, number, number, readonly number[]]} row
 * @param {(loaded:number)=>void} [progress] */
async function prepareWorkerCodePack(row, progress) {
  try {
    const [url, bytes, decoded, members] = row, cache = await caches.open(IMMUTABLE_CACHE);
    const paths = members.map(index => CODE_PACKS.files[index]);
    if (paths.some(path => typeof path !== 'string' || !BUNDLE.includes(path))) throw new Error('Invalid code pack registry');
    let complete = true;
    for (const path of paths) if (!await cache.match(abs(path), MATCH_OPTS)) { complete = false; break; }
    if (complete) return 'hit';
    const response = await fetchAttempt(abs(url));
    if (!response.ok) throw new Error('Failed code pack transport');
    const hash = /\/([a-f0-9]{64})\.pack$/.exec(url)?.[1];
    if (hash === undefined) throw new Error('Invalid code pack address');
    const entries = await codePackEntries(await readCodePackTransport(response, bytes, progress), [bytes, decoded, hash], new Set(paths));
    if (entries.length !== paths.length) throw new Error('Incomplete code pack registry');
    for (let index = 0; index < entries.length; index += 4) {
      await Promise.all(entries.slice(index, index + 4).map(([path, value]) => cache.put(abs(path), new Response(value, {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'content-length': String(value.byteLength) },
      }))));
    }
    return 'stored';
  } catch { return 'failed'; }
}

/**
 * E158: a content-named file the page downloaded BEFORE this worker controlled it (a first visit on a slow link: the boot
 * waits ≤ 2.5 s for the claim, then streams its pack past us). Without this the pack was never in the cache: the next
 * launch fetched all of it again (the bench's Pine Hollow 4g/warm row: 18 MB net) and an offline launch had no world.
 * The page hands over the bytes it already holds (src/engine/boot/pack.ts), so nothing is downloaded twice. Content-named paths
 * only: the name is the proof of the bytes.
 * @param {string} u
 * @param {Blob} blob
 */
async function storeOne(u, blob) {
  const url = new URL(u, self.registration.scope);
  const out = (status, bytes = 0) => ({ type: 'STORED', status, bytes });
  if (SHARD_BLOB_RE.test(url.pathname)) return out('failed'); // Only the verified content owner may persist these bodies.
  if (url.origin !== self.location.origin || !CONTENT_NAMED_RE.test(url.pathname)) return out('failed');
  const cache = await caches.open(cacheFor(url.pathname));
  if (await cache.match(url.href, MATCH_OPTS)) return out('hit');
  await cache.put(url.href, new Response(blob, { headers: { 'content-type': blob.type || 'application/octet-stream', 'content-length': String(blob.size) } }));
  return out('stored', blob.size);
}

/**
 * E158: one file of another shard's boot (src/engine/boot/shardPrefetch.ts), into the cache its request would be served from.
 * Already there → 'hit' (nothing fetched: a later session resumes where this one stopped). Fetched at low priority and
 * stored whole before the reply, so the page's "done" means on disk. `bytes` = the body stored.
 * @param {string} u
 */
async function prefetchOne(u) {
  const url = new URL(u, self.registration.scope);
  const out = (status, bytes = 0) => ({ type: 'PREFETCHED', status, bytes });
  if (url.origin !== self.location.origin) return out('failed');
  const blobHash = SHARD_BLOB_RE.exec(url.pathname)?.[1];
  if (blobHash !== undefined) {
    const cache = await caches.open(CONTENT_CACHE);
    return out(await cache.match(new URL(blobHash, abs(CONTENT_ROOT)).href, MATCH_OPTS) ? 'hit' : 'failed');
  }
  const cache = await caches.open(cacheFor(url.pathname));
  if (await cache.match(url.href, MATCH_OPTS)) return out('hit');
  try {
    const res = await fetch(url.href, { priority: 'low' });
    if (!res.ok || !res.body) return out('failed');
    let bytes = 0;
    const [keep, count] = res.body.tee();
    const counted = (async () => { const r = count.getReader(); for (;;) { const { done, value } = await r.read(); if (done) return; bytes += value.byteLength; } })();
    await cache.put(url.href, new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers }));
    await counted;
    return out('stored', bytes);
  } catch {
    return out('failed');
  }
}

async function reply(event, work) {
  const payload = await work.catch((e) => ({ type: 'VERSION', error: String(e) }));
  const port = event.ports?.[0];
  if (port) port.postMessage(payload);
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage(message, transfer) has no targetOrigin; a '*' here would be a bad transfer list
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
  return { type: 'VERSION', build: BUILD, assets: ASSETS, caches: perCache, entries, bytes, gc };
}

workerScope.listen(self, 'fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google Fonts: untouched
  foregroundAt = Date.now();
  warmAbort?.abort();
  if (url.searchParams.get('sw') === '0') return; // the bench measures the network, not the cache
  if (url.pathname === '/version.json') return; // network-only: the build pill must see the server
  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  if (isDoc) {
    blobLimit = 6; pumpBlobs();
    event.respondWith(documentResponse(event, req));
    return;
  }
  if (NETWORK_FIRST_RE.test(url.pathname)) {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  const blobHash = SHARD_BLOB_RE.exec(url.pathname)?.[1];
  if (blobHash !== undefined) {
    event.respondWith(shardBlob(req, blobHash));
    return;
  }
  // Module imports use destination script, including unversioned entry/helper URLs.
  // Buffer and retry the network body before WebKit caches a failed module response.
  if (req.destination === 'script') {
    event.respondWith(cacheFirst(req, cacheFor(url.pathname)));
    return;
  }
  if (url.pathname.startsWith('/assets/') && url.searchParams.has('v')) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (url.pathname.startsWith('/assets/') && CONTENT_NAMED_RE.test(url.pathname)) {
    // Content-addressed files stay immutable even under the legacy baked prefix.
    // Mutable, unversioned bakes still take the network-first branch below.
    event.respondWith(cacheFirst(req, cacheFor(url.pathname)));
    return;
  }
  if (url.pathname.startsWith('/assets/baked/')) { // unversioned: fresh bake first, cache only as the offline fallback
    event.respondWith(networkFirst(req, STATIC));
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
 * worker installing and the build pill adopting it (src/engine/boot/sw.ts), never by this revalidate. G837:
 * even an explicit reload serves this worker's already verified shell immediately; network revalidation
 * must not hold the replacement document's first paint.
 */
async function documentResponse(event, req) {
  const cache = await caches.open(SHELL);
  const key = abs('/index.html');
  const hit = await cache.match(key, MATCH_OPTS);
  if (hit) {
    if (offline()) return transportReceipt(hit, true); // no revalidate that can only fail
    event.waitUntil(
      fetchAttempt(req)
        .then((res) => putDocument(cache, key, res))
        .catch(() => undefined),
    );
    return transportReceipt(hit, true);
  }
  const res = await fetchAttempt(req, { stallMs: 3000, deadlineMs: 3000 });
  putDocument(cache, key, res.clone()).catch(() => undefined);
  return transportReceipt(res);
}

// A flapping radio may never reject a request or finish its body. Bound each
// headers/body stall before committing a response to the page. Byte progress
// renews the stall clock, so a large healthy download keeps its original bytes.
// A fresh request can then bypass a stuck HTTP-cache transaction.
const FETCH_ATTEMPT_MS = 10000;
class WorkerFetchStallError extends Error {
  constructor(url) { super(`Service worker fetch stalled: ${url}`); this.name = 'WorkerFetchStallError'; }
}
/** Only executable/style resources need E188's complete-body retry barrier. */
function wholeCode(req) {
  return req.destination === 'script' || req.destination === 'style' || /\.(?:m?js|css)$/.test(new URL(req.url).pathname);
}
/** @param {Request|string} input @param {{stallMs?:number, deadlineMs?:number, onFinish?:()=>void}} [options] @returns {Promise<Response>} */
async function fetchAttempt(input, { stallMs = FETCH_ATTEMPT_MS, deadlineMs, onFinish } = {}) {
  const req = typeof input === 'string' ? new Request(input) : input;
  const owner = new WorkerScope(), controller = new AbortController();
  let watch = new WorkerScope(), reset = () => undefined;
  /** @type {ReadableStreamDefaultReader<Uint8Array>|undefined} */ let reader;
  /** @type {ReadableStreamDefaultController<Uint8Array>|undefined} */ let output;
  let transferred = false, ended = false;
  const cleanup = () => { if (ended) return; ended = true; owner.dispose(); watch.dispose(); onFinish?.(); };
  const cancelBody = () => { if (reader) void reader.cancel().catch(() => undefined); };
  /** @type {Promise<never>} */
  const deadline = new Promise((_resolve, reject) => {
    /** @param {Error} error */
    const fail = error => {
      reject(error); controller.abort(error);
      if (output) output.error(error);
      cancelBody(); cleanup();
    };
    const abort = () => {
      const reason = req.signal.reason;
      fail(reason instanceof Error ? reason : new Error('Worker fetch aborted', { cause: reason }));
    };
    owner.listen(req.signal, 'abort', abort);
    if (req.signal.aborted) { abort(); return; }
    const expire = () => { fail(new WorkerFetchStallError(req.url)); };
    if (deadlineMs !== undefined) owner.timeout(deadlineMs, expire);
    reset = () => {
      watch.dispose(); watch = new WorkerScope(); watch.timeout(stallMs, expire);
    };
    reset();
  });
  try {
    const res = await Promise.race([fetch(input, { signal: controller.signal }), deadline]);
    if (res.body === null) return res;
    reset(); reader = res.body.getReader();
    if (!wholeCode(req)) {
      const stream = new ReadableStream({
        start(target) { output = target; },
        async pull(target) {
          try {
            const part = await Promise.race([reader.read(), deadline]);
            if (part.done) { target.close(); reader.releaseLock(); cleanup(); }
            else { if (part.value.byteLength > 0) reset(); target.enqueue(part.value); }
          } catch (error) { target.error(error); cancelBody(); cleanup(); }
        },
        cancel(reason) { controller.abort(reason); cancelBody(); cleanup(); },
      });
      transferred = true;
      return new Response(stream, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    /** @type {Uint8Array[]} */ const chunks = [];
    try {
      for (;;) {
        const part = await Promise.race([reader.read(), deadline]);
        if (part.done) break;
        if (part.value.byteLength > 0) { chunks.push(part.value); reset(); }
      }
    } finally { reader.releaseLock(); }
    return new Response(new Blob(chunks), { status: res.status, statusText: res.statusText, headers: res.headers });
  } finally { if (!transferred) cleanup(); }
}

function sleep(ms) { return new Promise((resolve) => { workerScope.timeout(ms, resolve); }); }

/** Report provenance through Resource Timing, without reading or copying the response body. */
function transportReceipt(response, cached = false) {
  const headers = new Headers(response.headers);
  const previous = headers.get('server-timing');
  const bytes = Number(headers.get('content-length')) || 0;
  headers.set('server-timing', `${previous ? `${previous},` : ''}${cached ? 'ws-cache' : 'ws-network'};dur=${bytes}${!cached && workerTransport ? ',ws-receipt' : ''}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** ContentCache alone authenticates, indexes and stores these bodies. The
 * worker only reads that same cache; a miss must not create a second static
 * copy or bypass the content owner's quota/LRU. Legacy Range readers retain
 * their original network response and complete-member verification. */
async function shardBlob(req, hash) {
  if (!req.headers.has('range')) {
    try {
      const cache = await caches.open(CONTENT_CACHE);
      const hit = await cache.match(new URL(hash, abs(CONTENT_ROOT)).href, MATCH_OPTS);
      if (hit) return transportReceipt(hit, true);
    } catch { /* Storage denial keeps the original verified online reader. */ }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const release = await reserveBlob(req);
    try {
      return transportReceipt(await fetchAttempt(attempt === 0 ? req : new Request(req, { cache: 'reload' }), { onFinish: release }));
    } catch (error) {
      release();
      if (!(error instanceof WorkerFetchStallError) || req.signal.aborted || attempt > 0) throw error;
    }
  }
  throw new Error('Unreachable content download');
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, MATCH_OPTS);
  if (hit) return transportReceipt(hit, true);
  // Older boot tables added ?v even to SHA-256 basenames. The same exact
  // content can now use its plain URL, including immediately after an offline
  // update. Match only its own hash prefix; never ignore arbitrary queries.
  const url = new URL(req.url);
  if (name === STATIC && (CONTENT_NAMED_RE.test(url.pathname) || url.searchParams.has('v'))) {
    const previous = await caches.match(req, MATCH_OPTS);
    if (previous) return transportReceipt(previous, true);
  }
  const namedHash = /\/([0-9a-f]{64})\.[a-z0-9]+$/.exec(url.pathname)?.[1];
  if (name === STATIC && url.pathname.startsWith('/assets/') && url.search === '' && namedHash !== undefined) {
    const held = await caches.match(`${abs(url.pathname)}?v=${namedHash.slice(0, 8)}`, MATCH_OPTS);
    if (held) {
      await cache.put(req, held.clone()).catch(() => undefined);
      return transportReceipt(held, true);
    }
  }
  return wholeCode(req) ? fetchWhole(req, cache) : networkFirst(req, name);
}

/**
 * E188: a code file is read WHOLE here before the page gets a byte of it, and a download that breaks is tried twice
 * more, 0.7 s and 2 s later. On LTE a hand-over drops the ~1.1 MB main chunk mid-file: the headers had already said
 * 200, so streaming it through let the page's module import fail outright ("Importing a module script failed" — the
 * stuck card, whose RELOAD met the same radio). Reading the body first turns that into a throw we can retry. The
 * retries go around the HTTP cache (`cache: 'reload'`): /assets/* is `immutable` on every response the host sends,
 * its 404s included, so a failure the browser kept must never be replayed as the answer. A real 404 (a deploy moved
 * on) surfaces 2.7 s later than before, and stuck.ts handles it as it always did. Only a whole body is stored.
 */
async function fetchWhole(req, cache) {
  let attempt = req;
  for (const wait of [700, 2000, 0]) {
    const last = wait === 0;
    try {
      const res = await fetchAttempt(attempt);
      if (!res.ok && !last) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return res;
      const whole = res;
      // A first-use chunk can be requested offline as soon as its import
      // completes. Finish this publication attempt before returning its bytes;
      // a detached write raced that next request and could outlive the worker.
      // Quota/storage failure still serves the complete online response.
      await cache.put(req, whole.clone()).catch(() => undefined);
      return transportReceipt(whole);
    } catch (e) {
      if (last) throw e;
      await sleep(wait);
      attempt = new Request(req, { cache: 'reload' });
    }
  }
  throw new Error('unreachable');
}

/**
 * @param {string} [key] store/match under this URL instead of the request's own (the document's `?v=` reload)
 * @param {boolean} [doc] the document: stored only when it is this build's own (putDocument, E144)
 */
async function networkFirst(req, name, key, doc = false) {
  const cache = await caches.open(name);
  if (offline()) {
    const hit = await cache.match(key ?? req, MATCH_OPTS);
    if (hit) return transportReceipt(hit, true);
  }
  try {
    const res = await fetchAttempt(req);
    if (doc) putDocument(cache, key ?? req, res.clone()).catch(() => undefined);
    else if (res.ok) publishCached(cache, key ?? req, res.clone());
    return transportReceipt(res);
  } catch (e) {
    const hit = await cache.match(key ?? req, MATCH_OPTS);
    if (hit) return transportReceipt(hit, true);
    if (!(e instanceof WorkerFetchStallError) || req.signal.aborted) throw e;
    const res = await fetchAttempt(new Request(req, { cache: 'reload' }));
    if (doc) putDocument(cache, key ?? req, res.clone()).catch(() => undefined);
    else if (res.ok) publishCached(cache, key ?? req, res.clone());
    return transportReceipt(res);
  }
}

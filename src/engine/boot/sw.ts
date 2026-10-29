import { pageScope } from '../app/resources';
import { receiveWorkerDownloads } from './download';
/**
 * Service-worker boot (project/archive/2026-09-22-load-perf.md §1b / §P3). Ported from trials-gauntlet-demo's `swBoot`,
 * with the update story changed for this game — see CONTRACT below.
 *
 * Loaded as its own `<script type="module">` in index.html, ahead of main.ts, so the worker is registered
 * at the very first line of boot. Two jobs, both before the first big fetch:
 *
 *  1. **Be in control before the boot asks for 70 MB.** A worker only sees requests from pages it controls,
 *     and a first visit is not controlled until install → activate → `clients.claim()` land. Registering here
 *     and waiting (briefly, capped at CAP_MS, never fatal) for `controllerchange` means every byte the boot
 *     streams passes through the worker's `cacheFirst`, so the second boot is all cache. main.ts should
 *     `await window.__ws_sw?.ready` before its first asset fetch to get that guarantee; without it the first
 *     few requests race the claim and are cached on the next visit instead.
 *
 *  2. **Install in the background; adopt only at travel or the title.** A waiting worker is announced
 *     without replacing gameplay. Update.ts handles the visible title boundary; travel waits at most one second
 *     for a claim before its ordinary fresh-page navigation.
 *
 * CONTRACT — `window.__ws_sw` (also the module's exports):
 *
 *   ready: Promise<void>        resolves when the worker controls this page, or after CAP_MS, or at once when
 *                               service workers are off (`?sw=0`, dev without `?sw=1`, no SW support).
 *   waiting: ServiceWorker|null a newer build is installed and waiting to activate; null otherwise.
 *   activate(): Promise<boolean> claim an installed update at a natural boundary, at most 1 s; never navigates.
 *   adopt(to?): Promise<boolean> explicit recovery: claim, then reload/replace once; true if sent.
 *                               False means unavailable or expired; recovery retains its ordinary fallback.
 *   version(): Promise<SwVersion|null>  what the controlling worker holds ({ build, entries, bytes, caches }),
 *                               null when nothing controls the page.
 *
 *   window event `ws-sw-waiting` (CustomEvent<{ waiting: ServiceWorker }>) fires whenever a newer worker
 *   reaches `installed` while this page is controlled — the pill listens and lights up.
 *
 * Opt-outs: `?sw=0` unregisters any worker and registers none (the bench measures the network). In dev the
 * worker is only registered with `?sw=1` (a stale worker would serve yesterday's bundle over HMR).
 */

import { markReload } from './lastEnd'; // E179: the page's "why did it reload" record — imported first, so its beat is the page's

declare const __BUILD_ID__: string;

/** The longest boot waits for the worker to take control, or for a hand-over to a new build. */
const CAP_MS = 2500;
/** Natural navigation must not wait for installation or a stalled activation. */
const BOUNDARY_MS = 1000;

export interface SwVersion {
  type: 'VERSION';
  build: string;
  assets: string;
  entries: number;
  bytes: number;
  caches: Record<string, { entries: number; bytes: number }>;
  error?: string;
}

export interface WsSw {
  ready: Promise<void>;
  /** Explicit network-only opt-outs also disable optional code transports. */
  readonly enabled?: boolean;
  waiting: ServiceWorker | null;
  /** Claim an already-installed update before a natural navigation; never navigates itself. */
  activate: () => Promise<boolean>;
  /** `why`: what asked for it, recorded for the next boot (src/engine/boot/lastEnd.ts) */
  adopt: (to?: string, why?: string) => Promise<boolean>;
  version: () => Promise<SwVersion | null>;
}

// the page's service-worker handle is declared in ./swGlobal.d.ts (an ambient file every layer's project sees)

const sw = typeof navigator === 'undefined' ? null : navigator.serviceWorker;
function replayDownloads(): void {
  // The worker may have completed install requests while this document was
  // navigating. Its existing timing buffer preserves those early receipts.
  sw?.controller?.postMessage({ type: 'DOWNLOAD_RECEIPTS' });
}
if (sw !== null) {
  pageScope.listen(sw, 'message', event => { receiveWorkerDownloads(event.data, performance.timeOrigin); });
  pageScope.listen(sw, 'controllerchange', replayDownloads);
  replayDownloads();
}

let pageReady = false, controlsReady = false, sameBuild: ServiceWorker | null = null;
let gcController: ServiceWorker | null = null;
function activateSameBuild(): void {
  const candidate = sameBuild; sameBuild = null;
  if (candidate?.state === 'installed') {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter.
    candidate.postMessage({ type: 'SKIP_WAITING' });
  }
}
function warmCode(): void {
  if (!swAllowed()) return;
  const controller = sw?.controller;
  if (controlsReady && controller && controller !== gcController) {
    gcController = controller;
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter.
    controller.postMessage({ type: 'GC' });
  }
  if (pageReady && controlsReady) {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter.
    controller?.postMessage({ type: 'WARM_CODE' });
  }
}
if (sw !== null) {
  pageScope.listen(window, 'pagehide', activateSameBuild);
  pageScope.listen(document, 'ws:ready', () => { pageReady = true; warmCode(); });
  pageScope.listen(document, 'ws:control-ready', () => { controlsReady = true; warmCode(); });
  pageScope.listen(sw, 'controllerchange', warmCode);
}

// declared ahead of the functions that read it (they only run after registration; `boot()` is hoisted)
const api: WsSw = { ready: boot(), enabled: swAllowed(), waiting: null, activate: () => activateWaiting(BOUNDARY_MS), adopt, version };

function swAllowed(): boolean {
  if (!sw) return false;
  if (/[?&]sw=0(&|$)/.test(location.search)) return false;
  if (import.meta.env.DEV && !/[?&]sw=1(&|$)/.test(location.search)) return false;
  return true;
}

/**
 * Announce a completed background install. Same-build replacements wait for
 * pagehide/travel too; even a usable title/control signal is not a claim.
 */
function announce(w: ServiceWorker): void {
  void (async () => {
    const build = await buildOf(w);
    if (w.state === 'redundant') return;
    if (build?.startsWith(`${__BUILD_ID__}-`) === true) {
      // Keep even a same-build replacement waiting until the document leaves.
      // A usable title/control signal is still the middle of this session.
      sameBuild = w;
      warmCode();
      return;
    }
    api.waiting = w;
    window.dispatchEvent(new CustomEvent('ws-sw-waiting', { detail: { waiting: w } }));
  })();
}

/** The build a worker holds (`<BUILD_ID>-<content hash>`, src/engine/pwa/sw.js), or null if it does not answer in time. */
function buildOf(w: ServiceWorker): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const ch = new MessageChannel();
    const finish = (build: string | null): void => { ch.port1.close(); ch.port2.close(); resolve(build); };
    const timer = pageScope.timeout(CAP_MS, () => { finish(null); });
    ch.port1.onmessage = (e: MessageEvent<{ build?: unknown }>) => {
      pageScope.cancelTimer(timer);
      finish(typeof e.data.build === 'string' ? e.data.build : null);
    };
    w.postMessage({ type: 'BUILD' }, [ch.port2]);
  });
}

function watch(reg: ServiceWorkerRegistration): void {
  const track = (w: ServiceWorker | null): void => {
    if (!w) return;
    if (w.state === 'installed') { announce(w); return; }
    pageScope.listen(w, 'statechange', () => {
      if (w.state === 'installed' && sw?.controller) announce(w);
    });
  };
  if (reg.waiting) announce(reg.waiting);
  track(reg.installing);
  pageScope.listen(reg, 'updatefound', () => track(reg.installing));
}

/** `to`: where the page goes once the new worker controls it (default: reload this URL) */
async function adopt(to?: string, why = 'new build adopted'): Promise<boolean> {
  if (!await activateWaiting(CAP_MS)) return false;
  markReload(`${why}: the new service worker took over`);
  if (to === undefined) location.reload();
  else location.replace(to);
  return true;
}

/** Only a completed install participates. A late claim cannot navigate an expired caller. */
function activateWaiting(limit: number): Promise<boolean> {
  const w = api.waiting ?? sameBuild;
  // An announcement can outlive its worker (another tab already adopted it,
  // or a later install replaced it). None of those states needs a hand-over.
  if (!sw || !w || pageScope.disposed || pageScope.disposing || sw.controller === w
    || (w.state !== 'installed' && w.state !== 'activating')) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const attempt = pageScope.child('worker-adoption');
    const finish = (claimed: boolean): void => { resolve(claimed); attempt.dispose(); };
    attempt.onDispose(() => { resolve(false); });
    attempt.timeout(limit, () => { finish(false); });
    attempt.listen(sw, 'controllerchange', () => {
      if (sw.controller !== w) return;
      if (api.waiting === w) api.waiting = null;
      if (sameBuild === w) sameBuild = null;
      finish(true);
    });
    attempt.listen(w, 'statechange', () => {
      if (w.state === 'redundant') { finish(false); }
    });
    try {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter (that is Window.postMessage)
      w.postMessage({ type: 'SKIP_WAITING' });
    } catch { finish(false); } // the ordinary document navigation remains available
  });
}

function version(): Promise<SwVersion | null> {
  const ctl = sw?.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise<SwVersion | null>((resolve) => {
    const ch = new MessageChannel();
    const timer = pageScope.timeout(CAP_MS, () => resolve(null));
    ch.port1.onmessage = (e: MessageEvent<SwVersion>) => {
      pageScope.cancelTimer(timer);
      resolve(e.data);
    };
    ctl.postMessage({ type: 'VERSION' }, [ch.port2]);
  });
}

/** A stale chunk may reload only after the matching new worker owns its next document.
 * Discovery, install and claim share one bound; late installers cannot navigate. */
export function refreshWorkerForChunkRecovery(build: string, allowed: () => boolean = () => true): Promise<boolean> {
  if (!allowed()) return Promise.resolve(false);
  if (!sw || !swAllowed() || sw.controller === null) return Promise.resolve(true);
  const container = sw;
  return new Promise<boolean>(resolve => {
    const owner = pageScope.child('stale-chunk-worker'), tracked = new Set<ServiceWorker>();
    const finish = (ready: boolean): void => { resolve(ready); owner.dispose(); };
    owner.onDispose(() => { resolve(false); }); owner.timeout(15000, () => { finish(false); });
    const track = (worker: ServiceWorker | null): void => {
      if (worker === null || owner.disposed || tracked.has(worker)) return;
      tracked.add(worker);
      const claim = async (): Promise<void> => {
        if (worker.state !== 'installed' || owner.disposed) return;
        const identity = await buildOf(worker);
        if (owner.disposed || identity?.startsWith(`${build}-`) !== true) return;
        if (!allowed()) { finish(false); return; }
        owner.listen(container, 'controllerchange', () => { if (container.controller === worker) finish(true); });
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker messages have no targetOrigin.
        worker.postMessage({ type: 'SKIP_WAITING' });
      };
      owner.listen(worker, 'statechange', () => { void claim().catch(() => { finish(false); }); });
      void claim().catch(() => { finish(false); });
    };
    void container.getRegistration().then(async registration => {
      if (owner.disposed) return undefined;
      if (registration === undefined) { finish(true); return undefined; }
      const active = container.controller;
      if (active !== null && (await buildOf(active))?.startsWith(`${build}-`) === true) { finish(allowed()); return undefined; }
      const observe = (): void => { track(registration.installing ?? registration.waiting); };
      owner.listen(registration, 'updatefound', observe);
      observe(); await registration.update(); observe(); return undefined;
    }).catch(() => { finish(false); });
  });
}

function boot(): Promise<void> {
  if (!sw || !swAllowed()) {
    // `?sw=0` / dev: make sure no earlier worker keeps serving a stale bundle underneath us.
    void sw?.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))).catch(() => undefined);
    return Promise.resolve();
  }
  const s = sw;
  return new Promise<void>((resolve) => {
    const timer = pageScope.timeout(CAP_MS, resolve);
    const settle = (): void => {
      pageScope.cancelTimer(timer);
      resolve();
    };
    // A controlling worker already owns this document's fetches. Registration
    // still discovers updates, but its network/update check cannot gate boot.
    if (s.controller) settle();
    void register(s, settle);
  });
}

async function register(s: ServiceWorkerContainer, settle: () => void): Promise<void> {
  const url = import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js';
  let reg: ServiceWorkerRegistration;
  // The host's no-cache still revalidates every update. Consult its ETag:
  // WebKit's default imports mode bypasses that conditional HTTP cache.
  try { reg = await s.register(url, { scope: '/', updateViaCache: 'all' }); } catch { settle(); return; }
  // A host that blocks worker installation can resolve without a registration.
  // Treat that as unavailable support, just like a rejected registration.
  if (reg === undefined) { settle(); return; }
  watch(reg);
  // Standalone installs live for days: keep discovering updates so the pill can offer them.
  pageScope.listen(document, 'visibilitychange', () => {
    if (!document.hidden) void reg.update().catch(() => undefined);
  });
  // First visit (or an evicted worker): wait for `clients.claim()`, so the boot's own bytes are cached.
  if (!s.controller) pageScope.listen(s, 'controllerchange', settle, { once: true });
  else settle();
}

if (typeof window !== 'undefined') window.__ws_sw = api;

export { adopt as swAdopt, version as swVersion, api as wsSw };

import { pageScope } from '../app/resources';
/**
 * Service-worker boot (project/archive/2026-09-22-load-perf.md §1b / §P3). Ported from trials-gauntlet-demo's `swBoot`,
 * with the update story changed for this game — see CONTRACT below.
 *
 * Loaded as its own `<script type="module">` in index.html, ahead of main.ts, so the worker is registered
 * at the very first line of boot. Two jobs, both before the first big fetch:
 *
 *  1. A controlled document registers at once (update discovery) and is ready immediately. A first visit's
 *     install precaches the whole build (~330 files, ~20 MB), so an uncontrolled document is ready at once and
 *     registers only when its world first has control (`ws:control-ready`): the title tap and the boot's own
 *     downloads never wait on or race that install (MF21: waiting for first activation took the phone profile's
 *     cold tap from 0.1 s to 30.9 s). No document is ever claimed; the next visit is the first controlled one.
 *
 *  2. Announce updates without replacing gameplay. Adoption is explicit on the
 *     title or a fresh document; a running world never changes its controller.
 *
 * CONTRACT — `window.__ws_sw` (also the module's exports):
 *
 *   ready: Promise<void>        resolves at once: a controlled document, an uncontrolled one (it registers at control), or
 *                               service workers off (`?sw=0`, dev without `?sw=1`, no SW support).
 *   waiting: ServiceWorker|null a newer build is installed and waiting to activate; null otherwise.
 *   activate(): Promise<boolean> activate an installed update at a natural boundary; never navigates.
 *   adopt(to?): Promise<boolean> explicit recovery: activate, then reload/replace once; true if sent.
 *                               False means unavailable or retired; recovery retains its ordinary fallback.
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



export interface SwVersion {
  type: 'VERSION';
  build: string;
  assets?: string;
  entries?: number;
  bytes?: number;
  caches?: Record<string, { entries: number; bytes: number }>;
  error?: string;
}

export interface WsSw {
  ready: Promise<void>;
  /** Explicit network-only opt-outs also disable optional code transports. */
  readonly enabled?: boolean;
  waiting: ServiceWorker | null;
  /** Activate an already-installed update before a natural navigation; never navigates itself. */
  activate: () => Promise<boolean>;
  /** `why`: what asked for it, recorded for the next boot (src/engine/boot/lastEnd.ts) */
  adopt: (to?: string, why?: string) => Promise<boolean>;
  version: () => Promise<SwVersion | null>;
}

// the page's service-worker handle is declared in ./swGlobal.d.ts (an ambient file every layer's project sees)

const sw = typeof navigator === 'undefined' ? null : navigator.serviceWorker;
// declared ahead of the functions that read it (they only run after registration; `boot()` is hoisted)
const api: WsSw = { ready: boot(), enabled: swAllowed(), waiting: null, activate: () => activateWaiting(), adopt, version };

function swAllowed(): boolean {
  if (!sw) return false;
  if (/[?&]sw=0(&|$)/.test(location.search)) return false;
  if (import.meta.env.DEV && !/[?&]sw=1(&|$)/.test(location.search)) return false;
  return true;
}

/**
 * Announce an installed worker without adopting it. Pagehide may only be an
 * app switch; G898 permits adoption at a fresh document or title visit only.
 */
function announce(w: ServiceWorker): void {
  void (async () => {
    await buildOf(w);
    if (w.state === 'redundant') return;
    api.waiting = w;
    window.dispatchEvent(new CustomEvent('ws-sw-waiting', { detail: { waiting: w } }));
  })();
}

/** A worker reply or a real retirement/error ends a request; elapsed time never does. */
function workerReply<T>(worker: ServiceWorker, type: 'BUILD' | 'VERSION', read: (value: unknown) => T | null): Promise<T | null> {
  if (pageScope.disposed || pageScope.disposing || worker.state === 'redundant') return Promise.resolve(null);
  return new Promise(resolve => {
    const owner = pageScope.child('worker-reply'), channel = new MessageChannel();
    const finish = (value: T | null): void => { resolve(value); owner.dispose(); };
    owner.onDispose(() => {
      channel.port1.onmessage = null; channel.port1.onmessageerror = null;
      channel.port1.close(); channel.port2.close(); resolve(null);
    });
    owner.listen(worker, 'statechange', () => { if (worker.state === 'redundant') finish(null); });
    channel.port1.onmessage = (event: MessageEvent<unknown>) => { finish(read(event.data)); };
    channel.port1.onmessageerror = () => { finish(null); };
    try { worker.postMessage({type}, [channel.port2]); }
    catch { finish(null); }
  });
}

/** The exact build answered by the worker, or null after failure/retirement. */
function buildOf(worker: ServiceWorker): Promise<string | null> {
  return workerReply(worker, 'BUILD', value => typeof value === 'object' && value !== null && 'build' in value && typeof value.build === 'string' ? value.build : null);
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
  if (!await activateWaiting()) return false;
  markReload(`${why}: the new service worker took over`);
  if (to === undefined) location.reload();
  else location.replace(to);
  return true;
}

/** A completed activation serves the next document without claiming this one. */
function activateWaiting(): Promise<boolean> {
  const w = api.waiting;
  // An announcement can outlive its worker (another tab already adopted it,
  // or a later install replaced it). None of those states needs a hand-over.
  if (!sw || !w || pageScope.disposed || pageScope.disposing || sw.controller === w
    || (w.state !== 'installed' && w.state !== 'activating')) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const attempt = pageScope.child('worker-adoption');
    const finish = (claimed: boolean): void => { resolve(claimed); attempt.dispose(); };
    attempt.onDispose(() => { resolve(false); });
    attempt.listen(sw, 'controllerchange', () => {
      if (sw.controller !== w) return;
      if (api.waiting === w) api.waiting = null;
      finish(true);
    });
    attempt.listen(w, 'statechange', () => {
      if (w.state === 'activated') {
        if (api.waiting === w) api.waiting = null;
        finish(true);
      } else if (w.state === 'redundant') { finish(false); }
    });
    try {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter (that is Window.postMessage)
      w.postMessage({ type: 'SKIP_WAITING' });
    } catch { finish(false); } // the ordinary document navigation remains available
  });
}

function version(): Promise<SwVersion | null> {
  const controller = sw?.controller;
  if (!controller) return Promise.resolve(null);
  return workerReply<SwVersion>(controller, 'VERSION', value => {
    if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VERSION'
      && 'build' in value && typeof value.build === 'string') return { ...value, type: 'VERSION', build: value.build };
    return null;
  });
}

/** A stale chunk may reload only after the matching new worker owns its next document.
 * Discovery, install and activation follow actual worker state; retirement cancels them. */
export function refreshWorkerForChunkRecovery(build: string, allowed: () => boolean = () => true): Promise<boolean> {
  if (!allowed()) return Promise.resolve(false);
  if (!sw || !swAllowed() || sw.controller === null) return Promise.resolve(true);
  const container = sw;
  return new Promise<boolean>(resolve => {
    const owner = pageScope.child('stale-chunk-worker'), tracked = new Set<ServiceWorker>();
    const finish = (ready: boolean): void => { resolve(ready); owner.dispose(); };
    owner.onDispose(() => { resolve(false); });
    const track = (worker: ServiceWorker | null): void => {
      if (worker === null || owner.disposed || tracked.has(worker)) return;
      tracked.add(worker);
      const claim = async (): Promise<void> => {
        if ((worker.state !== 'installed' && worker.state !== 'activated') || owner.disposed) return;
        const identity = await buildOf(worker);
        if (owner.disposed) return;
        if (identity?.startsWith(`${build}-`) !== true) { finish(false); return; }
        if (!allowed()) { finish(false); return; }
        if (worker.state === 'activated') { finish(true); return; }
        owner.listen(container, 'controllerchange', () => { if (container.controller === worker) finish(true); });
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker messages have no targetOrigin.
        worker.postMessage({ type: 'SKIP_WAITING' });
      };
      owner.listen(worker, 'statechange', () => {
        if (worker.state === 'redundant') { finish(false); return; }
        void claim().catch(() => { finish(false); });
      });
      void claim().catch(() => { finish(false); });
    };
    void container.getRegistration().then(async registration => {
      if (owner.disposed) return undefined;
      if (registration === undefined) { finish(true); return undefined; }
      const active = container.controller;
      if (active !== null && (await buildOf(active))?.startsWith(`${build}-`) === true) { finish(allowed()); return undefined; }
      const observe = (): void => { track(registration.installing ?? registration.waiting); };
      owner.listen(registration, 'updatefound', observe);
      observe(); await registration.update(); observe();
      if (registration.installing === null && registration.waiting === null) finish(false);
      return undefined;
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
  // A controlling worker already owns this document's fetches. Registration
  // still discovers updates, but its network/update check cannot gate boot.
  if (s.controller) void register(s);
  // MF21: the first install's precache runs behind play, not before the title tap or under the boot's downloads.
  else pageScope.listen(document, 'ws:control-ready', () => { void register(s); }, { once: true });
  return Promise.resolve();
}

async function register(s: ServiceWorkerContainer): Promise<void> {
  const url = import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js';
  let reg: ServiceWorkerRegistration;
  // The host's no-cache still revalidates every update. Consult its ETag:
  // WebKit's default imports mode bypasses that conditional HTTP cache.
  try { reg = await s.register(url, { scope: '/', updateViaCache: 'all' }); } catch { return; }
  // A host that blocks worker installation can resolve without a registration.
  // Treat that as unavailable support, just like a rejected registration.
  if (reg === undefined) return;
  watch(reg);
  // Standalone installs live for days: keep discovering updates so the pill can offer them.
  pageScope.listen(document, 'visibilitychange', () => {
    if (!document.hidden) void reg.update().catch(() => undefined);
  });
}

if (typeof window !== 'undefined') window.__ws_sw = api;

export { adopt as swAdopt, version as swVersion, api as wsSw };

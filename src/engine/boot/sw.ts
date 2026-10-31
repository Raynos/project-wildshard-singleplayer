import { pageScope } from '../app/resources';
/**
 * Service-worker boot (project/archive/2026-09-22-load-perf.md §1b / §P3). Ported from trials-gauntlet-demo's `swBoot`,
 * with the update story changed for this game — see CONTRACT below.
 *
 * Loaded as its own `<script type="module">` in index.html, ahead of main.ts, so the worker is registered
 * at the very first line of boot. Two jobs, both before the first big fetch:
 *
 *  1. Every document is ready immediately. Boot watches an existing registration without joining a register job;
 *     the first registration starts in the background so its full precache can finish during cold entry, before
 *     a quick return. Neither registration nor activation gates navigation. Deferring the first install until
 *     control left the next document uncontrolled (039d: warm Home 13.84 -> 19.62 s). No document is claimed.
 *
 *  2. Announce updates without replacing gameplay. Adoption is explicit on the
 *     title or a fresh document; a running world never changes its controller.
 *
 * CONTRACT — `window.__ws_sw` (also the module's exports):
 *
 *   ready: Promise<void>        resolves at once: a controlled document, an uncontrolled one (registration is background work), or
 *                               service workers off (`?sw=0`, dev without `?sw=1`, no SW support).
 *   waiting: ServiceWorker|null the newest discovered build is installed and waiting; null otherwise.
 *   adopt(to?): Promise<boolean> explicit recovery: activate, then reload/replace once; true if sent.
 *                               False means unavailable or retired; recovery retains its ordinary fallback.
 *   version(): Promise<SwVersion|null>  what the controlling worker holds ({ build, entries, bytes, caches }),
 *                               null when nothing controls the page.
 *
 *   window event `ws-sw-waiting` carries { waiting, build } for an installed newest build, or { waiting: null }
 *   when it can no longer deliver it. The UI's `ws-sw-discovered` event carries a fresh version.json build.
 *
 * Opt-outs: `?sw=0` unregisters any worker and registers none (the bench measures the network). In dev the
 * worker is only registered with `?sw=1` (a stale worker would serve yesterday's bundle over HMR).
 */

import { markReload } from './lastEnd'; // E179: the page's "why did it reload" record — imported first, so its beat is the page's

declare const __BUILD_ID__: string;


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
  /** `why`: what asked for it, recorded for the next boot (src/engine/boot/lastEnd.ts) */
  adopt: (to?: string, why?: string) => Promise<boolean>;
  version: () => Promise<SwVersion | null>;
}

// the page's service-worker handle is declared in ./swGlobal.d.ts (an ambient file every layer's project sees)

const sw = typeof navigator === 'undefined' ? null : navigator.serviceWorker;
let watched: ServiceWorkerRegistration | null = null;
let newestBuild: string | null = null;
let discovery = 0;
// declared ahead of the functions that read it (they only run after registration; `boot()` is hoisted)
const api: WsSw = { ready: boot(), enabled: swAllowed(), waiting: null, adopt, version };

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
function unavailable(): void {
  if (api.waiting === null) return;
  api.waiting = null;
  window.dispatchEvent(new CustomEvent('ws-sw-waiting', { detail: { waiting: null } }));
}

async function newest(): Promise<string | null> {
  if (newestBuild !== null) return newestBuild;
  const started = discovery;
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return newestBuild;
    const value: unknown = await response.json();
    if (started === discovery && typeof value === 'object' && value !== null
      && 'build' in value && typeof value.build === 'string' && value.build !== '') {
      newestBuild = value.build; discovery++;
    }
  } catch { /* Offline discovery cannot offer an unverified worker. */ }
  return newestBuild;
}

function matchesNewest(build: string | null, target: string | null): boolean {
  return build !== null && target !== null && target !== __BUILD_ID__
    && build.startsWith(`${target}-`) && !build.startsWith(`${__BUILD_ID__}-`);
}
function adoptable(worker: ServiceWorker): boolean { return worker.state === 'installed' || worker.state === 'activating'; }

function announce(w: ServiceWorker): void {
  void (async () => {
    const [build, target] = await Promise.all([buildOf(w), newest()]);
    if (pageScope.disposed || pageScope.disposing || watched?.waiting !== w
      || w.state !== 'installed' || target !== newestBuild || !matchesNewest(build, target)) return;
    api.waiting = w;
    window.dispatchEvent(new CustomEvent('ws-sw-waiting', { detail: { waiting: w, build: target } }));
  })();
}

function discovered(build: string): void {
  if (newestBuild !== build) { newestBuild = build; discovery++; unavailable(); }
  const reg = watched;
  if (reg === null) return;
  if (api.waiting !== reg.waiting) unavailable();
  if (reg.waiting !== null) announce(reg.waiting);
  if (build !== __BUILD_ID__) void reg.update().catch(() => undefined);
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
  watched = reg;
  pageScope.listen(window, 'ws-sw-discovered', event => {
    if (!(event instanceof CustomEvent)) return;
    const value: unknown = event.detail;
    if (typeof value === 'object' && value !== null && 'build' in value
      && typeof value.build === 'string' && value.build !== '') discovered(value.build);
  });
  const tracked = new WeakSet<ServiceWorker>();
  const track = (w: ServiceWorker | null): void => {
    if (!w || tracked.has(w)) return;
    tracked.add(w);
    pageScope.listen(w, 'statechange', () => {
      if (w.state === 'installed' && sw?.controller) announce(w);
      else if (api.waiting === w && w.state !== 'installed') unavailable();
    });
    if (w.state === 'installed') announce(w);
  };
  track(reg.waiting);
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
async function activateWaiting(): Promise<boolean> {
  if (!sw || !swAllowed()) return false;
  let registration: ServiceWorkerRegistration | undefined;
  try { registration = await sw.getRegistration(); } catch { return false; }
  const w = registration?.waiting;
  // A registration read can outlive its worker (another tab already adopted it,
  // or a later install replaced it). None of those states needs a hand-over.
  if (!w || pageScope.disposed || pageScope.disposing || sw.controller === w
    || !adoptable(w)) return false;
  const [build, target] = await Promise.all([buildOf(w), newest()]);
  if (pageScope.disposed || pageScope.disposing || registration?.waiting !== w
    || !adoptable(w) || target !== newestBuild || !matchesNewest(build, target)) return false;
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
  // Start first-install work early enough for the next visit, without returning
  // to the old activation-blocked readiness. Existing registrations still take
  // PR2's non-job lookup/watch path; no document is claimed.
  void register(s);
  return Promise.resolve();
}

async function register(s: ServiceWorkerContainer): Promise<void> {
  const url = import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js';
  let reg: ServiceWorkerRegistration;
  // The host's no-cache still revalidates every update. Consult its ETag:
  // WebKit's default imports mode bypasses that conditional HTTP cache.
  try {
    const existing = await s.getRegistration();
    reg = existing ?? await s.register(url, { scope: '/', updateViaCache: 'all' });
    // register() is an update job and may remain pending behind an install on
    // WebKit. Reading an existing registration never joins that queue.
    if (existing !== undefined) void reg.update().catch(() => undefined);
  } catch { return; }
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

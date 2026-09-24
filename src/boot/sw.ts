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
 *  2. **Discover new builds, but never reload on our own.** The title screen already has a build pill
 *     (src/ui/Update.ts: "new build · tap to update") that is the one surface for taking a new deploy, so a
 *     waiting worker is *announced*, not adopted: no toast, no mid-session reload.
 *
 * CONTRACT — `window.__ws_sw` (also the module's exports):
 *
 *   ready: Promise<void>        resolves when the worker controls this page, or after CAP_MS, or at once when
 *                               service workers are off (`?sw=0`, dev without `?sw=1`, no SW support).
 *   waiting: ServiceWorker|null a newer build is installed and waiting to activate; null otherwise.
 *   adopt(): Promise<void>      take the waiting build now: SKIP_WAITING → controllerchange → location.reload().
 *                               Resolves (without reloading) if there is nothing waiting or the hand-over does
 *                               not land within CAP_MS. The pill's tap handler should prefer this over its plain
 *                               `?v=` reload when `waiting` is set, so the reload comes up on the new worker
 *                               and its precached shell rather than on the old worker revalidating.
 *   version(): Promise<SwVersion|null>  what the controlling worker holds ({ build, entries, bytes, caches }),
 *                               null when nothing controls the page.
 *
 *   window event `ws-sw-waiting` (CustomEvent<{ waiting: ServiceWorker }>) fires whenever a newer worker
 *   reaches `installed` while this page is controlled — the pill listens and lights up.
 *
 * Opt-outs: `?sw=0` unregisters any worker and registers none (the bench measures the network). In dev the
 * worker is only registered with `?sw=1` (a stale worker would serve yesterday's bundle over HMR).
 */

declare const __BUILD_ID__: string;

/** The longest boot waits for the worker to take control, or for a hand-over to a new build. */
const CAP_MS = 2500;

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
  waiting: ServiceWorker | null;
  adopt: () => Promise<void>;
  version: () => Promise<SwVersion | null>;
}

declare global {
  interface Window {
    __ws_sw?: WsSw;
  }
}

const sw = typeof navigator === 'undefined' ? null : navigator.serviceWorker;

// declared ahead of the functions that read it (they only run after registration; `boot()` is hoisted)
const api: WsSw = { ready: boot(), waiting: null, adopt, version };

function swAllowed(): boolean {
  if (!sw) return false;
  if (/[?&]sw=0(&|$)/.test(location.search)) return false;
  if (import.meta.env.DEV && !/[?&]sw=1(&|$)/.test(location.search)) return false;
  return true;
}

/**
 * A newer worker reached `installed` while we are controlled: announce it, do not adopt it — unless it holds the build
 * this page already runs. That happens when the pill was tapped before the worker finished installing: the `?v=`
 * reload fetched the new build from the network under the old worker, and the new worker then came up waiting. Lighting
 * the pill for it asked for a second tap and a second loading screen for the build already on screen (E95), so it is
 * activated quietly instead (no reload: the page is that build already).
 */
function announce(w: ServiceWorker): void {
  void (async () => {
    const build = await buildOf(w);
    if (w.state === 'redundant') return;
    if (build?.startsWith(`${__BUILD_ID__}-`) === true) {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter (that is Window.postMessage)
      w.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    api.waiting = w;
    window.dispatchEvent(new CustomEvent('ws-sw-waiting', { detail: { waiting: w } }));
  })();
}

/** The build a worker holds (`<BUILD_ID>-<content hash>`, src/pwa/sw.js), or null if it does not answer in time. */
function buildOf(w: ServiceWorker): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), CAP_MS);
    ch.port1.onmessage = (e: MessageEvent<{ build?: unknown }>) => {
      clearTimeout(timer);
      resolve(typeof e.data.build === 'string' ? e.data.build : null);
    };
    w.postMessage({ type: 'BUILD' }, [ch.port2]);
  });
}

function watch(reg: ServiceWorkerRegistration): void {
  const track = (w: ServiceWorker | null): void => {
    if (!w) return;
    if (w.state === 'installed') { announce(w); return; }
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && sw?.controller) announce(w);
    });
  };
  if (reg.waiting) announce(reg.waiting);
  track(reg.installing);
  reg.addEventListener('updatefound', () => track(reg.installing));
}

async function adopt(): Promise<void> {
  const w = api.waiting;
  if (!sw || !w) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, CAP_MS); // the hand-over never landed: leave the page alone
    sw.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        location.reload();
      },
      { once: true },
    );
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter (that is Window.postMessage)
    w.postMessage({ type: 'SKIP_WAITING' });
  });
}

function version(): Promise<SwVersion | null> {
  const ctl = sw?.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise<SwVersion | null>((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), CAP_MS);
    ch.port1.onmessage = (e: MessageEvent<SwVersion>) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    ctl.postMessage({ type: 'VERSION' }, [ch.port2]);
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
    const timer = setTimeout(resolve, CAP_MS);
    const settle = (): void => {
      clearTimeout(timer);
      resolve();
    };
    void register(s, settle);
  });
}

async function register(s: ServiceWorkerContainer, settle: () => void): Promise<void> {
  const url = import.meta.env.DEV ? '/sw.js?sw=1' : '/sw.js';
  let reg: ServiceWorkerRegistration;
  try { reg = await s.register(url, { scope: '/' }); } catch { settle(); return; }
  watch(reg);
  // Standalone installs live for days: keep discovering updates so the pill can offer them.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void reg.update().catch(() => undefined);
  });
  // First visit (or an evicted worker): wait for `clients.claim()`, so the boot's own bytes are cached.
  if (!s.controller) s.addEventListener('controllerchange', settle, { once: true });
  else settle();
}

if (typeof window !== 'undefined') window.__ws_sw = api;

export const swReady = api.ready;
export { adopt as swAdopt, version as swVersion, api as wsSw };

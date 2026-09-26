/**
 * The boot's safety net under the game's own error handling (E144). src/ui/ErrorModal.ts is armed by src/main.ts, so a
 * failure BEFORE main evaluates never reached it: a main chunk that 404'd (a service worker holding a build the host no
 * longer serves) left the first-paint loader frozen at 00:00.0, DOWNLOAD 0 %, SETUP 0 %, with nothing on screen to say
 * so. Dependency-light on purpose: it rides in the index chunk that index.html loads, beside src/boot/entry.ts.
 *
 *   guardBoot(entered)   entry.ts's `import(main)` promise:
 *     rejects      → report it (queued offline, sent by the next boot), then recover() by itself once; a second failure
 *                    inside the reload budget (src/core/reloadGuard.ts, shared with the error modal) shows the card
 *                    with a RELOAD button instead: it never loops.
 *     STALL_MS without settling → the card ("Still starting"), RELOAD on a tap; it goes away if main starts after all.
 *
 *   recover()   only when the host answers (else the card says "No connection" and nothing is touched): hand over to
 *               a waiting worker if there is one, delete the controlling worker's shell cache if its document names
 *               code that is no longer in the code cache (the poisoned shell: the build it describes cannot boot from
 *               here), then a `?v=` reload, which the worker answers network-first (src/pwa/sw.js).
 */
import { ErrorReporter, safeUrl, sendReport } from '../core/errorReport';
import { RELOADS_MAX, countReload, recentReloads } from '../core/reloadGuard';
import { markUnload } from './lastEnd';

declare const __BUILD_ID__: string; // vite.config.ts define

/** a boot whose main module has not arrived by then gets the card (it stays out of the way and leaves if main starts) */
const STALL_MS = 25_000;
/** the longest recover() waits for a waiting worker to take over before it reloads anyway */
const HANDOVER_MS = 2500;
/** the reachability probe's cap */
const PROBE_MS = 5000;

let card: HTMLElement | null = null;
/** what went wrong, for the card's small print */
let detail = '';
// lib.dom says it always exists; it doesn't (an insecure context, a WebView without service workers)
const nav: { serviceWorker?: ServiceWorkerContainer | undefined } = navigator;

function store(kind: 'session' | 'local'): Storage | null { try { return kind === 'session' ? sessionStorage : localStorage; } catch { return null; } }

function report(error: unknown): void {
  try {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src ?? '';
    const reporter = new ErrorReporter({
      send: sendReport,
      context: () => ({ build: __BUILD_ID__, shard: '', url: safeUrl(location.href), loop: 'boot', entry: entry.split('/').pop() ?? '', online: navigator.onLine, controlled: (nav.serviceWorker?.controller ?? null) !== null }),
      session: store('session'), local: store('local'), now: () => performance.now(),
    });
    void reporter.report('boot-entry', error, { fatal: true });
  } catch { /* the net must never throw */ }
}

/** the shell cache of the worker controlling this page (`ws-shell-<its build>`, src/pwa/sw.js), null if none answers */
function controllerShell(): Promise<string | null> {
  const ctl = nav.serviceWorker?.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => { resolve(null); }, HANDOVER_MS);
    ch.port1.onmessage = (e: MessageEvent<{ build?: unknown }>) => { clearTimeout(timer); resolve(typeof e.data.build === 'string' ? `ws-shell-${e.data.build}` : null); };
    ctl.postMessage({ type: 'BUILD' }, [ch.port2]);
  });
}

/**
 * The controlling worker's shell cache, when its document names a script the code cache does not hold: that document
 * is what just failed. Only the controller's: a worker still installing has put its document in its own shell before
 * its code, and would look poisoned for a moment.
 */
async function dropPoisonedShell(): Promise<void> {
  const name = await controllerShell();
  if (name === null || !(await caches.has(name))) return;
  const immutable = await caches.open('ws-immutable');
  const doc = await (await caches.open(name)).match(new URL('/index.html', location.origin).href, { ignoreVary: true });
  const refs = doc ? (await doc.text()).match(/\/assets\/[^/"'?#\s]+-[\w-]{8}\.js/g) ?? [] : [];
  const missing = await Promise.all(refs.map(async (r) => (await immutable.match(new URL(r, location.origin).href, { ignoreVary: true })) === undefined));
  if (!doc || missing.includes(true)) await caches.delete(name);
}

/** a waiting worker takes over (it holds a complete build: src/pwa/sw.js installs strictly), capped */
async function adoptWaiting(): Promise<void> {
  const sw = nav.serviceWorker;
  const waiting = sw ? (await sw.getRegistration())?.waiting : null;
  if (!sw || !waiting) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, HANDOVER_MS);
    sw.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin parameter (that is Window.postMessage)
    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}

/** can the host be reached at all? (version.json: the worker never answers it from a cache) */
async function reachable(): Promise<boolean> {
  const abort = new AbortController();
  const timer = setTimeout(() => { abort.abort(); }, PROBE_MS);
  try { return (await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', signal: abort.signal })).ok; } catch { return false; } finally { clearTimeout(timer); }
}

/**
 * Clear what cannot boot and fetch the document again, counted against the shared reload budget. With no way to reach
 * the host it changes nothing (the shell may be all an offline launch has) and says so instead: a reload could only
 * trade the loader for the browser's own "no connection" page.
 */
export async function recover(): Promise<void> {
  if (!(await reachable())) {
    show('No connection', 'This build isn’t fully downloaded yet. Reconnect, then tap Reload.', detail, true);
    return;
  }
  countReload();
  try {
    await adoptWaiting();
    if ('caches' in window) await dropPoisonedShell();
  } catch { /* reload regardless */ }
  const url = new URL(location.href);
  url.searchParams.delete('crash');
  url.searchParams.set('v', Date.now().toString(36)); // network-first in the worker: the host's live document
  markUnload(`stuck boot recovery (${detail.slice(0, 80)})`);
  location.replace(url.toString());
}

const STYLE = `
  #wsstuck { position: fixed; left: 50%; bottom: max(24px, calc(env(safe-area-inset-bottom) + 16px)); z-index: 2147482500; transform: translateX(-50%); box-sizing: border-box; width: min(360px, calc(100% - 32px)); padding: 16px 16px 14px; background: rgba(13, 27, 38, 0.86); border: 1px solid rgba(143, 227, 255, 0.35); color: #e6f2f8; font: 12px/1.5 "JetBrains Mono", ui-monospace, Menlo, monospace; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
  #wsstuck .t { margin: 0 0 6px; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #8fe3ff; }
  #wsstuck .l { margin: 0 0 12px; color: rgba(230, 242, 248, 0.82); }
  #wsstuck button { appearance: none; -webkit-appearance: none; box-sizing: border-box; width: 100%; padding: 12px 16px; cursor: pointer; font: 700 12px/1 "JetBrains Mono", monospace; letter-spacing: 0.24em; text-transform: uppercase; border: 1px solid #8fe3ff; background: rgba(143, 227, 255, 0.18); color: #fff; }
  #wsstuck button[hidden] { display: none; }
  #wsstuck .m { margin: 10px 0 0; font-size: 10px; color: rgba(230, 242, 248, 0.45); word-break: break-word; }
`;

/** the card over the frozen loader: what happened, and RELOAD (hidden while an automatic recovery runs) */
function show(tag: string, line: string, small: string, button: boolean): void {
  try {
    if (!document.getElementById('wsstuck-style')) {
      const s = document.createElement('style');
      s.id = 'wsstuck-style';
      s.textContent = STYLE;
      document.head.append(s);
    }
    card ??= document.createElement('div');
    card.id = 'wsstuck';
    card.setAttribute('role', 'alert');
    card.innerHTML = '<p class="t"></p><p class="l"></p><button type="button">Reload</button><p class="m"></p>';
    const [tagEl, lineEl, msgEl] = [card.querySelector('.t'), card.querySelector('.l'), card.querySelector('.m')];
    if (tagEl) tagEl.textContent = tag;
    if (lineEl) lineEl.textContent = line;
    if (msgEl) msgEl.textContent = small;
    const btn = card.querySelector('button');
    if (btn) {
      btn.hidden = !button;
      btn.onclick = () => { btn.disabled = true; btn.textContent = 'Reloading…'; void recover(); };
    }
    if (!card.isConnected) document.body.append(card);
  } catch { /* the net must never throw */ }
}

function failed(error: unknown): void {
  detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  report(error);
  if (recentReloads().length === 0) {
    // the common case (a build the host no longer serves): one automatic recovery, no tap needed
    show('Updating', 'Fetching the new build…', detail, false);
    void recover();
    return;
  }
  const looped = recentReloads().length >= RELOADS_MAX;
  show('Couldn’t start', looped ? 'It failed again after a reload. Try once more in a minute.' : 'The game failed to start. A reload usually fixes it.', detail, true);
}

/** Watch entry.ts's main-module promise: a rejection or a stall gets a way out instead of a frozen loader. */
export function guardBoot(entered: Promise<unknown>): void {
  let settled = false;
  const stall = setTimeout(() => {
    detail = `no main module after ${STALL_MS / 1000} s`;
    if (!settled) show('Still starting', 'The game is taking unusually long to start.', detail, true);
  }, STALL_MS);
  void (async () => {
    try { await entered; } catch (e) { settled = true; clearTimeout(stall); failed(e); return; }
    settled = true;
    clearTimeout(stall);
    card?.remove(); // main started after all: the stall card goes
    card = null;
  })();
}

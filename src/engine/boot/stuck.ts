import { pageScope } from '../app/resources';
import { Scope } from '../app/scope';
import { hudSlots } from '../ui/hudSlots';
import { engineString } from '../strings';
import { saveStorage } from '../saves/slots';
/**
 * The boot's safety net under the game's own error handling (E144). src/engine/ui/ErrorModal.ts is armed by src/main.ts, so a
 * failure BEFORE main evaluates never reached it: a main chunk that 404'd (a service worker holding a build the host no
 * longer serves) left the first-paint loader frozen at 00:00.0, DOWNLOAD 0 %, SETUP 0 %, with nothing on screen to say
 * so. Dependency-light on purpose: it rides in the index chunk that index.html loads, beside src/entry.ts.
 *
 *   guardBoot(entered)   entry.ts's `import(main)` promise:
 *     rejects      → report it (queued offline, sent by the next boot), then recover() by itself once; a second failure
 *                    inside the reload budget (src/engine/core/reloadGuard.ts, shared with the error modal) shows the card
 *                    with a RELOAD button instead: it never loops.
 *     STALL_MS without settling → the card ("Still starting"), RELOAD on a tap; it goes away if main starts after all.
 *
 *   recover()   records the deliberate retry and reloads immediately. Shell delivery and bounded network fallback
 *               belong to the worker; the page does not probe, adopt or run cache maintenance before navigating.
 */
import { ErrorReporter, safeUrl, sendReport } from '../core/errorReport';
import { RELOADS_MAX, countReload, recentReloads } from '../core/reloadGuard';
import { markReload } from './lastEnd';

const recoveryScope = new Scope('boot.recovery');

declare const __BUILD_ID__: string; // vite.config.ts define

/** a boot whose main module has not arrived by then gets the card (it stays out of the way and leaves if main starts) */
const STALL_MS = 10_000;

let card: HTMLElement | null = null;
/** what went wrong, for the card's small print */
let detail = '';
// lib.dom says it always exists; it doesn't (an insecure context, a WebView without service workers)
const nav: { serviceWorker?: ServiceWorkerContainer | undefined } = navigator;

function store(kind: 'session' | 'local'): ReturnType<typeof saveStorage> { return saveStorage(kind === 'local' ? 'device' : 'session'); }

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

/** A player's retry navigates immediately. The worker owns bounded shell delivery;
 * UI recovery never waits for a probe, activation or cache maintenance. */
export function recover(): Promise<void> {
  countReload();
  markReload(`stuck boot recovery (${detail.slice(0, 80)})`);
  location.reload();
  return Promise.resolve();
}

/**
 * A cached app met a newer deployment's first-party product (src/game/shardfile/product.ts `readIndexBytes`): recover()
 * once, so the reload comes up on the new build. False, without reloading, when a counted reload is already inside the
 * window (it did not bring the new build): the caller shows its error instead of looping. Concurrent callers share one.
 */
export function staleClientRecovery(recent: () => number, reload: () => Promise<void>): () => Promise<boolean> {
  let pending: Promise<boolean> | undefined;
  return () => {
    pending ??= (async () => {
      if (recent() > 0) return false;
      detail = 'app older than its product';
      await reload();
      return true;
    })();
    return pending;
  };
}
/** The page's one stale-client recovery (staleClientRecovery). */
export const recoverStaleClient: () => Promise<boolean> = staleClientRecovery(() => recentReloads().length, recover);

const STYLE = `
  #wsstuck { position: fixed; left: 50%; bottom: max(24px, calc(env(safe-area-inset-bottom) + 16px)); z-index: var(--ws-layer-error, 2147482500); transform: translateX(-50%); box-sizing: border-box; width: min(360px, calc(100% - 32px)); padding: 16px 16px 14px; background: rgba(13, 27, 38, 0.86); border: 1px solid rgba(143, 227, 255, 0.35); color: #e6f2f8; font: 12px/1.5 "JetBrains Mono", ui-monospace, Menlo, monospace; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
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
    card.innerHTML = engineString('s_268a2fe13de0');
    const [tagEl, lineEl, msgEl] = [card.querySelector('.t'), card.querySelector('.l'), card.querySelector('.m')];
    if (tagEl) tagEl.textContent = tag;
    if (lineEl) lineEl.textContent = line;
    if (msgEl) msgEl.textContent = small;
    const btn = card.querySelector('button');
    if (btn) {
      btn.hidden = !button;
      btn.onclick = () => { btn.disabled = true; btn.textContent = engineString('s_ea456dcf3d90'); void recover(); };
    }
    if (!card.isConnected) hudSlots.widget('band.6', card, 0, recoveryScope, document.body);
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
  const stall = pageScope.timeout(STALL_MS, () => {
    detail = `no main module after ${STALL_MS / 1000} s`;
    if (!settled) show('Still starting', 'The game is taking unusually long to start.', detail, true);
  });
  void (async () => {
    try { await entered; } catch (e) { settled = true; pageScope.cancelTimer(stall); failed(e); return; }
    settled = true;
    pageScope.cancelTimer(stall);
    card?.remove(); // main started after all: the stall card goes
    card = null;
  })();
}

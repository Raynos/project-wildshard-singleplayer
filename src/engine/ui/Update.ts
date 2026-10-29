import { Scope } from '../app/scope';
import { diagnosticNow } from '../core/clock';
import { hudSlots } from './hudSlots';
import { engineString } from '../strings';
/**
 * Build pill on the title screen: shows the running build and reloads on tap.
 * Bookmarked as a home-screen PWA on iOS there is no address bar, so this is the only
 * way to pull a new deploy. It also polls /version.json (no-store) on load and whenever
 * the app returns to the foreground; when the server has a newer build the pill lights up.
 *
 * E140 (the user's 6a): players see the pill only when a new build is waiting ("New version · tap to update"). Developer
 * mode (src/engine/core/devMode.ts) shows it always, with the build id ("f86b4c3 · reload", "new f86b4c3 · tap to update").
 *
 * E176 (Jake): the in-game PAUSE menu carries it too, at the same screen corner as the title's — on the phone the pause
 * menu is the only chrome you can reach once you are in the world, so that is where a waiting deploy has to be tappable.
 * A tap reloads wherever the pill is (title, loading screen, pause menu; 2026-10-29 P0).
 * It sits over the menu overlay (z 80 vs 70) and publishes `--ws-pill` on <html>, which is the band gmenu.css keeps free
 * above the sheet so the pill never lands on CLOSE.
 */
import { isDev, onDev } from '../core/devMode';
import { markReload } from '../boot/lastEnd';
import { DownloadAccounting, observeDownloadAccounting } from '../boot/download';
import { UpdateProgress } from './UpdateProgress';


// The update pill exists before content is selected; keep App and Three out of the entry graph.
const scope = new Scope('ui.Update');

declare const __BUILD_ID__: string;

/** `<sha>-<stamp>` → the sha, or the time token: Vercel CLI builds have no git checkout */
const shortBuild = (id: string): string => { const [gitSha = '', stamp = ''] = id.split('-'); return gitSha.length >= 7 ? gitSha : stamp; };
const sha = shortBuild(__BUILD_ID__);
const el = document.createElement('button');
el.className = 'ws-update';
el.type = 'button';
el.innerHTML = engineString('s_85c05389552b');
hudSlots.widget('band.1', el, 0, scope, document.body);

let busy = false;
let targetBuild: string | null = null;
let newer = false;
const screen = new UpdateProgress(scope, __BUILD_ID__, () => { busy = false; void reload(true); });
/** `tapped`: the player pressed the pill. Jake 2026-10-29 (P0, "the reload button does nothing"): a tap always reloads,
 *  on the title, the loading screen and the pause menu. Only the automatic adoption waits for the title. */
async function reload(tapped: boolean): Promise<void> {
  if (busy) return;
  const sw = window.__ws_sw, atTitle = titleBoundary();
  if (!tapped && !atTitle) return;
  // a newer build not yet installed: fetch it in the background; the reloaded title adopts it once it waits
  if (newer && (sw?.waiting ?? null) === null) requestInstall();
  busy = true;
  const text = el.querySelector('[data-el="text"]'), attempt = scope.child('update');
  const started = diagnosticNow(), downloads = new DownloadAccounting(location.href, started);
  attempt.onDispose(observeDownloadAccounting(downloads));
  const progress = (): void => {
    if (text) text.textContent = engineString('s_41273a4673fc', [downloads.snapshot().filesDone, ((diagnosticNow() - started) / 1000).toFixed(1)]);
  };
  progress();
  attempt.interval(250, progress);
  // Navigation may itself wait for a response: keep receipts and elapsed time
  // live until the document leaves, then release this attempt's observers.
  attempt.listen(window, 'pagehide', () => { attempt.dispose(); }, { once: true });
  // A newer service worker waiting: adopt it (SKIP_WAITING → controllerchange → reload, src/engine/boot/sw.ts).
  const waiting = sw?.waiting;
  screen.boundary(targetBuild, waiting !== undefined && waiting !== null && waiting.state !== 'redundant');
  if (!await screen.present()) return;
  if (sw && waiting && waiting.state !== 'redundant') {
    screen.phase('install');
    if (!await screen.present()) return;
    if (navigator.serviceWorker !== undefined) attempt.listen(navigator.serviceWorker, 'controllerchange', () => {
      if (navigator.serviceWorker.controller === waiting) screen.phase('reload');
    });
    await sw.activate();
  }
  screen.phase('reload');
  if (!await screen.present()) return;
  // Off the title (loading screen, pause menu) the page reloads where it is.
  if (!atTitle) { markReload('update tapped'); location.reload(); return; }
  // This is the title, including a return from an entered world. Remove the
  // old world destination so adoption cannot send the player back into play.
  const url = new URL(location.href);
  for (const key of ['v', 'chunk', 'explore', 'at', 'glreload', 'cam', 'model', 'skipintro', 'tour', 'quest', 'drop', 'x', 'z', 'yaw', 'pitch']) url.searchParams.delete(key);
  markReload('update at title boundary');
  location.replace(url.toString());
}
// pointerup as well as click: iOS drops the synthesized click when a tap jitters (index.html cancels touchmove for the
// rubber-band), so the pill answers the lift itself; `busy` keeps the pair from running twice
scope.listen(el, 'pointerup', () => { void reload(true); });
scope.listen(el, 'click', () => { void reload(true); });

let newLabel = '';
function titleBoundary(): boolean {
  return document.querySelector('#hud.intro .ws-menu:not(.hide), #hud.intro .ws-main:not(.hide)') !== null;
}
function requestInstall(): void {
  void navigator.serviceWorker?.getRegistration().then(registration => registration?.update()).catch(() => undefined);
  const text = el.querySelector('[data-el="text"]');
  if (text !== null) text.textContent = engineString('s_update_next_boundary');
}
/** the pill's words: a player reads "New version", a developer the build ids */
const paint = (): void => {
  const text = el.querySelector('[data-el="text"]');
  if (!text || busy) return;
  text.textContent = !newer ? engineString('s_9e4fe13a912d', [sha]) : isDev()
    ? engineString('s_update_next_boundary_dev', [newLabel]) : engineString('s_update_next_boundary');
};
const lightUp = (label: string): void => {
  newer = true;
  newLabel = label;
  el.classList.add('newer');
  paint();
  sync();
};
paint();
// the worker found a new build (installed, waiting) — same pill, no toast
scope.listen(window, 'ws-sw-waiting', () => { lightUp(engineString('s_44575cf5b285')); });

async function check(): Promise<void> {
  if (newer || !navigator.onLine) return; // offline (the PWA plays from its cache): no request that can only fail
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j: unknown = await r.json();
    if (typeof j === 'object' && j !== null && 'build' in j && typeof j.build === 'string' && j.build !== '' && j.build !== __BUILD_ID__) {
      targetBuild = j.build; requestInstall(); lightUp(shortBuild(j.build));
    }
  } catch { /* offline — keep the plain reload pill */ }
}
void check();
scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
scope.interval(5 * 60 * 1000, () => { void check(); });

// Only show while on the loading / title screen; hide once the player has entered the chunk. Players: only when a new build waits.
// The running shard's #hud (E155: each resident shard has its own; a switch swaps them in <body>, which runs sync below)
let hud: HTMLElement | null = null;
const hudClass = new MutationObserver(() => { sync(); });
function sync(): void {
  const now = document.getElementById('hud');
  if (now !== hud) { hudClass.disconnect(); hud = now; if (hud) hudClass.observe(hud, { attributes: true, attributeFilter: ['class'] }); }
  const onTitle = document.querySelector('.ws-load') !== null || (hud?.classList.contains('intro') ?? false);
  const onPause = document.querySelector('.ws-gmenu.show.pause') !== null; // E176: the in-game pause menu (src/engine/ui/Menu.ts)
  const show = onTitle || onPause; // Jake 2026-10-01: everyone gets the reload pill on the title and pause menus, not only developer mode
  el.classList.toggle('visible', show); // menu-only: never over the game view, even when a newer build exists
  // the band the menu overlay keeps free above its sheet (gmenu.css) — only while the pill is actually up
  document.documentElement.style.setProperty('--ws-pill', show ? '24px' : '0px');
  // Initial title or return-to-title: an installed update can now replace the
  // document. Loading and Explore's hidden intro HUD are not title boundaries.
  if (!busy && titleBoundary() && window.__ws_sw?.waiting?.state === 'installed') void reload(false);
}
sync();
onDev(() => { paint(); sync(); });
// the pause menu opened or closed: it says so, because its class lives on an element this module never sees created
scope.listen(window, 'ws-menu', () => { sync(); });
const bodyClass = new MutationObserver(sync);
bodyClass.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
scope.onDispose(() => { hudClass.disconnect(); bodyClass.disconnect(); });

/**
 * Build pill on the title screen: shows the running build and reloads on tap.
 * Bookmarked as a home-screen PWA on iOS there is no address bar, so this is the only
 * way to pull a new deploy. It also polls /version.json (no-store) on load and whenever
 * the app returns to the foreground; when the server has a newer build the pill lights up.
 *
 * E140 (the user's 6a): players see the pill only when a new build is waiting ("New version · tap to update"). Developer
 * mode (src/core/devMode.ts) shows it always, with the build id ("f86b4c3 · reload", "new f86b4c3 · tap to update").
 *
 * E176 (Jake): the in-game PAUSE menu carries it too, at the same screen corner as the title's — on the phone the pause
 * menu is the only chrome you can reach once you are in the world, so that is where a waiting deploy has to be tappable.
 * It sits over the menu overlay (z 80 vs 70) and publishes `--ws-pill` on <html>, which is the band gmenu.css keeps free
 * above the sheet so the pill never lands on CLOSE.
 */
import { isDev, onDev } from '../core/devMode';
import { markUnload } from '../boot/lastEnd';

declare const __BUILD_ID__: string;

/** `<sha>-<stamp>` → the sha, or the time token: Vercel CLI builds have no git checkout */
const shortBuild = (id: string): string => { const [gitSha = '', stamp = ''] = id.split('-'); return gitSha.length >= 7 ? gitSha : stamp; };
const sha = shortBuild(__BUILD_ID__);
const el = document.createElement('button');
el.className = 'ws-update';
el.type = 'button';
el.innerHTML = '<span class="ws-update-dot"></span><span data-el="text"></span>';
document.body.append(el);

let busy = false;
const reload = async (): Promise<void> => {
  if (busy) return;
  busy = true;
  const text = el.querySelector('[data-el="text"]');
  if (text) text.textContent = 'updating…'; // the tap is acknowledged at once, whatever the hand-over does
  // A newer service worker waiting: adopt it (SKIP_WAITING → controllerchange → reload, src/boot/sw.ts).
  const sw = window.__ws_sw;
  if (sw?.waiting && sw.waiting.state !== 'redundant') await sw.adopt(undefined, 'build pill tap');
  // Still here: nothing was waiting, or the hand-over never landed within adopt()'s cap — e.g. the announced worker went
  // redundant because a later deploy superseded it, which left the pill dead to taps (E53). Cache-bust the document
  // itself; keep ?chunk= and friends.
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  markUnload('build pill tap (?v= reload)');
  location.replace(url.toString());
};
// pointerup as well as click: iOS drops the synthesized click when a tap jitters (index.html cancels touchmove for the
// rubber-band), so the pill answers the lift itself; `busy` keeps the pair from running twice
el.addEventListener('pointerup', () => { void reload(); });
el.addEventListener('click', () => { void reload(); });

let newer = false;
let newLabel = '';
/** the pill's words: a player reads "New version", a developer the build ids */
const paint = (): void => {
  const text = el.querySelector('[data-el="text"]');
  if (!text || busy) return;
  text.textContent = !newer ? `${sha} · reload` : isDev() ? `new ${newLabel} · tap to update` : 'New version · tap to update';
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
window.addEventListener('ws-sw-waiting', () => { lightUp('build'); });

async function check(): Promise<void> {
  if (newer || !navigator.onLine) return; // offline (the PWA plays from its cache): no request that can only fail
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { build?: string };
    if (j.build !== undefined && j.build !== '' && j.build !== __BUILD_ID__) lightUp(shortBuild(j.build));
  } catch { /* offline — keep the plain reload pill */ }
}
void check();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
setInterval(check, 5 * 60 * 1000);

// Only show while on the loading / title screen; hide once the player has entered the chunk. Players: only when a new build waits.
// The running shard's #hud (E155: each resident shard has its own; a switch swaps them in <body>, which runs sync below)
let hud: HTMLElement | null = null;
const hudClass = new MutationObserver(() => { sync(); });
function sync(): void {
  const now = document.getElementById('hud');
  if (now !== hud) { hudClass.disconnect(); hud = now; if (hud) hudClass.observe(hud, { attributes: true, attributeFilter: ['class'] }); }
  const onTitle = document.querySelector('.ws-load') !== null || (hud?.classList.contains('intro') ?? false);
  const onPause = document.querySelector('.ws-gmenu.show.pause') !== null; // E176: the in-game pause menu (src/ui/Menu.ts)
  const show = (onTitle || onPause) && (newer || isDev());
  el.classList.toggle('visible', show); // menu-only: never over the game view, even when a newer build exists
  // the band the menu overlay keeps free above its sheet (gmenu.css) — only while the pill is actually up
  document.documentElement.style.setProperty('--ws-pill', show ? '24px' : '0px');
}
sync();
onDev(() => { paint(); sync(); });
// the pause menu opened or closed: it says so, because its class lives on an element this module never sees created
window.addEventListener('ws-menu', () => { sync(); });
new MutationObserver(sync).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });

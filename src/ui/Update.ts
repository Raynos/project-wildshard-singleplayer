/**
 * Build pill on the title screen: shows the running build and reloads on tap.
 * Bookmarked as a home-screen PWA on iOS there is no address bar, so this is the only
 * way to pull a new deploy. It also polls /version.json (no-store) on load and whenever
 * the app returns to the foreground; when the server has a newer build the pill lights up.
 */
declare const __BUILD_ID__: string;

/** `<sha>-<stamp>` → the sha, or the time token: Vercel CLI builds have no git checkout */
const shortBuild = (id: string): string => { const [gitSha = '', stamp = ''] = id.split('-'); return gitSha.length >= 7 ? gitSha : stamp; };
const sha = shortBuild(__BUILD_ID__);
const el = document.createElement('button');
el.className = 'ws-update';
el.type = 'button';
el.innerHTML = `<span class="ws-update-dot"></span><span data-el="text">${sha} · reload</span>`;
document.body.append(el);

const reload = (): void => {
  // A newer service worker waiting: adopt it (SKIP_WAITING → controllerchange → reload, src/boot/sw.ts).
  // Otherwise cache-bust the document itself; keep ?chunk= and friends.
  if (window.__ws_sw?.waiting) { void window.__ws_sw.adopt(); return; }
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  location.replace(url.toString());
};
el.addEventListener('click', reload);

let newer = false;
const lightUp = (label: string): void => {
  newer = true;
  el.classList.add('newer');
  const text = el.querySelector('[data-el="text"]');
  if (text) text.textContent = `new ${label} · tap to update`;
};
// the worker found a new build (installed, waiting) — same pill, no toast
window.addEventListener('ws-sw-waiting', () => { lightUp('build'); });

async function check(): Promise<void> {
  if (newer) return;
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

// Only show while on the loading / title screen; hide once the player has entered the chunk.
const hud = document.getElementById('hud');
const sync = (): void => {
  const onTitle = document.querySelector('.ws-load') !== null || (hud?.classList.contains('intro') ?? false);
  el.classList.toggle('visible', onTitle); // menu-only: never over the game view, even when a newer build exists
};
sync();
new MutationObserver(sync).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
if (hud) new MutationObserver(sync).observe(hud, { attributes: true, attributeFilter: ['class'] });

// oxlint-disable-next-line unicorn/require-module-specifiers -- side-effect script loaded by index.html: the bare export marks it as a module (import/unambiguous)
export {};

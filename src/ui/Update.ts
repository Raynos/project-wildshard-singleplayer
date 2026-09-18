/**
 * Build pill on the title screen: shows the running build and reloads on tap.
 * Bookmarked as a home-screen PWA on iOS there is no address bar, so this is the only
 * way to pull a new deploy. It also polls /version.json (no-store) on load and whenever
 * the app returns to the foreground; when the server has a newer build the pill lights up.
 */
declare const __BUILD_ID__: string;

const sha = __BUILD_ID__.split('-')[0];
const el = document.createElement('button');
el.className = 'ws-update';
el.type = 'button';
el.innerHTML = `<span class="ws-update-dot"></span><span class="ws-update-text">build ${sha} · reload</span>`;
document.body.appendChild(el);

const reload = () => {
  // Cache-bust the document itself; keep ?chunk= and friends.
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  location.replace(url.toString());
};
el.addEventListener('click', reload);

let newer = false;
async function check() {
  if (newer) return;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { build?: string };
    if (j.build && j.build !== __BUILD_ID__) {
      newer = true;
      el.classList.add('newer');
      el.querySelector('.ws-update-text')!.textContent = `new build ${j.build.split('-')[0]} · tap to update`;
    }
  } catch { /* offline — keep the plain reload pill */ }
}
check();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
setInterval(check, 5 * 60 * 1000);

// Only show while on the loading / title screen; hide once the player has entered the chunk.
const hud = document.getElementById('hud');
const sync = () => {
  const onTitle = !!document.querySelector('.ws-loading') || !!hud?.classList.contains('intro');
  el.classList.toggle('visible', onTitle || newer);
};
sync();
new MutationObserver(sync).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
if (hud) new MutationObserver(sync).observe(hud, { attributes: true, attributeFilter: ['class'] });

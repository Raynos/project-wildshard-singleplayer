/**
 * viewport — the page's real drawable height.
 *
 *   installViewport();            // once (Game's constructor); keeps `--ws-vh` on <html> current on every resize
 *   const h = viewportHeight();   // use instead of window.innerHeight for the canvas and anything projected onto it
 *
 * iOS home-screen web app (index.html sets `html.standalone`; the status bar is black-translucent, so the page runs
 * under it): WebKit reports `innerHeight` / `100vh` / a fixed `inset: 0` SHORT by the status bar's height (≈ 62 px on a
 * Dynamic Island phone) while the page still starts at the very top — the canvas and the touch bar stopped that far
 * above the physical bottom and left a black strip over the home indicator (E46, Jake's iPhone). In that mode, portrait,
 * the screen's height is the truth; a gap wider than a status bar (or none, once WebKit is fixed) falls back to
 * innerHeight. The Safari tab and every other browser are untouched.
 */
const MAX_GAP = 80; // px — the tallest status bar (Dynamic Island ≈ 62); anything wider is not this bug

export function viewportHeight(): number {
  const h = window.innerHeight;
  if (!document.documentElement.classList.contains('standalone')) return h;
  const portrait = window.innerWidth < h;
  const sh = Math.max(screen.width, screen.height); // iOS reports the portrait screen whatever the orientation
  const gap = sh - h;
  return portrait && gap > 0 && gap <= MAX_GAP ? sh : h;
}

let installed = false;
/** publish the height as `--ws-vh` (base.css sizes #game and #hud with it) and keep it current */
export function installViewport(): void {
  if (installed) return;
  installed = true;
  const sync = (): void => { document.documentElement.style.setProperty('--ws-vh', `${viewportHeight()}px`); };
  sync();
  window.addEventListener('resize', sync);
}

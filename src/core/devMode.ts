/**
 * Developer mode (E140, the user's 1c): one switch that shows the screens only a developer or a playtester wants — the frame
 * meter, the build id pill, the loading screen's step log, the Settings DEBUG card. Players see none of them.
 *
 *   isDev()            // on for this page?
 *   setDev(on)         // the Settings ▸ Developer switch: saved, and every listener told at once (no reload)
 *   onDev((on) => …)   // live show / hide; returns the unsubscribe
 *
 * The saved pick lives in localStorage `ws.dev` (a `ws.*` key, so the native save mirror keeps it, src/native/saves.ts).
 * `?dev` (or `?dev=1`) turns it on for one load, `?dev=0` off; the switch wins once it is touched. `<html data-dev>` mirrors
 * the state for CSS — index.html sets it before any module runs (the loading screen is painted from the first bytes), from
 * this same key and param; keep the two readers in step.
 */
const KEY = 'ws.dev';
const EVENT = 'ws-dev';

const fromUrl = (): boolean | null => {
  const p = new URLSearchParams(location.search).get('dev');
  return p === null ? null : p !== '0';
};
const saved = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

let on = fromUrl() ?? saved();

const mirror = (): void => { document.documentElement.toggleAttribute('data-dev', on); };
mirror();

export function isDev(): boolean { return on; }

export function setDev(next: boolean): void {
  try { if (next) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* private mode: this load only */ }
  if (next === on) return;
  on = next;
  mirror();
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function onDev(fn: (on: boolean) => void): () => void {
  const h = (): void => { fn(on); };
  window.addEventListener(EVENT, h);
  return () => { window.removeEventListener(EVENT, h); };
}

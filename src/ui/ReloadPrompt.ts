/**
 * The reload prompt (E65 Look Lab): a pick that only takes effect on a fresh page (the lighting model, the sky) asks
 * right away — "Needs a reload · Reload now / Later" — instead of leaving a note to go and find an Apply button.
 *
 *   setPoseProvider(() => ({ x, y, z, yaw, pitch }) | null)   // main.ts, once: where the player stands
 *   askReload(panel, 'Lighting', 'game')                       // pause menu: Reload now lands back in the world, right there
 *   askReload(panel, 'Lighting', 'title')                      // main menu ▸ Settings: Reload now lands on the title
 *
 * 'game' comes back with `?at=x,y,z,yaw,pitch` (the pose the GPU-recovery reload carries too, src/core/GpuRecovery.ts)
 * plus `?skipintro=1`, so the page skips the title and drops the player where they stood.
 * Either way the saved picks win: settingsReloadUrl drops any address param that would override them.
 * "Later" just closes the prompt — the pick is saved and applies on the next load.
 */
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { settingsReloadUrl } from './Settings';
import './styles/reload.css';

interface Pose { x: number; y: number; z: number; yaw: number; pitch: number }
let poseOf: () => Pose | null = () => null;
/** where the player stands now (null before ENTER WORLD): main.ts registers it next to installGpuRecovery */
export function setPoseProvider(fn: () => Pose | null): void { poseOf = fn; }
/** where the player stands now (null before ENTER WORLD, or if asking throws): the error modal's RELOAD HERE and error reports (E133) */
export function currentPose(): Pose | null { try { return poseOf(); } catch { return null; } }

/** params that skip the title (dev / deep links): a 'title' reload drops them so it lands on the title */
const TITLE_SKIPPERS = ['skipintro', 'tour', 'showcase', 'nolock', 'x', 'z', 'yaw', 'pitch', 'at', RELOAD_PARAM];

/** reload the page with the saved picks; 'game' comes back into the world where the player stands */
export function reloadWithPicks(to: 'game' | 'title'): void {
  const url = new URL(settingsReloadUrl(location.href, to === 'title' ? TITLE_SKIPPERS : []));
  url.searchParams.delete('v');
  const pose = to === 'game' ? poseOf() : null;
  if (pose) {
    url.searchParams.set('at', [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => (Math.round(v * 100) / 100).toString()).join(','));
    url.searchParams.set('skipintro', '1');
  }
  location.replace(url.toString());
}

let open: HTMLElement | null = null;
/**
 * Ask once, right where the pick was made: a small sheet over `host` with RELOAD NOW / LATER. A second pick while it is
 * up just rewrites its line (one prompt, the latest picks).
 */
export function askReload(host: HTMLElement, what: string, to: 'game' | 'title'): void {
  const line = to === 'game'
    ? `${what} needs a reload. You’ll come back right here, paused.`
    : `${what} needs a reload to apply.`;
  if (open?.isConnected) { const t = open.querySelector('.ws-reload-text'); if (t) t.textContent = line; return; }
  const sheet = document.createElement('div');
  sheet.className = 'ws-reload';
  sheet.setAttribute('role', 'alertdialog');
  sheet.setAttribute('aria-live', 'polite');
  const text = document.createElement('p'); text.className = 'ws-reload-text'; text.textContent = line;
  const go = document.createElement('button'); go.type = 'button'; go.className = 'ws-reload-go'; go.textContent = 'Reload now';
  const later = document.createElement('button'); later.type = 'button'; later.className = 'ws-reload-later'; later.textContent = 'Later';
  const row = document.createElement('div'); row.className = 'ws-reload-row'; row.append(later, go);
  sheet.append(text, row);
  go.addEventListener('click', (e) => { e.stopPropagation(); go.disabled = true; go.textContent = 'Reloading…'; reloadWithPicks(to); });
  later.addEventListener('click', (e) => { e.stopPropagation(); sheet.remove(); open = null; });
  host.append(sheet);
  open = sheet;
  go.focus();
}

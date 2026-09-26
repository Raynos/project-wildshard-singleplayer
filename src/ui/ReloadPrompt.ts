/**
 * The reload prompt (E65 Look Lab): a pick that only takes effect on a fresh page (the lighting model, the sky) asks
 * right away — "Needs a reload · Reload now / Later" — instead of leaving a note to go and find an Apply button.
 *
 *   setPoseProvider(() => ({ x, y, z, yaw, pitch }) | null)   // main.ts, once: where the player stands (currentPose)
 *   askReload(panel, 'Render scale')                           // main menu ▸ Settings: Reload now lands on the title
 *
 * The saved picks win: settingsReloadUrl drops any address param that would override them. (The pause-menu variant that
 * came back into the world had no caller left and is gone — E140, dead item 10.)
 * "Later" just closes the prompt — the pick is saved and applies on the next load.
 */
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { settingsReloadUrl } from './Settings';
import './styles/reload.css';
import { shardSlot } from '../core/shardState';
import { markUnload } from '../boot/lastEnd';

interface Pose { x: number; y: number; z: number; yaw: number; pitch: number }
let poseOf: () => Pose | null = () => null;
/** where the player stands now (null before ENTER WORLD): main.ts registers it next to installGpuRecovery */
export function setPoseProvider(fn: () => Pose | null): void { poseOf = fn; }
/** where the player stands now (null before ENTER WORLD, or if asking throws): the error modal's RELOAD HERE and error reports (E133) */
export function currentPose(): Pose | null { try { return poseOf(); } catch { return null; } }

/** params that skip the title (dev / deep links): the reload drops them so it lands on the title */
const TITLE_SKIPPERS = ['skipintro', 'tour', 'showcase', 'nolock', 'x', 'z', 'yaw', 'pitch', 'at', RELOAD_PARAM];

/** reload the page with the saved picks, on the title */
export function reloadWithPicks(why = 'reload prompt: reload now'): void {
  const url = new URL(settingsReloadUrl(location.href, TITLE_SKIPPERS));
  url.searchParams.delete('v');
  markUnload(why);
  location.replace(url.toString());
}

let open: HTMLElement | null = null;
/**
 * Ask once, right where the pick was made: a small sheet over `host` with RELOAD NOW / LATER. A second pick while it is
 * up just rewrites its line (one prompt, the latest picks).
 */
export function askReload(host: HTMLElement, what: string): void {
  const line = `${what} needs a reload to apply.`;
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
  go.addEventListener('click', (e) => { e.stopPropagation(); go.disabled = true; go.textContent = 'Reloading…'; reloadWithPicks(); });
  later.addEventListener('click', (e) => { e.stopPropagation(); sheet.remove(); open = null; });
  host.append(sheet);
  open = sheet;
  go.focus();
}

// E155 (src/core/shardState.ts): the running shard's pose
shardSlot('reloadPrompt.pose', () => poseOf, (v) => { poseOf = v; });

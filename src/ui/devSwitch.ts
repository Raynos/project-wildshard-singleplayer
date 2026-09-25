/**
 * Settings ▸ DEVELOPER (E140, the user's 1c): the one visible switch for developer mode (src/core/devMode.ts), in the pause
 * menu's Settings (src/ui/Menu.ts) and the title's (src/ui/BootSettings.ts). Styled by gmenu.css like every other switch.
 */
import { isDev, onDev, setDev } from '../core/devMode';

export function devSwitchRows(): HTMLElement[] {
  const label = document.createElement('div');
  label.className = 'ws-gmenu-label';
  label.textContent = 'Developer';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ws-gmenu-switch';
  b.setAttribute('role', 'switch');
  b.innerHTML = '<span class="ws-gmenu-swlabel">Developer mode</span><i class="ws-gmenu-pill"></i>';
  const sync = (on: boolean): void => { b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); };
  sync(isDev()); onDev(sync);
  b.addEventListener('click', () => { setDev(!isDev()); });
  const note = document.createElement('div');
  note.className = 'ws-gmenu-note';
  note.textContent = 'Shows the frame meter, the build id, the loading details and the Debug settings.';
  return [label, b, note];
}

/**
 * A compact DEV toggle outside Settings (E140, the user: "a little toggle, compact, small … not have to go into the settings"):
 * the title's bottom row, beside SOUND ON (src/ui/HUD.ts), and the pause menu's header (src/ui/Menu.ts). `el` carries the look;
 * this wires it: `off` class + aria-checked follow developer mode, a tap flips it. Stops listening once `el` leaves the page.
 */
export function bindDevToggle(el: HTMLElement): void {
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-label', 'Developer mode');
  const sync = (on: boolean): void => { el.classList.toggle('off', !on); el.setAttribute('aria-checked', String(on)); };
  sync(isDev());
  const off = onDev((on) => { if (el.isConnected) sync(on); else off(); });
  el.addEventListener('click', (e) => { e.stopPropagation(); setDev(!isDev()); });
}

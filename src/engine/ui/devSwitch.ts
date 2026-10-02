import { uiScope } from './ownership';
import { engineString } from '#engine/strings';
/**
 * Settings ▸ DEVELOPER (E140, the user's 1c): the one visible switch for developer mode (src/engine/core/devMode.ts), in the pause
 * menu's Settings (src/engine/ui/Menu.ts) and the title's (src/engine/ui/BootSettings.ts). Styled by gmenu.css like every other switch.
 * (The compact DEV pill on the title and in the menu header is gone — E318, Jake: cut; this is the one switch.)
 */
import { isDev, onDev, setDev } from '../core/devMode';

export function devSwitchRows(): HTMLElement[] {
  const scope = uiScope('devSwitch');
  const label = document.createElement('div');
  label.className = 'ws-gmenu-label';
  label.textContent = engineString('s_3fb7b39416f1');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ws-gmenu-switch';
  b.setAttribute('role', 'switch');
  b.innerHTML = engineString('s_008ede743530');
  const sync = (on: boolean): void => { b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); };
  sync(isDev()); scope.onDispose(onDev(sync));
  // A tap must repaint its own switch even if a page subscriber is rebuilt during notification.
  // Native click also covers touch activation and keyboard activation, without double-toggling.
  scope.listen(b, 'click', () => { setDev(!isDev()); sync(isDev()); });
  const note = document.createElement('div');
  note.className = 'ws-gmenu-note';
  note.textContent = engineString('s_f427cd6641a5');
  return [label, b, note];
}


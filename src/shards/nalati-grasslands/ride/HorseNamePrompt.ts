import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { UiHandle } from '@wildshard/engine/ui/layers';
import { uiScope, mountUi } from '@wildshard/engine/ui/ownership';
import './ride.css';
import { cleanHorseName, HORSE_NAME_MAX } from './horseNames';

/**
 * The hitching rail's NAME prompt (NALATI-FINISH B1, N13 "renaming the horse at the rail"): a small glass panel in the
 * HUD's language — a cyan-hairlined box, a letter-spaced caption, one text field and CANCEL / SAVE — high on the screen so
 * the phone's keyboard never covers it. The world keeps running behind it (you stand at the rail). Keys typed into it
 * never reach the game — keydowns stop at the root; keyups pass, so a key held when it opened (W) is released, not stuck
 * (the Journal's rule, E328) — and the E that opened it is not typed into the field (input in its first 150 ms is
 * dropped); Enter saves, Esc cancels. The field is focused
 * in the tap / key that opened it, so iOS raises its keyboard. Its font is 16 px: iOS zooms the page on a smaller field.
 *
 *   const prompt = new HorseNamePrompt();
 *   prompt.open('Camp horse', (name) => mount.rename(horse, name))   // `name` is cleaned (horseNames.ts), never empty
 *   prompt.isOpen
 */
export class HorseNamePrompt {
  private viewScope: Scope | null = null;
  private layer: UiHandle | null = null;
  private root: HTMLElement | null = null;
  get isOpen(): boolean { return this.layer?.active === true; }

  open(current: string, onSave: (name: string) => void): void {
    this.close();
    const scope = uiScope('horseName'); this.viewScope = scope;
    const root = document.createElement('div');
    root.className = 'ws-glass ws-ride-namebox';
    const cap = document.createElement('div');
    cap.className = 'ws-ride-namecap'; cap.textContent = 'Name your horse';
    const input = document.createElement('input');
    input.className = 'ws-ride-nameinput'; input.type = 'text'; input.maxLength = HORSE_NAME_MAX; input.value = current;
    input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('autocapitalize', 'words'); input.setAttribute('enterkeyhint', 'done'); input.setAttribute('aria-label', 'Horse name');
    const row = document.createElement('div');
    row.className = 'ws-ride-namebtns';
    const cancel = document.createElement('button'), save = document.createElement('button');
    cancel.type = 'button'; save.type = 'button';
    cancel.className = 'ws-ride-namebtn'; save.className = 'ws-ride-namebtn ok';
    cancel.textContent = 'Cancel'; save.textContent = 'Save';
    row.append(cancel, save);
    root.append(cap, input, row);
    const done = (ok: boolean): void => {
      const name = cleanHorseName(input.value);
      this.close();
      if (ok && name.length > 0) onSave(name);
    };
    for (const t of ['keydown', 'keypress'] as const) {
      scope.listen(root, t, (e) => {
        e.stopPropagation();
        if (t !== 'keydown' || !(e instanceof KeyboardEvent)) return;
        if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); done(true); } 
      });
    }
    // the USE key that opened the box lands its character in the field it focused: drop what arrives in the first 150 ms
    const opened = performance.now();
    scope.listen(input, 'beforeinput', (e) => { if (performance.now() - opened < 150) e.preventDefault(); });
    for (const t of ['pointerdown', 'touchstart', 'mousedown'] as const) scope.listen(root, t, (e) => { e.stopPropagation(); });
    scope.listen(cancel, 'click', () => { done(false); });
    scope.listen(save, 'click', () => { done(true); });
    mountUi(root, scope);
    this.layer = app.ui.push('modal', { root, order: -20, back: () => { done(false); } }, scope);
    this.root = root;
    input.focus();
    input.select();
  }

  close(): void {
    const r = this.root;
    this.root = null;
    if (r === null) return;
    const f = document.activeElement;
    if (f instanceof HTMLElement && r.contains(f)) f.blur();
    this.layer?.dispose(); this.layer = null; this.viewScope?.dispose(); this.viewScope = null;
    r.remove();
  }
}

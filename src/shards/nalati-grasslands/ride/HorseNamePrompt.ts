import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { UiHandle } from '@wildshard/engine/ui/layers';
import { declarePanel, mountPanel, panelScope, type PanelNode, type PanelView } from '@wildshard/sdk/panels';
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
 * A declared panel (SHARD-PLATFORM SF28): `nameBox` is its content as data.
 *
 *   const prompt = new HorseNamePrompt();
 *   prompt.open('Camp horse', (name) => mount.rename(horse, name))   // `name` is cleaned (horseNames.ts), never empty
 *   prompt.isOpen
 */
export function nameBox(current: string): PanelNode {
  return { cls: 'ws-glass ws-ride-namebox', children: [
    { cls: 'ws-ride-namecap', text: 'Name your horse' },
    { tag: 'input', cls: 'ws-ride-nameinput', ref: 'input',
      input: { type: 'text', maxLength: HORSE_NAME_MAX, value: current, autocomplete: 'off', spellcheck: false },
      attrs: [['autocapitalize', 'words'], ['enterkeyhint', 'done'], ['aria-label', 'Horse name']] },
    { cls: 'ws-ride-namebtns', children: [
      { tag: 'button', button: 'button', cls: 'ws-ride-namebtn', text: 'Cancel', ref: 'cancel' },
      { tag: 'button', button: 'button', cls: 'ws-ride-namebtn ok', text: 'Save', ref: 'save' },
    ] },
  ] };
}

export class HorseNamePrompt {
  private viewScope: Scope | null = null;
  private layer: UiHandle | null = null;
  private view: PanelView | null = null;
  get isOpen(): boolean { return this.layer?.active === true; }

  open(current: string, onSave: (name: string) => void): void {
    this.close();
    const scope = panelScope('horseName'); this.viewScope = scope;
    const view = declarePanel(nameBox(current));
    const done = (ok: boolean): void => {
      const name = cleanHorseName(view.value('input'));
      this.close();
      if (ok && name.length > 0) onSave(name);
    };
    for (const t of ['keydown', 'keypress'] as const) {
      view.on('', t, (e) => {
        e.stopPropagation();
        if (t !== 'keydown' || !(e instanceof KeyboardEvent)) return;
        if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); done(true); }
      }, scope);
    }
    // the USE key that opened the box lands its character in the field it focused: drop what arrives in the first 150 ms
    const opened = performance.now();
    view.on('input', 'beforeinput', (e) => { if (performance.now() - opened < 150) e.preventDefault(); }, scope);
    for (const t of ['pointerdown', 'touchstart', 'mousedown'] as const) view.on('', t, (e) => { e.stopPropagation(); }, scope);
    view.on('cancel', 'click', () => { done(false); }, scope);
    view.on('save', 'click', () => { done(true); }, scope);
    mountPanel(view, scope);
    this.layer = app.ui.push('modal', { root: view.root, order: -20, back: () => { done(false); } }, scope);
    this.view = view;
    view.select('input');
  }

  close(): void {
    const v = this.view;
    this.view = null;
    if (v === null) return;
    v.blur();
    this.layer?.dispose(); this.layer = null; this.viewScope?.dispose(); this.viewScope = null;
    v.remove();
  }
}

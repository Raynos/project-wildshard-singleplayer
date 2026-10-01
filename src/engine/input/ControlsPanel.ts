import { app } from '../app/runtime';
import { engineString } from '../strings';
import type { Scope } from '../app/scope';
import type { Action } from './InputService';

/** Keyboard/mouse rebinding lives in Settings; a conflict offers an explicit swap. */
export function buildControlsPanel(parent: Scope): HTMLDivElement & { refresh: () => void } {
  const scope = parent.child('controls'), input = app.input;
  // Primary fine-pointer mode includes laptops with touchscreens, but excludes touch-only
  // devices even when their browser requests a desktop site. Viewport size is not a keyboard.
  const desktop = window.matchMedia('(pointer: fine)');
  const card = document.createElement('div'); card.className = 'ws-gmenu-card ws-controls';
  const title = document.createElement('div'); title.className = 'ws-gmenu-cardtitle'; title.textContent = engineString('s_f4fce9bc331d');
  const note = document.createElement('div'); note.className = 'ws-gmenu-note'; note.textContent = engineString('s_7738e78a7360');
  const list = document.createElement('div'), status = document.createElement('div'); status.className = 'ws-gmenu-note'; status.setAttribute('role', 'status');
  const conflict = document.createElement('div'); conflict.className = 'ws-gmenu-row';
  let capture: Scope | null = null, rows = scope.child('rows');
  const button = (text: string, run: () => void, owner: Scope): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ws-gmenu-btn'; b.textContent = text; owner.listen(b, 'click', run); return b;
  };
  const cancel = (): void => { capture?.dispose(); capture = null; status.textContent = ''; conflict.replaceChildren(); };
  const rebind = (context: string, action: Action): void => {
    cancel(); capture = scope.child('capture'); status.textContent = engineString('s_8f54cf405740');
    input.captureNextKey((code) => {
      const other = input.bindings.rebind(context, action, code);
      if (other === undefined) { cancel(); refresh(); return; }
      status.textContent = engineString('s_632fe896901d', [other]);
      const owner = capture; if (owner === null) return;
      conflict.append(button(engineString('s_4e7f483dadbe'), () => { input.bindings.rebind(context, action, code, true); cancel(); refresh(); }, owner), button(engineString('s_8097ea62e33b'), cancel, owner));
    }, capture);
  };
  function refresh(): void {
    card.hidden = !desktop.matches; card.inert = card.hidden;
    if (card.hidden) { cancel(); return; }
    rows.dispose(); rows = scope.child('rows'); list.replaceChildren();
    for (const entry of input.bindings.entries()) {
      if (!['onFoot', 'swim', 'board'].includes(entry.context) && !entry.context.startsWith('weapon.')) continue;
      const row = document.createElement('div'); row.className = 'ws-gmenu-row';
      const label = document.createElement('span'); label.textContent = engineString('s_input_binding', [entry.context, entry.action]);
      row.append(label, button(entry.codes.map((code) => code.replace(/^Key|^Digit/u, '')).join(' / '), () => { rebind(entry.context, entry.action); }, rows)); list.append(row);
    }
  };
  card.append(title, note, list, status, conflict, button(engineString('s_dd7d08f05555'), () => { cancel(); input.bindings.reset(); refresh(); }, scope));
  scope.listen(desktop, 'change', refresh);
  scope.onDispose(() => { capture?.dispose(); card.remove(); }); refresh();
  return Object.assign(card, { refresh });
}

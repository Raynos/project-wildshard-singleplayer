/**
 * G531 (Jake: "less clutter"): SHARD SELECT shows each shard's shardfile entry only, in the public build and in Developer.
 * One Developer-tools row, Settings ▸ Debug ▸ Legacy shard buttons (default off), brings SF65's LEGACY / SHARDFILE pair back
 * on every card. Outside Developer it reads off and a saved pick waits for the next developer session.
 * The row and the legacy buttons are deleted with the legacy copies (SHARD-PLATFORM-NEXT N5).
 *
 *   installLegacyButtonsRow()   // the composition root and the session, once a page (idempotent)
 *   legacyButtons()             // the deck and the boot: Developer on and the row on
 *   onLegacyButtons(fn)         // the deck repaints when it changes
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import type { DebugRowSpec } from '@wildshard/engine/level/context';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { isDev, onDev } from '@wildshard/engine/core/devMode';
import { GAME_STRINGS } from '../strings';

const ON = 'on', OFF = 'off';
const listeners = new Set<() => void>();
const notify = (): void => { for (const fn of listeners) fn(); };
let slot: ReturnType<typeof jsonSlot> | null = null;
const store = (): ReturnType<typeof jsonSlot> => (slot ??= jsonSlot('debug.global.legacyShardButtons', 'device'));
/** The saved pick, readable before the row is installed (the boot asks before the session registers it). */
function saved(): string {
  try { return store().read() === ON ? ON : OFF; } catch { return OFF; }
}

/** A game-wide Developer-tools row over the device save (the shape of a shard's `ctx.debugRow` spec). */
function developerRow(spec: Omit<DebugRowSpec, 'reload'> & { readonly purpose: 'developer' }): void {
  const row: DebugRow = { purpose: spec.purpose, id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: () => (isDev() ? saved() : spec.initial),
    set: (next) => { if (!isDev() || !spec.choices.some((choice) => choice.value === next)) return; store().write(next); spec.change(next); },
    on: (fn) => { listeners.add(fn); }, when: () => true };
  authoredRows.add(row);
}
const rows = { debugRow: developerRow };

let installed = false;
/** Register the row once a page; it lives as long as the page (the title and every pause ▸ Settings show it). */
export function installLegacyButtonsRow(): void {
  if (installed) return;
  installed = true;
  const text = GAME_STRINGS.entry.legacyRow;
  rows.debugRow({
    purpose: 'developer', id: 'legacyShardButtons', group: 'tools', label: text.label, note: text.note, ask: 'E435', reviewBy: '2026-12-30',
    choices: [{ value: OFF, text: text.off }, { value: ON, text: text.on }], initial: OFF, change: notify,
  });
  onDev(notify);
}

/** Whether SHARD SELECT offers the LEGACY buttons (and the boot honours a LEGACY pick): Developer on and the row on. */
export function legacyButtons(): boolean { return isDev() && saved() === ON; }

/** Run `fn` when `legacyButtons()` may have changed; the returned function stops it. */
export function onLegacyButtons(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

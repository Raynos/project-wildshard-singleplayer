/**
 * G685's comparison (Jake's pick A, toon cel cumulus, on art/clouds/round-1-three-styles): a toon sky whose clouds row
 * declares a `toon` variant draws its faceted ring (A, today's, the default) or the toon cumulus (B), picked live in one
 * Settings ▸ Debug row while such a sky is up. No shard is named here: the look row's data opts in. Jake's pick deletes
 * this module, the field and the losing clouds.
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import type { DebugRowSpec } from '@wildshard/engine/level/context';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import type { Scope } from '@wildshard/engine/app/scope';
import { GAME_STRINGS } from '../strings';

const ROW_ID = 'toonClouds';
const showing = new Set<(toon: boolean) => void>();
let remove: (() => void) | null = null, toon = false;

/** A game-wide live row over a device save (the shape of a shard's `ctx.debugRow` spec), until the returned function removes it. */
function globalRow(spec: Omit<DebugRowSpec, 'reload'>): () => void {
  const slot = jsonSlot(`debug.global.${spec.id}`, 'device'), listeners = new Set<() => void>();
  const read = (): string => { try { const value = slot.read(); return typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial; } catch { return spec.initial; } };
  let live = true;
  const row: DebugRow = { id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: read,
    set: (next) => { if (!live || !spec.choices.some((choice) => choice.value === next)) return; slot.write(next); spec.change(next); for (const fn of listeners) fn(); },
    on: (fn) => { if (live) listeners.add(fn); }, when: () => true };
  authoredRows.add(row); spec.change(read());
  return () => { live = false; authoredRows.delete(row); listeners.clear(); };
}
const rows = { debugRow: globalRow };

/** Show the row while `scope` lives (shared by every toon sky up at once) and call `show` with the pick now and on each change. */
export function installToonCloudsRow(scope: Scope, show: (toon: boolean) => void): void {
  showing.add(show);
  if (remove === null) {
    const text = GAME_STRINGS.toonClouds;
    remove = rows.debugRow({
      id: ROW_ID, group: 'look', label: text.label, note: text.note, ask: 'E453', reviewBy: '2026-12-30',
      choices: [{ value: 'faceted', text: text.faceted }, { value: 'toon', text: text.toon }], initial: 'faceted',
      change: (value) => { toon = value === 'toon'; for (const fn of showing) fn(toon); },
    });
  } else show(toon);
  scope.onDispose(() => {
    showing.delete(show);
    if (showing.size > 0) return;
    remove?.(); remove = null; toon = false;
  });
}

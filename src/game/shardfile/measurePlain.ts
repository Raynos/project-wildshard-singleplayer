/**
 * The dev-map look's clay variant (G527): a shardfile whose PBR measure layer declares `plainVariant` (Template 2's
 * Blender clay under its dev map) shows one Settings ▸ Debug row while it is loaded (SHARD SELECT or a grid slot). Dev
 * map is the default; Clay draws those surfaces' own vertex colours. Live (one shader uniform, no reload). No shard is
 * named here: the shard's data opts in. Jake's pick deletes this module, the field and the losing look.
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import type { DebugRowSpec } from '@wildshard/engine/level/context';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { setMeasurePlain } from '@wildshard/engine/render/families/measure';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { GAME_STRINGS } from '../strings';

/** whether a shardfile's look offers the clay variant of its measure layer */
export function offersMeasurePlain(shard: Pick<Shardfile, 'look'>): boolean {
  return Object.values(shard.look.materials).some((entry) => entry.family === 'pbr' && entry.measure?.plainVariant === true);
}

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

let holders = 0, remove: (() => void) | null = null;
/** Show the row while `scope` lives (shared by every loaded shardfile that offers it) and apply its saved value. */
export function installMeasurePlainRow(scope: Scope): void {
  const text = GAME_STRINGS.measurePlain;
  if (holders++ === 0) remove = rows.debugRow({
    id: 'measurePlain', group: 'look', label: text.label, note: text.note, ask: 'E435', reviewBy: '2026-12-30',
    choices: [{ value: 'devmap', text: text.devMap }, { value: 'clay', text: text.clay }], initial: 'devmap',
    change: (value) => { setMeasurePlain(value === 'clay'); },
  });
  scope.onDispose(() => { if (--holders > 0) return; remove?.(); remove = null; setMeasurePlain(false); });
}

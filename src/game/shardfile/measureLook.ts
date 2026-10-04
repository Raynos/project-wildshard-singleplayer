/**
 * The measure look's Settings ▸ Debug row (SHARD-PLATFORM SF56, G152, E444): a shardfile whose look declares a PBR
 * `measure` layer (Template 1's dev-map orange, grey and 1 m grid) draws it only while this row is on; off (the default
 * until Jake picks from the before / after board) it keeps its plain look. A game-wide row over a device save, shown while
 * any such shardfile is loaded (SHARD SELECT or a grid slot), live (a uniform, no reload). No shard is named here: the
 * shard's data opts in.
 */
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import type { DebugRowSpec } from '@wildshard/engine/level/context';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { setMeasureLook } from '@wildshard/engine/render/families/measure';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Shardfile } from './schema';

/** A game-wide row over a device save (the shape of a shard's `ctx.debugRow` spec), until the returned function removes it. */
function globalRow(spec: Omit<DebugRowSpec, 'reload'>): () => void {
  const slot = jsonSlot(`debug.global.${spec.id}`, 'device');
  const read = (): string => { try { const value = slot.read(); return typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial; } catch { return spec.initial; } };
  const listeners = new Set<() => void>();
  let live = true;
  const row: DebugRow = {
    id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: read,
    set: (next) => { if (!live || !spec.choices.some((choice) => choice.value === next)) return; slot.write(next); spec.change(next); for (const fn of listeners) fn(); },
    on: (fn) => { if (live) listeners.add(fn); }, when: () => true,
  };
  authoredRows.add(row);
  spec.change(read());
  return () => { live = false; authoredRows.delete(row); listeners.clear(); };
}
const rows = { debugRow: globalRow };

/** whether a shardfile's look declares a measure layer on any of its materials */
export function declaresMeasure(shard: Pick<Shardfile, 'look'>): boolean {
  return Object.values(shard.look.materials).some((entry) => entry.family === 'pbr' && entry.measure !== null);
}

let holders = 0, remove: (() => void) | null = null;
/** Show the row while `scope` lives (shared by every loaded measure shardfile) and apply its saved value. */
export function installMeasureLookRow(scope: Scope): void {
  if (holders++ === 0) remove = rows.debugRow({
    id: 'measureLook', group: 'look', label: 'Dev-map look (measure grid)',
    choices: [{ value: 'off', text: 'Plain' }, { value: 'on', text: 'Dev map' }], initial: 'off',
    change: (value) => { setMeasureLook(value === 'on'); },
    note: 'SF56: shardfiles that declare a measure layer (Template 1) draw orange / grey with a 1 m grid and size labels.', ask: 'E444', reviewBy: '2026-12-30',
  });
  scope.onDispose(() => { if (--holders > 0) return; remove?.(); remove = null; setMeasureLook(false); });
}

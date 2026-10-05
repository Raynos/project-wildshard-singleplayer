import catalogue from './singleplayer.json' with { type: 'json' };
import { parseGridCatalogue } from './catalogue';
import { authoredRows } from '@wildshard/engine/ui/authoredDebugRows';
import type { DebugRow } from '@wildshard/engine/ui/debugOptions';
import { jsonSlot } from '@wildshard/engine/saves/slots';
import { findShard } from '../shard/registry';
import { DEVSERVER } from './menu';
import { GAME_STRINGS } from '../strings';
/**
 * The DEVSERVER cell's Settings ▸ Debug row (SHARD-PLATFORM §3.3, SF21a): in a DEVSERVER build the catalogue's
 * `devserver` placement (Nine Dragon at (+1, −1)) replaces a template in EXPERIMENTAL Wildshard, on by default; this row
 * swaps it back to the template. It applies at the next grid start (A17, C23), never live. The row shows on the title's
 * Settings and in game, and only in a DEVSERVER build (never a URL switch).
 */
const ROW_ID = 'gridDevserverCell';
/** a pick over a device save (the shape of a shard's `ctx.debugRow` spec) */
interface GlobalRowSpec extends Pick<DebugRow, 'id' | 'group' | 'label' | 'note' | 'ask' | 'reviewBy'> {
  choices: readonly { value: string; text: string }[]; initial: string; change: (value: string) => void; reload?: boolean;
}
const saved = (id: string = ROW_ID): ReturnType<typeof jsonSlot> => jsonSlot(`debug.global.${id}`, 'device');

/** the row's value: true keeps the `devserver` cell in the grid (the default) */
export function devserverCellOn(devserver: boolean = DEVSERVER): boolean {
  if (!devserver) return false;
  try { return saved().read() !== 'off'; } catch { return true; }
}

/** G144's risky live-admission change remains opt-in until a truthful home enters and the grid proof is green. */
export function gridMemoryAdmissionOn(): boolean {
  try { return saved('gridMemoryAdmission').read() === 'on'; } catch { return false; }
}

/** A game-wide row over a device save: shown wherever Settings ▸ Debug opens, until the returned function removes it. */
function globalRow(spec: GlobalRowSpec): () => void {
  const slot = saved(spec.id);
  const read = (): string => { const value = slot.read(); return typeof value === 'string' && spec.choices.some((choice) => choice.value === value) ? value : spec.initial; };
  const listeners = new Set<() => void>();
  let live = true;
  const row: DebugRow = {
    id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy, reload: spec.reload ?? false,
    choices: () => spec.choices.map((choice) => ({ v: choice.value, text: choice.text })), get: read,
    set: (next) => { if (!live || !spec.choices.some((choice) => choice.value === next)) return; slot.write(next); spec.change(next); for (const fn of listeners) fn(); },
    on: (fn) => { if (live) listeners.add(fn); }, when: () => true,
  };
  authoredRows.add(row);
  return () => { live = false; authoredRows.delete(row); listeners.clear(); };
}
const grid = { debugRow: globalRow };

/** Install the row (a DEVSERVER build only); the title and the session each call it once and dispose it with their scope. */
export function installGridDebug(devserver: boolean = DEVSERVER): () => void {
  const strings = GAME_STRINGS.grid;
  const removeMemory = grid.debugRow({
    id: 'gridMemoryAdmission', group: 'loading', label: strings.memoryAdmission,
    choices: [{ value: 'off', text: strings.off }, { value: 'on', text: strings.on }], initial: 'off', reload: true,
    change: () => undefined, note: strings.memoryAdmissionNote, ask: 'E435', reviewBy: '2026-12-30',
  });
  const cell = parseGridCatalogue(catalogue.grid).devserver[0];
  if (!devserver || cell === undefined) return () => { removeMemory(); };
  const name = findShard(cell.slug)?.name ?? cell.slug;
  const removeCell = grid.debugRow({
    id: 'gridDevserverCell', group: 'tools', label: strings.devserverCell(cell.cell[0], cell.cell[1]),
    choices: [{ value: 'on', text: name }, { value: 'off', text: strings.template }], initial: 'on', change: () => undefined,
    note: strings.devserverCellNote, ask: 'E435', reviewBy: '2026-12-30',
  });
  return () => { removeCell(); removeMemory(); };
}

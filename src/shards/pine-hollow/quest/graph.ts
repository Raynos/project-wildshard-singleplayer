import type { InteractTable } from '@wildshard/engine/world/interact/types';
import { compileQuestTable, parseQuestGraph } from '@wildshard/sdk/questGraph';
import { parseInteractionRows } from '@wildshard/sdk/interactions';

/** The existing command protocol; the modal/ride keeper owns delivery and continuation. */
export const PINE_GRAPH = parseQuestGraph({ actor: 'pine.interact', step: 'pine.quest.graph', actions: [] });
/** Stable row identities reused by the frame's action path without allocating command strings. */
export const PINE_LANTERN_IDS = { pond: 'lantern.pond', ridge: 'lantern.ridge', den: 'lantern.den' } as const;
/** Command bindings for the shipping latched puzzle, pickups and repeatable bench. */
export const PINE_TABLE_ACTIONS = [
  { id: 'dam-log-a', act: 1 }, { id: 'dam-log-b', act: 2 }, { id: 'pond-glass', act: 3 }, { id: 'ridge-flint', act: 4 },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `token-${i + 1}`, act: 10 + i })), { id: 'lookout-bench', act: 18 },
] as const;
/** Authored lantern requirements and their one-way commits, consumed on both page and native. */
export const PINE_LANTERN_ROWS = [
  { id: 'lantern.pond', act: 5, at: 'lantern.pond', needs: [{ none: ['lit:pond'] }, { all: ['taken:pond-glass'] }], sets: ['lit:pond'] },
  { id: 'lantern.ridge', act: 6, at: 'lantern.ridge', needs: [{ none: ['lit:ridge'] }, { all: ['taken:ridge-flint'] }], sets: ['lit:ridge'] },
  { id: 'lantern.den', act: 7, at: 'lantern.den', needs: [{ none: ['lit:den'] }, { all: ['talked:ranger'] }], sets: ['lit:den'] },
];
/** The table owns its flag vocabulary. Geometry, sitting, inventory, LOS and modal input keep their existing owners. */
export function pineQuestRows(table: InteractTable): ReturnType<typeof parseInteractionRows> {
  const compiled = compileQuestTable(table, PINE_TABLE_ACTIONS);
  return parseInteractionRows({ ...compiled, rows: [...compiled.rows, ...PINE_LANTERN_ROWS] });
}

import type { InteractTable } from '@wildshard/engine/world/interact/types';
import { compileQuestTable, parseQuestGraph } from '@wildshard/sdk/questGraph';
import { parseInteractionRows } from '@wildshard/sdk/interactions';

import { PINE_GRAPH_DATA, PINE_TABLE_ACTIONS, PINE_LANTERN_ROWS } from '../data/interactions';

/** Admit the authored command protocol with the existing shared row parser. */
export const PINE_GRAPH = parseQuestGraph(PINE_GRAPH_DATA);
/** The table owns its flag vocabulary. Geometry, sitting, inventory, LOS and modal input keep their existing owners. */
export function pineQuestRows(table: InteractTable): ReturnType<typeof parseInteractionRows> {
  const compiled = compileQuestTable(table, PINE_TABLE_ACTIONS);
  return parseInteractionRows({ ...compiled, rows: [...compiled.rows, ...PINE_LANTERN_ROWS] });
}

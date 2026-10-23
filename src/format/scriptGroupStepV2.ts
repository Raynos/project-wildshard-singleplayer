/** H4 one-group projection layout. It is a transport declaration, not a group
 * installer, species policy or native effect dispatcher. */
import * as v from 'valibot';
import { isJsonData } from './json';
import { GroupBankV2Schema, groupBankWidthV2, parseGroupBankV2, type GroupBankFieldV2 } from './scriptGroupBankV2';
import { ObservationColumnsV2Schema, parseObservationColumnsV2, type ObservationColumnV2 } from './scriptObservationColumnsV2';
import { layoutV2, type V2Layout } from './scriptWireV2';

const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const word = v.pipe(natural, v.maxValue(3));
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
export interface GroupStepActionV2 {
  id: number;
  words: number;
  member?: number;
  reference?: { word: number; own?: boolean; nullable?: boolean };
}
export interface GroupStepRowsV2 {
  bank: GroupBankFieldV2[];
  columns: ObservationColumnV2[];
  members: number;
  signals: string[];
  actions: GroupStepActionV2[];
  outputs: number;
  pages: number;
  fuel: number;
  queries?: { pending: number; scalars: number };
}
export const GroupStepV2Schema: v.GenericSchema<GroupStepRowsV2> = v.strictObject({
  bank: GroupBankV2Schema, columns: ObservationColumnsV2Schema,
  members: v.pipe(natural, v.minValue(1), v.maxValue(16)),
  signals: v.pipe(v.array(name), v.minLength(1), v.maxLength(64)),
  actions: v.pipe(v.array(v.strictObject({ id: v.pipe(natural, v.minValue(1), v.maxValue(65535)),
    words: v.pipe(natural, v.maxValue(4)), member: v.exactOptional(word),
    reference: v.exactOptional(v.strictObject({ word, own: v.exactOptional(v.boolean()), nullable: v.exactOptional(v.boolean()) })) })), v.maxLength(128)),
  outputs: v.pipe(natural, v.minValue(1), v.maxValue(512)),
  pages: v.pipe(natural, v.minValue(1), v.maxValue(4)),
  fuel: v.pipe(natural, v.minValue(1), v.maxValue(400000)),
  queries: v.exactOptional(v.strictObject({ pending: v.pipe(natural, v.maxValue(64)), scalars: v.pipe(natural, v.maxValue(1024)) })),
});
export function groupStepLayoutV2(rows: GroupStepRowsV2): V2Layout {
  const width = rows.bank.reduce((sum, row) => sum + groupBankWidthV2(row), 0);
  return layoutV2(0, rows.pages, new Map([[1, 1], [2, width], [3, width], [4, 2], [5, 1],
    [6, rows.columns.length * rows.members], [10, rows.outputs], [11, (rows.queries?.pending ?? 0) * 7],
    [12, rows.queries?.pending ?? 0], [13, rows.queries?.scalars ?? 0], [21, 1], [22, 1]]));
}
/** Columns are flattened by member slot then lexicographic column name.
 * Authored per-member IDs do not share a namespace with these flat IDs. */
export function groupStepColumnV2(rows: GroupStepRowsV2, slot: number, columnName: string): number {
  const column = [...rows.columns].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).findIndex(row => row.name === columnName);
  if (!Number.isInteger(slot) || slot < 0 || slot >= rows.members || column === -1) throw new Error('Unknown group member column');
  return slot * rows.columns.length + column;
}
export function parseGroupStepV2(input: unknown): GroupStepRowsV2 {
  if (!isJsonData(input)) throw new Error('Group step requires JSON rows');
  const rows = v.parse(GroupStepV2Schema, input);
  parseGroupBankV2(rows.bank);
  parseObservationColumnsV2(rows.columns);
  if (new Set(rows.signals).size !== rows.signals.length || new Set(rows.actions.map(row => row.id)).size !== rows.actions.length)
    throw new Error('Duplicate group step declaration');
  for (const row of rows.actions) {
    if (row.member !== undefined && row.member >= row.words || row.reference !== undefined && row.reference.word >= row.words
      || row.member !== undefined && row.reference?.word === row.member) throw new Error('Invalid group action operands');
  }
  groupStepLayoutV2(rows);
  return rows;
}

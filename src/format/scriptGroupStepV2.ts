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
export interface GroupStepShapeV2 {
  bank: GroupBankFieldV2[];
  columns: ObservationColumnV2[];
  members: number;
  signals: string[];
  actions: GroupStepActionV2[];
}
export interface GroupStepProfileV2 extends GroupStepShapeV2 { id: string }
export interface GroupStepRowsV2 extends GroupStepShapeV2 {
  profiles?: GroupStepProfileV2[];
  outputs: number;
  pages: number;
  fuel: number;
  queries?: { pending: number; scalars: number };
}
const shape = {
  bank: GroupBankV2Schema, columns: ObservationColumnsV2Schema,
  members: v.pipe(natural, v.minValue(1), v.maxValue(16)),
  signals: v.pipe(v.array(name), v.minLength(1), v.maxLength(64)),
  actions: v.pipe(v.array(v.strictObject({ id: v.pipe(natural, v.minValue(1), v.maxValue(65535)),
    words: v.pipe(natural, v.maxValue(4)), member: v.exactOptional(word),
    reference: v.exactOptional(v.strictObject({ word, own: v.exactOptional(v.boolean()), nullable: v.exactOptional(v.boolean()) })) })), v.maxLength(128)),
};
const profileSchema: v.GenericSchema<GroupStepProfileV2> = v.strictObject({ id: name, ...shape });
export const GroupStepV2Schema: v.GenericSchema<GroupStepRowsV2> = v.strictObject({
  ...shape, profiles: v.exactOptional(v.pipe(v.array(profileSchema),v.minLength(1),v.maxLength(7))),
  outputs: v.pipe(natural, v.minValue(1), v.maxValue(512)),
  pages: v.pipe(natural, v.minValue(1), v.maxValue(4)),
  fuel: v.pipe(natural, v.minValue(1), v.maxValue(400000)),
  queries: v.exactOptional(v.strictObject({ pending: v.pipe(natural, v.maxValue(64)), scalars: v.pipe(natural, v.maxValue(1024)) })),
});
export function groupStepLayoutV2(rows: GroupStepRowsV2): V2Layout {
  const profiles = [rows, ...(rows.profiles ?? [])];
  const width = Math.max(...profiles.map(profile => profile.bank.reduce((sum, row) => sum + groupBankWidthV2(row), 0)));
  const fields = Math.max(...profiles.map(profile => profile.columns.length * profile.members));
  return layoutV2(0, rows.pages, new Map([[1, 1], [2, width], [3, width], [4, rows.profiles === undefined ? 2 : 3], [5, 1],
    [6, fields], [10, rows.outputs], [11, (rows.queries?.pending ?? 0) * 7],
    [12, rows.queries?.pending ?? 0], [13, rows.queries?.scalars ?? 0], [21, 1], [22, 1]]));
}
/** Columns are flattened by member slot then lexicographic column name.
 * Authored per-member IDs do not share a namespace with these flat IDs. */
export function groupStepProfileV2(rows: GroupStepRowsV2, id = 'main'): GroupStepShapeV2 {
  const profile = id === 'main' ? rows : rows.profiles?.find(row => row.id === id);
  if (profile === undefined) throw new Error('Unknown group step profile');
  return profile;
}
export function groupStepColumnV2(rows: GroupStepRowsV2, slot: number, columnName: string, id = 'main'): number {
  const profile = groupStepProfileV2(rows, id);
  const column = [...profile.columns].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).findIndex(row => row.name === columnName);
  if (!Number.isInteger(slot) || slot < 0 || slot >= profile.members || column === -1) throw new Error('Unknown group member column');
  return slot * profile.columns.length + column;
}
export function parseGroupStepV2(input: unknown): GroupStepRowsV2 {
  if (!isJsonData(input)) throw new Error('Group step requires JSON rows');
  const rows = v.parse(GroupStepV2Schema, input);
  const ids = ['main', ...(rows.profiles?.map(row => row.id) ?? [])];
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate group step profile');
  for (const profile of [rows, ...(rows.profiles ?? [])]) {
    parseGroupBankV2(profile.bank);
    parseObservationColumnsV2(profile.columns);
    if (new Set(profile.signals).size !== profile.signals.length || new Set(profile.actions.map(row => row.id)).size !== profile.actions.length)
      throw new Error('Duplicate group step declaration');
    for (const row of profile.actions) {
      if (row.member !== undefined && row.member >= row.words || row.reference !== undefined && row.reference.word >= row.words
        || row.member !== undefined && row.reference?.word === row.member) throw new Error('Invalid group action operands');
    }
  }
  groupStepLayoutV2(rows);
  return rows;
}

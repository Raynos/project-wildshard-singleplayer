/** H4 group continuation columns. The original group owns the bank and JSON
 * envelope; these rows only define a finite, reversible numeric representation. */
import * as v from 'valibot';
import { isJsonData } from './json';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128),
  v.regex(/^(?!(?:__proto__|prototype|constructor)$).+$/));
const finite = v.pipe(v.number(), v.finite());
const base = { name };
const field = v.variant('kind', [
  v.strictObject({ ...base, kind: v.literal('number'), integer: v.exactOptional(v.boolean()),
    min: v.exactOptional(finite), max: v.exactOptional(finite) }),
  v.strictObject({ ...base, kind: v.literal('boolean') }),
  v.strictObject({ ...base, kind: v.literal('enum'), values: v.pipe(v.array(name), v.minLength(1), v.maxLength(64)) }),
  v.strictObject({ ...base, kind: v.literal('nullable-number') }),
  v.strictObject({ ...base, kind: v.literal('reference'), own: v.exactOptional(v.boolean()) }),
  v.strictObject({ ...base, kind: v.literal('references'), own: v.exactOptional(v.boolean()),
    capacity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)) }),
]);
/** Explicit output types bound schema inference at this transport boundary. */
export type GroupBankFieldV2 =
  | { name: string; kind: 'number'; integer?: boolean; min?: number; max?: number }
  | { name: string; kind: 'boolean' }
  | { name: string; kind: 'enum'; values: string[] }
  | { name: string; kind: 'nullable-number' }
  | { name: string; kind: 'reference'; own?: boolean }
  | { name: string; kind: 'references'; own?: boolean; capacity: number };
export const GroupBankV2Schema: v.GenericSchema<GroupBankFieldV2[]> =
  v.pipe(v.array(field), v.minLength(1), v.maxLength(128));
/** A native, scoped reference loan gives the existing wire id an explicit
 * handle. Neither a species name nor a hash can manufacture this identity. */
export interface GroupBankReferenceV2 {
  readonly group: string;
  readonly slot: number;
  readonly identity: string;
  readonly wire: string;
  readonly handle: number;
}
export type GroupBankValueV2 = number | boolean | string | null | readonly string[];
export function groupBankWidthV2(row: GroupBankFieldV2): number {
  return row.kind === 'nullable-number' ? 2 : row.kind === 'references' ? row.capacity + 1 : 1;
}
export function parseGroupBankV2(input: unknown): GroupBankFieldV2[] {
  if (!isJsonData(input)) throw new Error('Group bank requires JSON rows');
  const rows = v.parse(GroupBankV2Schema, input);
  if (new Set(rows.map(row => row.name)).size !== rows.length) throw new Error('Duplicate group bank field');
  for (const row of rows) {
    if (row.kind === 'number' && row.min !== undefined && row.max !== undefined && row.min > row.max)
      throw new Error('Inverted group bank bound');
    if (row.kind === 'enum' && new Set(row.values).size !== row.values.length)
      throw new Error('Duplicate group bank enum');
  }
  return rows;
}

import * as v from 'valibot';
import generated from './entryFloors.generated.json' with { type: 'json' };
import { DRY_ENTRIES } from './entryRows';

const finite = v.pipe(v.number(), v.finite());
const extent = v.pipe(finite, v.minValue(0.005), v.maxValue(250));
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite,
  hx: extent, hy: extent, hz: extent, surface: v.literal('stone') });
const landing = v.strictObject({ edge: v.picklist(DRY_ENTRIES), box });
const transport = v.pipe(v.strictObject({ notice: v.pipe(v.string(), v.startsWith('DO NOT EDIT:')),
  rows: v.pipe(v.array(landing), v.length(4)) }),
  v.check(value => value.rows.every((row, index) => row.edge === DRY_ENTRIES[index]), 'original entry registration order'));
/** One immutable landing: the native world and shardfile consume the same admitted row. */
export type EntryLanding = v.InferOutput<typeof landing>;
/** Refuse malformed cached data before it reaches the native collider owner. */
function decodeEntryLandings(source: unknown): EntryLanding[] {
  return v.parse(transport, source).rows;
}
/** Native slabs compiled at build time; no runtime recipe or generator enters the client. */
export const ENTRY_LANDINGS: readonly EntryLanding[] = decodeEntryLandings(generated);

import * as v from 'valibot';
import generated from './entryDecks.generated.json' with { type: 'json' };
import { DRY_ENTRIES } from './entryRows';

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0.005), v.maxValue(500));
const rect = v.pipe(v.strictObject({ minX: finite, minZ: finite, maxX: finite, maxZ: finite }),
  v.check(row => row.minX < row.maxX && row.minZ < row.maxZ, 'positive footprint'));
const slab = v.strictObject({ x: finite, z: finite, hw: positive, hd: positive,
  rot: v.literal(0), yTop: v.literal(0), yBottom: v.literal(-0.55) });
const placement = v.strictObject({ x: finite, y: v.literal(0), z: finite, yaw: finite,
  params: v.strictObject({ run: v.literal(16.5), bed: v.pipe(finite, v.minValue(-14), v.maxValue(-0.4)) }) });
const row = v.strictObject({ edge: v.picklist(DRY_ENTRIES), rect, slab, placement });
const transport = v.pipe(v.strictObject({ notice: v.pipe(v.string(), v.startsWith('DO NOT EDIT:')),
  rows: v.pipe(v.array(row), v.length(4)) }),
  v.check(value => value.rows.every((item, index) => item.edge === DRY_ENTRIES[index]), 'original entry order'));
/** Refuse invalid cached placements before the existing geometry factory reads them. */
function decodeEntryDecks(source: unknown): v.InferOutput<typeof row>[] {
  return v.parse(transport, source).rows;
}
/** Original dry footprints, foam slabs and seabed-derived column placements. */
export const ENTRY_DECKS: readonly v.InferOutput<typeof row>[] = decodeEntryDecks(generated);

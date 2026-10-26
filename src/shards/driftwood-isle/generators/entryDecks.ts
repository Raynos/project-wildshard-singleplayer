import * as v from 'valibot';
import generated from '../data/entryDecks.generated.json' with { type: 'json' };
import authoredEntryRows from '../data/entryRows.json' with { type: 'json' };

const { DRY_ENTRIES } = authoredEntryRows;

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0.005), v.maxValue(500));
const rect = v.pipe(v.strictObject({ minX: finite, minZ: finite, maxX: finite, maxZ: finite }),
  v.check(row => row.minX < row.maxX && row.minZ < row.maxZ, 'positive footprint'));
const slab = v.strictObject({ x: finite, z: finite, hw: positive, hd: positive,
  rot: v.literal(0), yTop: v.literal(0), yBottom: v.literal(-0.55) });
const placement = v.strictObject({ x: finite, y: v.literal(0), z: finite, yaw: finite,
  params: v.strictObject({ run: v.literal(16.5), bed: v.pipe(finite, v.minValue(-14), v.maxValue(-0.4)) }) });
const row: v.StrictObjectSchema<{ readonly edge: v.PicklistSchema<["north", "east", "south", "west"], undefined>; readonly rect: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly minX: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly minZ: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly maxX: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly maxZ: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; }, undefined>, v.CheckAction<{ minX: number; minZ: number; maxX: number; maxZ: number; }, "positive footprint">]>; readonly slab: v.StrictObjectSchema<{ readonly x: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly z: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly hw: v.SchemaWithPipe<readonly [v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.MinValueAction<number, 0.005, undefined>, v.MaxValueAction<number, 500, undefined>]>; readonly hd: v.SchemaWithPipe<readonly [v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.MinValueAction<number, 0.005, undefined>, v.MaxValueAction<number, 500, undefined>]>; readonly rot: v.LiteralSchema<0, undefined>; readonly yTop: v.LiteralSchema<0, undefined>; readonly yBottom: v.LiteralSchema<-0.55, undefined>; }, undefined>; readonly placement: v.StrictObjectSchema<{ readonly x: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly y: v.LiteralSchema<0, undefined>; readonly z: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly yaw: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>; readonly params: v.StrictObjectSchema<{ readonly run: v.LiteralSchema<16.5, undefined>; readonly bed: v.SchemaWithPipe<readonly [v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]>, v.MinValueAction<number, -14, undefined>, v.MaxValueAction<number, -0.4, undefined>]>; }, undefined>; }, undefined>; }, undefined> = v.strictObject({ edge: v.picklist(DRY_ENTRIES), rect, slab, placement });
const transport = v.pipe(v.strictObject({ notice: v.pipe(v.string(), v.startsWith('DO NOT EDIT:')),
  rows: v.pipe(v.array(row), v.length(4)) }),
  v.check(value => value.rows.every((item, index) => item.edge === DRY_ENTRIES[index]), 'original entry order'));
/** At build time, refuse invalid cached placements before canonical section publication. */
export function decodeEntryDecks(source: unknown): v.InferOutput<typeof row>[] {
  return v.parse(transport, source).rows;
}
/** Original dry footprints, foam slabs and seabed-derived column placements. */
export const ENTRY_DECKS: readonly v.InferOutput<typeof row>[] = decodeEntryDecks(generated);

import * as v from 'valibot';

/** Full native boundary rows; legacy 256 and tile-bake 257 counts survive admission unchanged. */
export const EdgeProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly heights: v.ArraySchema<EdgeHeightSchema, undefined>; readonly colours: v.ArraySchema<v.TupleSchema<readonly [EdgeChannelSchema, EdgeChannelSchema, EdgeChannelSchema], undefined>, undefined>; readonly roadHeight: v.GenericSchema<EdgeProfileRowsInput['roadHeight'], EdgeProfileRows['roadHeight']>; }, undefined>, v.CheckAction<{ [K in keyof EdgeProfileRows]: EdgeProfileRows[K] }, 'full native 256 or 257 boundary row'>]> = v.pipe(v.strictObject({
  heights: v.array(v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250))),
  colours: v.array(v.tuple([v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))])),
  roadHeight: v.literal(0),
}), v.check((p) => (p.heights.length === 256 || p.heights.length === 257) && p.colours.length === p.heights.length, 'full native 256 or 257 boundary row'));
/** North is positive z; every boundary lists samples in increasing x or z. */
export const EdgeProfilesSchema: v.GenericSchema<EdgeProfilesRowsInput, EdgeProfilesRows> = v.strictObject({ north: EdgeProfileSchema, east: EdgeProfileSchema, south: EdgeProfileSchema, west: EdgeProfileSchema });

/** Admitted data contracts, independent of validator implementation metadata. */
export type EdgeProfileRowsInput = EdgeProfileRows;
interface EdgeProfileRowsFields {
    heights: (number)[];
    colours: ([
        number,
        number,
        number
    ])[];
    roadHeight: 0;
}
export type EdgeProfileRows = { [Key in keyof EdgeProfileRowsFields]: EdgeProfileRowsFields[Key] };
interface EdgeProfilesRowsInputFields {
    north: EdgeProfileRowsInput;
    east: EdgeProfileRowsInput;
    south: EdgeProfileRowsInput;
    west: EdgeProfileRowsInput;
}
export type EdgeProfilesRowsInput = { [Key in keyof EdgeProfilesRowsInputFields]: EdgeProfilesRowsInputFields[Key] };
interface EdgeProfilesRowsFields {
    north: EdgeProfileRows;
    east: EdgeProfileRows;
    south: EdgeProfileRows;
    west: EdgeProfileRows;
}
export type EdgeProfilesRows = { [Key in keyof EdgeProfilesRowsFields]: EdgeProfilesRowsFields[Key] };

type EdgeHeightSchema = v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>, v.MinValueAction<number, -250, undefined>, v.MaxValueAction<number, 250, undefined>]>;
type EdgeChannelSchema = v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 1, undefined>]>;

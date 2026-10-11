import * as v from 'valibot';

/** Full native boundary rows; legacy 256 and tile-bake 257 counts survive admission unchanged. */
export const EdgeProfileSchema = v.pipe(v.strictObject({
  heights: v.array(v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250))),
  colours: v.array(v.tuple([v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))])),
  roadHeight: v.literal(0),
}), v.check((p) => (p.heights.length === 256 || p.heights.length === 257) && p.colours.length === p.heights.length, 'full native 256 or 257 boundary row'));
/** North is positive z; every boundary lists samples in increasing x or z. */
export const EdgeProfilesSchema = v.strictObject({ north: EdgeProfileSchema, east: EdgeProfileSchema, south: EdgeProfileSchema, west: EdgeProfileSchema });
/** Validated immutable wire values, with no analytic terrain closures. */
export type NativeEdgeProfiles = v.InferOutput<typeof EdgeProfilesSchema>;

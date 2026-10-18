import * as v from 'valibot';

/** Sampling for client-only fx.trail rows. Null cadence appends; a positive
 * cadence keeps recent points. Capacity belongs to the presentation's row. */
export const FollowTrailSamplingSchema = v.strictObject({ kind: v.literal('fx.trail'),
  every: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0.001), v.maxValue(60))),
  movementSq: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(10000)),
});

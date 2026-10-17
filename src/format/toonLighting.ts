import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const vector = v.tuple([finite, finite, finite]);
/** Shared presentation lighting identity, initialized from admitted data. */
export const ToonLightingSchema = v.strictObject({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  initial: v.strictObject({ uToonLift: vector, uToonRim: vector,
    uCloudShadow: finite, uToonNight: finite, uSeaLevel: finite, uCloudTime: finite }) });
export type ToonLightingRow = v.InferOutput<typeof ToonLightingSchema>;

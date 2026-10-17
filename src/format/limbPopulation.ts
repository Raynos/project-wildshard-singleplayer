import * as v from 'valibot';
import { LimbBlendSchema, BakedClipTable } from './limbRig';
import { LimbCollisionBake } from './limbCollision';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** Native pose service selection and clocks are rows; collision and blend share the rendered rig's data. */
export const LimbPopulationSchema = v.strictObject({
  step: key, limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1024)),
  near: v.pipe(v.number(), v.finite(), v.minValue(0)),
  head: key, collision: LimbCollisionBake, blend: LimbBlendSchema, clips: BakedClipTable,
});
export type LimbPopulation = v.InferOutput<typeof LimbPopulationSchema>;

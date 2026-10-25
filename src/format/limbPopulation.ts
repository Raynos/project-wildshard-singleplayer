import * as v from 'valibot';
import { LimbBlendSchema, BakedClipTable } from './limbRig';
import { LimbCollisionBake } from './limbCollision';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** Native pose service selection and clocks are rows; collision and blend share the rendered rig's data. */
export const LimbPopulationSchema: v.GenericSchema<LimbPopulationRowsInput, LimbPopulationRows> = v.strictObject({
  step: key, limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1024)),
  near: v.pipe(v.number(), v.finite(), v.minValue(0)),
  head: key, collision: LimbCollisionBake, blend: LimbBlendSchema, clips: BakedClipTable,
});

/** Admitted data contracts, independent of validator implementation metadata. */
interface LimbPopulationRowsInputFields {
    step: string;
    limit: number;
    near: number;
    head: string;
    collision: v.InferInput<typeof LimbCollisionBake>;
    blend: v.InferInput<typeof LimbBlendSchema>;
    clips: v.InferInput<typeof BakedClipTable>;
}
export type LimbPopulationRowsInput = { [Key in keyof LimbPopulationRowsInputFields]: LimbPopulationRowsInputFields[Key] };
interface LimbPopulationRowsFields {
    step: string;
    limit: number;
    near: number;
    head: string;
    collision: v.InferOutput<typeof LimbCollisionBake>;
    blend: v.InferOutput<typeof LimbBlendSchema>;
    clips: v.InferOutput<typeof BakedClipTable>;
}
export type LimbPopulationRows = { [Key in keyof LimbPopulationRowsFields]: LimbPopulationRowsFields[Key] };

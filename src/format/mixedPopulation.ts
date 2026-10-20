import * as v from 'valibot';
import { NumericPoseSchema } from './clientChannels';

const finite = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.strictObject({ x: finite, z: finite });
/** Mixed native roster policy, pose, reserve and physical volley composition. */
export const MixedPopulationSchema = v.strictObject({
  step: key, limit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)),
  attackTurnCap: finite, hunted: v.array(key), floorKinds: v.array(key),
  practice: v.strictObject({ at: point, fade: finite, delay: finite, away: finite }),
  reserve: v.strictObject({ kind: key, variant: key, scale: v.tuple([finite, finite]), legacyMemory: v.array(v.strictObject({ from: key, to: key, axis: v.picklist(['x', 'z', 'zero']) })) }),
  volley: v.strictObject({ owner: key, strike: key, tags: v.array(v.custom<`${string}.${string}`>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))) }),
  poses: v.array(v.strictObject({ kind: key, clips: v.array(NumericPoseSchema),
    lift: v.exactOptional(v.tuple([finite, finite, finite, finite])) })),
  perch: v.strictObject({ kind: key, strike: key, sound: key, sourceHeight: finite, targetHeight: finite, attackStream: v.exactOptional(key),
    actions: v.strictObject({ stateKey: key, states: v.array(key), actions: v.array(v.strictObject({ state: finite, phase: finite, effect: key,
      once: v.strictObject({ key, value: finite, test: v.picklist(['falsy', 'not-value']) }),
      when: v.exactOptional(v.strictObject({ key, test: v.picklist(['truthy', 'falsy']) })) })) }),
    score: key, height: key, heightChannel: key,
    root: v.strictObject({ drop: key, velocity: key, land: key, climb: key, height: key, baseX: key, baseZ: key, x: key, z: key,
      gravity: finite, speed: finite, landing: finite }) }),
});
export type MixedPopulationRows = v.InferOutput<typeof MixedPopulationSchema>;

import * as v from 'valibot';
import type { PhasedRaptorSpec } from '@wildshard/engine/ai/phasedRaptor';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const field = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9._:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(radius, v.maxValue(30));
const turn = v.pipe(finite, v.minValue(0), v.maxValue(20));
const coordinate = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const seconds = v.pipe(radius, v.maxValue(60));
const ready = v.variant('kind', [
  v.strictObject({ kind: v.literal('over'), radius: positive, height: positive }),
  v.strictObject({ kind: v.literal('band'), tolerance: positive }),
  v.strictObject({ kind: v.literal('range') }),
]);
const phase = v.strictObject({
  strike: key, altitude: coordinate, aimHeight: v.pipe(finite, v.minValue(-10), v.maxValue(10)),
  orbit: v.strictObject({ x: coordinate, z: coordinate, r: positive, speed }),
  stalk: v.strictObject({ standOff: radius, retreat: v.boolean(), speed: v.nullable(speed), above: v.nullable(v.pipe(finite, v.minValue(-100), v.maxValue(100))), ready }),
  dive: v.boolean(), shove: v.nullable(v.strictObject({ speed, lift: speed })), rest: seconds,
});

/**
 * A phased raptor's declaration (SHARD-PLATFORM SF27, the Storm Roc's shape): a boss bird on a perch that takes off as
 * its fight begins, laps `lap` between strikes and, per phase, closes in its own way (hang over the player, hold off
 * and back away, or walk up) to make that phase's strike (an id in its strike rows), a dive or a held strike that may
 * shove the player. Its encounter sets the phase and the fight; `perch` comes from the place it lands.
 */
export const PhasedRaptorSchema = v.strictObject({
  id: key, kind: v.literal('phased-raptor'),
  perch: v.strictObject({ x: coordinate, y: coordinate, z: coordinate, yaw: v.pipe(finite, v.minValue(-2 * Math.PI), v.maxValue(2 * Math.PI)) }),
  lap: v.strictObject({ x: coordinate, z: coordinate, r: positive, y: coordinate }),
  speeds: v.strictObject({ circle: speed, stalk: speed, dive: speed }),
  takeoff: v.strictObject({ seconds: positive, speed, turn, bank: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI / 2)) }),
  firstRest: seconds,
  turns: v.strictObject({ perch: turn, circle: turn, stalk: turn, strike: turn }),
  fields: v.strictObject({ lean: field, bank: field }),
  phases: v.pipe(v.array(phase), v.minLength(1), v.maxLength(8)),
});
/** An admitted phased raptor declaration: the engine brain's spec. */
export type ShardPhasedRaptor = v.InferOutput<typeof PhasedRaptorSchema> & PhasedRaptorSpec;
/** Refuse an invalid phased raptor before any policy or callback exists. */
export function parsePhasedRaptor(data: unknown): ShardPhasedRaptor { return v.parse(PhasedRaptorSchema, data); }

import * as v from 'valibot';
import { LimbPopulationSchema } from './limbPopulation';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1024));
const point = v.strictObject({ x: finite, z: finite });
const identity = v.strictObject({ kind: key, variant: key });
/** Ordered native population boot program: herds, reserved-identity replacements, dormant recipes, then scripted homes.
 * All rows are data. Fight decisions and pose implementation remain owned by their existing services. */
export const NativePopulationRowsSchema = v.strictObject({
  version: v.literal(1), environment: key, step: key, seed: finite, bodyCount: count, limit: v.pipe(count, v.minValue(1)),
  limbPose: v.exactOptional(LimbPopulationSchema),
  scripted: key, encounter: key, poseKinds: v.array(key), spawn: point,
  fauna: v.array(v.strictObject({ kind: key, count,
    variants: v.exactOptional(v.array(key)),
    anchor: v.exactOptional(v.strictObject({ x: finite, z: finite, rMin: finite, rMax: finite })),
    canopy: v.boolean(), trailBand: v.tuple([finite, finite]),
  })),
  identities: v.array(identity), ordinary: v.record(key, v.array(key)),
  reserves: v.array(v.strictObject({ kind: key, variant: v.nullable(key) })),
  homes: v.array(v.strictObject({ ...identity.entries, x: finite, z: finite, stream: key })),
});
export type NativePopulationRows = v.InferOutput<typeof NativePopulationRowsSchema>;
/** Admit once, before any native actor or RNG draw is installed. */
export function parseNativePopulationRows(input: unknown): NativePopulationRows {
  const rows = v.parse(NativePopulationRowsSchema, input);
  if (rows.bodyCount > rows.limit || rows.fauna.length > rows.limit || rows.homes.length > rows.limit || rows.reserves.length > rows.limit)
    throw new Error('Invalid native population row bounds');
  return rows;
}

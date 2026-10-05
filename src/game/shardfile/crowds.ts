import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coordinate = v.pipe(finite, v.minValue(-100000), v.maxValue(100000));
const speed = v.pipe(finite, v.minValue(0), v.maxValue(15));

/** Ordered instanced flock declaration; terrain, native view, prey and distance scheduling remain trusted ports. */
export const FlockSchema = v.strictObject({
  id: key, kind: v.literal('flock'), x: coordinate, z: coordinate,
  count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(256)),
  seed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff)),
  range: v.pipe(finite, v.minValue(8), v.maxValue(500)), runSpeed: speed, walkSpeed: speed, grazeStep: speed,
});
/** Admitted flock tuning, stable crowd identity and ordered member count. */
export type ShardFlock = v.InferOutput<typeof FlockSchema>;
/** Refuse malformed tuning before constructing a native view or consuming setup randomness. */
export function parseFlock(data: unknown): ShardFlock { return v.parse(FlockSchema, data); }

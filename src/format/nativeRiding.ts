import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite()), positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const channel = v.pipe(v.string(), v.maxLength(1048576));
/** Native riding owns motors and poses; content declares identities, terrain masks
 * and guest rows. The caller supplies no world-query or per-frame callback. */
export const NativeRidingSchema = v.strictObject({
  step: id, herds: id, mountable: v.pipe(v.array(id), v.maxLength(64)), kinds: v.pipe(v.array(id), v.minLength(1), v.maxLength(16)),
  adopted: v.strictObject({ kind: id, variant: id }),
  speeds: v.strictObject({ walk: positive, trot: positive, canter: positive, gallop: positive }),
  pose: v.strictObject({ gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })),
    pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) }),
  world: v.strictObject({ res: v.pipe(finite, v.integer(), v.minValue(2), v.maxValue(1024)), size: positive, water: finite, wet: channel, pond: channel }),
  roads: v.exactOptional(v.pipe(v.array(v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(1024))), v.maxLength(128))),
  thrownDamage: v.pipe(finite, v.minValue(0)), thrownLabel: v.string(), program: v.unknown(),
});
export type NativeRidingRows = v.InferOutput<typeof NativeRidingSchema>;

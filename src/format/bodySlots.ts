import * as v from 'valibot';

const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const positive = v.pipe(nonnegative, v.minValue(Number.MIN_VALUE));
const range = v.pipe(v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]), v.check(([a, b]) => a <= b));
/** Bounded ball-body mechanics. Contact produces value events; no content callback is accepted. */
export const BodySlotsSchema = v.strictObject({
  count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(128)), clocks: v.picklist(['f32', 'number']), initial: v.picklist([1, 2]),
  restSpeed: nonnegative, restTime: nonnegative, maxAge: nonnegative, inclusive: v.boolean(),
  landing: v.exactOptional(v.strictObject({ impact: nonnegative, timeout: nonnegative, wet: v.boolean(), clearDistance: nonnegative })),
  body: v.strictObject({ radius: positive, material: v.picklist(['wood', 'stone', 'metal']), density: positive, friction: nonnegative, restitution: nonnegative, angularDamping: nonnegative,
    rolling: v.exactOptional(v.pipe(nonnegative, v.maxValue(1))), group: v.picklist(['ITEM', 'DEBRIS']), ccd: v.boolean(), expendable: v.boolean() }),
  contact: v.exactOptional(v.strictObject({ radius: positive, height: nonnegative, horizontalBounce: v.pipe(v.number(), v.finite()), up: nonnegative })),
  float: v.exactOptional(v.strictObject({ level: v.pipe(v.number(), v.finite()), buoyancy: positive, drag: nonnegative, waves: v.boolean() })),
  spin: v.exactOptional(v.strictObject({ phase: range, x: range, y: range, z: range })),
  settle: v.exactOptional(v.strictObject({ depth: positive })),
});
export type BodySlotsData = v.InferOutput<typeof BodySlotsSchema>;

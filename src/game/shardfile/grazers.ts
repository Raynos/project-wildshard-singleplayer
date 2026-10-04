import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(finite, v.minValue(0), v.maxValue(15));
const cadence = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')), 6);

/** Finite ram-grazer tuning and a named strike; the host binds terrain, home, RNG and contact authority. */
export const RamGrazerSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('ram-grazer'), thinkDivisor: cadence, strike: key,
  grazeSpeed: v.pipe(speed, v.maxValue(10)), ramSpeed: speed, noticeRadius: radius,
  rimMargin: radius, fallDrop: radius, levelTolerance: positive, threatSpeed: speed,
  wanderMinSeconds: positive, wanderMaxSeconds: positive, rampRate: positive,
}), v.check(row => row.wanderMinSeconds <= row.wanderMaxSeconds, 'Ordered grazer wander interval'));
/** An admitted rim-aware grazer policy; spawn identity, current home and strike recipes remain loader-owned. */
export type ShardRamGrazer = v.InferOutput<typeof RamGrazerSchema>;
/** Validate a ram policy without touching an actor, its random stream or the native world. */
export function parseRamGrazer(data: unknown): ShardRamGrazer { return v.parse(RamGrazerSchema, data); }

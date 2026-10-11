import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(finite, v.minValue(0), v.maxValue(15));
const cadence = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')), 6);

function orderedWander(row: { wanderMinSeconds: number; wanderMaxSeconds: number }): boolean {
  return row.wanderMinSeconds <= row.wanderMaxSeconds;
}
function distinctChallenge(row: { noticeRadius: number; loseRadius: number; charge: string; close: string; windupField: string; recoveryField: string }): boolean {
  return row.noticeRadius <= row.loseRadius && row.charge !== row.close && row.windupField !== row.recoveryField;
}

/** Finite ram-grazer tuning and a named strike; the host binds terrain, home, RNG and contact authority. */
export const RamGrazerSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('ram-grazer'), thinkDivisor: cadence, strike: key,
  grazeSpeed: v.pipe(speed, v.maxValue(10)), ramSpeed: speed, noticeRadius: radius,
  rimMargin: radius, fallDrop: radius, levelTolerance: positive, threatSpeed: speed,
  wanderMinSeconds: positive, wanderMaxSeconds: positive, rampRate: positive,
}), v.check(row => orderedWander(row), 'Ordered grazer wander interval'));
/** An admitted rim-aware grazer policy; spawn identity, current home and strike recipes remain loader-owned. */
export type ShardRamGrazer = v.InferOutput<typeof RamGrazerSchema>;
/** Validate a ram policy without touching an actor, its random stream or the native world. */
export function parseRamGrazer(data: unknown): ShardRamGrazer { return v.parse(RamGrazerSchema, data); }

/** Timed challenge policy with an ordered charge/close pair, declared utility weights and pose memory fields. */
export const ChallengeGrazerSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('challenge-grazer'), thinkDivisor: cadence, charge: key, close: key,
  noticeRadius: radius, chargeRadius: positive, loseRadius: radius, walkSpeed: speed, approachSpeed: speed,
  homeRadius: radius, faceSeconds: positive, circleRate: radius,
  farPreferenceRadius: radius, farWeight: radius, nearWeight: radius, closeWeight: radius,
  windupField: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128)),
  recoveryField: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128)),
}), v.check(row => distinctChallenge(row), 'Distinct challenge strikes and fields, ordered perception'));
/** Admitted timed challenge policy; stable actor phase and contact recipes arrive from trusted loader ports. */
export type ShardChallengeGrazer = v.InferOutput<typeof ChallengeGrazerSchema>;
/** Reject nonfinite tuning, unknown fields and conflicting identities before installation. */
export function parseChallengeGrazer(data: unknown): ShardChallengeGrazer { return v.parse(ChallengeGrazerSchema, data); }

/** One grazer archetype: both attack patterns retain their exact legacy bounds and clocks. */
export const GrazerSchema = v.variant('pattern', [
  v.pipe(v.strictObject({ ...RamGrazerSchema.pipe[0].entries, kind: v.literal('grazer'), pattern: v.literal('wander-ram') }),
    v.check(row => orderedWander(row), 'Ordered grazer wander interval')),
  v.pipe(v.strictObject({ ...ChallengeGrazerSchema.pipe[0].entries, kind: v.literal('grazer'), pattern: v.literal('circle-challenge') }),
    v.check(row => distinctChallenge(row), 'Distinct challenge strikes and fields, ordered perception')),
]);
/** Admitted grazer data; floor, RNG and body authority remain trusted pattern-specific ports. */
export type ShardGrazer = v.InferOutput<typeof GrazerSchema>;
/** Admit either pattern without constructing a policy, body or random stream. */
export function parseGrazer(data: unknown): ShardGrazer { return v.parse(GrazerSchema, data); }
/** Canonical preset for existing body adapters and save contracts; tuning and cadence are unchanged. */
export function grazerPreset(data: ShardGrazer): ShardRamGrazer | ShardChallengeGrazer {
  if (data.pattern === 'wander-ram') {
    const { pattern: _pattern, ...row } = data;
    return { ...row, kind: 'ram-grazer' };
  }
  const { pattern: _pattern, ...row } = data;
  return { ...row, kind: 'challenge-grazer' };
}

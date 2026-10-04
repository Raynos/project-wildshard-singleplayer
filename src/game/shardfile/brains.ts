import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const cue = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_.:-]*$/u), v.maxLength(128));
const radius = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const duration = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
/** Circling melee policy data; the host retains navigation, attack tokens, strike clocks and random streams. */
export const SkirmisherSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('skirmisher'), awareRadius: radius, shyRadius: radius, disengageRadius: radius,
  holdRadius: radius, attackRadius: radius, attackDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  attackCooldown: duration, alertCooldown: duration,
  fleeSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  subordinateVariant: key, leaderVariant: key, noticeCue: cue,
}), v.check((row) => row.shyRadius <= row.awareRadius && row.awareRadius <= row.disengageRadius
  && row.attackRadius <= row.awareRadius, 'Ordered skirmisher perception and strike radii'));
/** Admitted archetype parameters, identified independently from a particular creature spawn. */
export type ShardSkirmisher = v.InferOutput<typeof SkirmisherSchema>;
/** Reject unknown fields, nonfinite tuning and invalid radii before installing an actor policy. */
export function parseSkirmisher(data: unknown): ShardSkirmisher { return v.parse(SkirmisherSchema, data); }

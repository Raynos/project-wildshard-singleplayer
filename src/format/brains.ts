import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const cue = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_.:-]*$/u), v.maxLength(128));
const radius = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const cadence = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')), 6);
const duration = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
/** Circling melee policy data; the host retains navigation, attack tokens, strike clocks and random streams. */
export const SkirmisherSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('skirmisher'), thinkDivisor: cadence, awareRadius: radius, shyRadius: radius, disengageRadius: radius,
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

/** Custom author policy over bounded host queries; actor identity and observation provenance are injected by the loader. */
export const ScriptBrainSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  thinkDivisor: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxStrafe: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
  parameters: v.pipe(v.array(v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000))), v.maxLength(64)),
  strikes: v.pipe(v.array(v.strictObject({ event: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), strike: key })), v.maxLength(32)),
}), v.check(row => new Set(row.strikes.map(strike => strike.event)).size === row.strikes.length, 'Unique declared brain strike events'));
/** Validated script policy; only named admitted strikes may be requested and motion stays within its declared bounds. */
export type ShardScriptBrain = v.InferOutput<typeof ScriptBrainSchema>;
/** Validate a custom policy before module admission, trusted actor binding or physics allocation. */
export function parseScriptBrain(data: unknown): ShardScriptBrain { return v.parse(ScriptBrainSchema, data); }

/** Interior guardian policy; native floor and rise/sink recipes publish completion through trusted ports. */
export const GuardianSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('guardian'), thinkDivisor: cadence, wakeRadius: radius, guardRadius: radius, approachRadius: radius,
  swingRadius: radius, swingDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  speed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)), holdRadius: radius,
  sideSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  sideFlipSeconds: duration, sinkAfterSeconds: duration, cooldownSeconds: duration,
  hideOffset: v.pipe(v.number(), v.finite(), v.minValue(-15), v.maxValue(15)), noticeCue: cue,
}), v.check(row => row.wakeRadius <= row.guardRadius && row.swingRadius <= row.approachRadius, 'Ordered guardian radii'));
/** Admitted interior guardian tuning, independent from a native rig or floor recipe. */
export type ShardGuardian = v.InferOutput<typeof GuardianSchema>;
/** Validate guardian decisions before selecting the existing native motion and strike recipes. */
export function parseGuardian(data: unknown): ShardGuardian { return v.parse(GuardianSchema, data); }

/** Perch hunting decisions; native perch selection, vertical completion and shared attack RNG remain trusted host ports. */
export const PerchHunterSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('perch-hunter'), thinkDivisor: cadence, throwRadius: radius, throwDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  biteRadius: radius, biteDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)), underRadius: radius, underSeconds: duration,
  holdRadius: radius, runSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)), activeGroundSeconds: duration,
  biteCooldown: duration, throwCooldownMin: duration, throwCooldownMax: duration, alertCue: cue, noticeCue: cue,
}), v.check(row => row.biteRadius <= row.throwRadius && row.throwCooldownMin <= row.throwCooldownMax, 'Ordered perch attack ranges and cooldowns'));
/** Admitted ranged-perch and ground-attack policy parameters. */
export type ShardPerchHunter = v.InferOutput<typeof PerchHunterSchema>;
/** Validate policy data while retaining the loader's authority over perches, projectiles and tokens. */
export function parsePerchHunter(data: unknown): ShardPerchHunter { return v.parse(PerchHunterSchema, data); }

/** One home/perch guardian archetype; each branch keeps the exact legacy bounds, defaults and predicate. */
export const GuardianPatternsSchema = v.variant('pattern', [
  v.pipe(v.strictObject({ ...GuardianSchema.pipe[0].entries, pattern: v.literal('interior') }),
    v.check(row => GuardianSchema.pipe[1].requirement(row), 'Ordered guardian radii')),
  v.pipe(v.strictObject({ ...PerchHunterSchema.pipe[0].entries, kind: v.literal('guardian'), pattern: v.literal('perch') }),
    v.check(row => PerchHunterSchema.pipe[1].requirement({ ...row, kind: 'perch-hunter' }), 'Ordered perch attack ranges and cooldowns')),
]);
/** Admitted guardian pattern data; native floor/perch/body/RNG ports retain gameplay authority. */
export type ShardGuardianPattern = v.InferOutput<typeof GuardianPatternsSchema>;
/** Validate a pattern without allocating an actor or executing its native recipes. */
export function parseGuardianPattern(data: unknown): ShardGuardianPattern { return v.parse(GuardianPatternsSchema, data); }
/** Canonical old row, including parsed field order, for existing native adapters and saved policy strings. */
export function guardianPreset(data: ShardGuardianPattern): ShardGuardian | ShardPerchHunter {
  const { pattern: _pattern, ...row } = data;
  return data.pattern === 'interior' ? parseGuardian(row) : parsePerchHunter({ ...row, kind: 'perch-hunter' });
}

/** Circling melee pattern of the stalker archetype, retaining exact legacy bounds and cadence. */
export const StalkerSchema = v.pipe(v.strictObject({ ...SkirmisherSchema.pipe[0].entries,
  kind: v.literal('stalker'), pattern: v.literal('skirmish') }),
  v.check(row => SkirmisherSchema.pipe[1].requirement({ ...row, kind: 'skirmisher' }), 'Ordered skirmisher perception and strike radii'));
/** Admitted stalker pattern data; native body, attack tokens and RNG remain host-owned. */
export type ShardStalker = v.InferOutput<typeof StalkerSchema>;
/** Admit a stalker row before any actor, native recipe or callback is allocated. */
export function parseStalker(data: unknown): ShardStalker { return v.parse(StalkerSchema, data); }
/** Canonical legacy row, including parsed key order, for native adapters and existing saved policy strings. */
export function stalkerPreset(data: ShardStalker): ShardSkirmisher {
  const { pattern: _pattern, ...row } = data;
  return parseSkirmisher({ ...row, kind: 'skirmisher' });
}

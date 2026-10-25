import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const cue = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_.:-]*$/u), v.maxLength(128));
const radius = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const cadence = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')), 6);
const duration = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
/** Circling melee policy data; the host retains navigation, attack tokens, strike clocks and random streams. */
export const SkirmisherSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardSkirmisherInput['id'], ShardSkirmisher['id']>; readonly kind: v.GenericSchema<ShardSkirmisherInput['kind'], ShardSkirmisher['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardSkirmisherInput['thinkDivisor'], undefined>, Exclude<ShardSkirmisher['thinkDivisor'], undefined>>, 6>; readonly awareRadius: v.GenericSchema<ShardSkirmisherInput['awareRadius'], ShardSkirmisher['awareRadius']>; readonly shyRadius: v.GenericSchema<ShardSkirmisherInput['shyRadius'], ShardSkirmisher['shyRadius']>; readonly disengageRadius: v.GenericSchema<ShardSkirmisherInput['disengageRadius'], ShardSkirmisher['disengageRadius']>; readonly holdRadius: v.GenericSchema<ShardSkirmisherInput['holdRadius'], ShardSkirmisher['holdRadius']>; readonly attackRadius: v.GenericSchema<ShardSkirmisherInput['attackRadius'], ShardSkirmisher['attackRadius']>; readonly attackDuration: v.GenericSchema<ShardSkirmisherInput['attackDuration'], ShardSkirmisher['attackDuration']>; readonly attackCooldown: v.GenericSchema<ShardSkirmisherInput['attackCooldown'], ShardSkirmisher['attackCooldown']>; readonly alertCooldown: v.GenericSchema<ShardSkirmisherInput['alertCooldown'], ShardSkirmisher['alertCooldown']>; readonly fleeSpeed: v.GenericSchema<ShardSkirmisherInput['fleeSpeed'], ShardSkirmisher['fleeSpeed']>; readonly subordinateVariant: v.GenericSchema<ShardSkirmisherInput['subordinateVariant'], ShardSkirmisher['subordinateVariant']>; readonly leaderVariant: v.GenericSchema<ShardSkirmisherInput['leaderVariant'], ShardSkirmisher['leaderVariant']>; readonly noticeCue: v.GenericSchema<ShardSkirmisherInput['noticeCue'], ShardSkirmisher['noticeCue']>; }, undefined>, v.CheckAction<{ [K in keyof ShardSkirmisher]: ShardSkirmisher[K] }, 'Ordered skirmisher perception and strike radii'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('skirmisher'), thinkDivisor: cadence, awareRadius: radius, shyRadius: radius, disengageRadius: radius,
  holdRadius: radius, attackRadius: radius, attackDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  attackCooldown: duration, alertCooldown: duration,
  fleeSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  subordinateVariant: key, leaderVariant: key, noticeCue: cue,
}), v.check((row) => row.shyRadius <= row.awareRadius && row.awareRadius <= row.disengageRadius
  && row.attackRadius <= row.awareRadius, 'Ordered skirmisher perception and strike radii'));
/** Admitted archetype parameters, identified independently from a particular creature spawn. */

/** Reject unknown fields, nonfinite tuning and invalid radii before installing an actor policy. */
export function parseSkirmisher(data: unknown): ShardSkirmisher { return v.parse(SkirmisherSchema, data); }

/** Custom author policy over bounded host queries; actor identity and observation provenance are injected by the loader. */
export const ScriptBrainSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardScriptBrainInput['id'], ShardScriptBrain['id']>; readonly kind: v.GenericSchema<ShardScriptBrainInput['kind'], ShardScriptBrain['kind']>; readonly module: v.GenericSchema<ShardScriptBrainInput['module'], ShardScriptBrain['module']>; readonly thinkDivisor: v.GenericSchema<ShardScriptBrainInput['thinkDivisor'], ShardScriptBrain['thinkDivisor']>; readonly maxSpeed: v.GenericSchema<ShardScriptBrainInput['maxSpeed'], ShardScriptBrain['maxSpeed']>; readonly maxStrafe: v.GenericSchema<ShardScriptBrainInput['maxStrafe'], ShardScriptBrain['maxStrafe']>; readonly maxTurnRate: v.GenericSchema<ShardScriptBrainInput['maxTurnRate'], ShardScriptBrain['maxTurnRate']>; readonly parameters: v.GenericSchema<ShardScriptBrainInput['parameters'], ShardScriptBrain['parameters']>; readonly strikes: v.GenericSchema<ShardScriptBrainInput['strikes'], ShardScriptBrain['strikes']>; }, undefined>, v.CheckAction<{ [K in keyof ShardScriptBrain]: ShardScriptBrain[K] }, 'Unique declared brain strike events'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('script'), module: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  thinkDivisor: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')),
  maxSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxStrafe: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  maxTurnRate: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(30)),
  parameters: v.pipe(v.array(v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000))), v.maxLength(64)),
  strikes: v.pipe(v.array(v.strictObject({ event: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), strike: key })), v.maxLength(32)),
}), v.check(row => new Set(row.strikes.map(strike => strike.event)).size === row.strikes.length, 'Unique declared brain strike events'));
/** Validated script policy; only named admitted strikes may be requested and motion stays within its declared bounds. */

/** Validate a custom policy before module admission, trusted actor binding or physics allocation. */
export function parseScriptBrain(data: unknown): ShardScriptBrain { return v.parse(ScriptBrainSchema, data); }

/** Interior guardian policy; native floor and rise/sink recipes publish completion through trusted ports. */
export const GuardianSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardGuardianInput['id'], ShardGuardian['id']>; readonly kind: v.GenericSchema<ShardGuardianInput['kind'], ShardGuardian['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardGuardianInput['thinkDivisor'], undefined>, Exclude<ShardGuardian['thinkDivisor'], undefined>>, 6>; readonly wakeRadius: v.GenericSchema<ShardGuardianInput['wakeRadius'], ShardGuardian['wakeRadius']>; readonly guardRadius: v.GenericSchema<ShardGuardianInput['guardRadius'], ShardGuardian['guardRadius']>; readonly approachRadius: v.GenericSchema<ShardGuardianInput['approachRadius'], ShardGuardian['approachRadius']>; readonly swingRadius: v.GenericSchema<ShardGuardianInput['swingRadius'], ShardGuardian['swingRadius']>; readonly swingDuration: v.GenericSchema<ShardGuardianInput['swingDuration'], ShardGuardian['swingDuration']>; readonly speed: v.GenericSchema<ShardGuardianInput['speed'], ShardGuardian['speed']>; readonly holdRadius: v.GenericSchema<ShardGuardianInput['holdRadius'], ShardGuardian['holdRadius']>; readonly sideSpeed: v.GenericSchema<ShardGuardianInput['sideSpeed'], ShardGuardian['sideSpeed']>; readonly sideFlipSeconds: v.GenericSchema<ShardGuardianInput['sideFlipSeconds'], ShardGuardian['sideFlipSeconds']>; readonly sinkAfterSeconds: v.GenericSchema<ShardGuardianInput['sinkAfterSeconds'], ShardGuardian['sinkAfterSeconds']>; readonly cooldownSeconds: v.GenericSchema<ShardGuardianInput['cooldownSeconds'], ShardGuardian['cooldownSeconds']>; readonly hideOffset: v.GenericSchema<ShardGuardianInput['hideOffset'], ShardGuardian['hideOffset']>; readonly noticeCue: v.GenericSchema<ShardGuardianInput['noticeCue'], ShardGuardian['noticeCue']>; }, undefined>, v.CheckAction<{ [K in keyof ShardGuardian]: ShardGuardian[K] }, 'Ordered guardian radii'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('guardian'), thinkDivisor: cadence, wakeRadius: radius, guardRadius: radius, approachRadius: radius,
  swingRadius: radius, swingDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  speed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)), holdRadius: radius,
  sideSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)),
  sideFlipSeconds: duration, sinkAfterSeconds: duration, cooldownSeconds: duration,
  hideOffset: v.pipe(v.number(), v.finite(), v.minValue(-15), v.maxValue(15)), noticeCue: cue,
}), v.check(row => row.wakeRadius <= row.guardRadius && row.swingRadius <= row.approachRadius, 'Ordered guardian radii'));
/** Admitted interior guardian tuning, independent from a native rig or floor recipe. */

/** Validate guardian decisions before selecting the existing native motion and strike recipes. */
export function parseGuardian(data: unknown): ShardGuardian { return v.parse(GuardianSchema, data); }

/** Perch hunting decisions; native perch selection, vertical completion and shared attack RNG remain trusted host ports. */
export const PerchHunterSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardPerchHunterInput['id'], ShardPerchHunter['id']>; readonly kind: v.GenericSchema<ShardPerchHunterInput['kind'], ShardPerchHunter['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardPerchHunterInput['thinkDivisor'], undefined>, Exclude<ShardPerchHunter['thinkDivisor'], undefined>>, 6>; readonly throwRadius: v.GenericSchema<ShardPerchHunterInput['throwRadius'], ShardPerchHunter['throwRadius']>; readonly throwDuration: v.GenericSchema<ShardPerchHunterInput['throwDuration'], ShardPerchHunter['throwDuration']>; readonly biteRadius: v.GenericSchema<ShardPerchHunterInput['biteRadius'], ShardPerchHunter['biteRadius']>; readonly biteDuration: v.GenericSchema<ShardPerchHunterInput['biteDuration'], ShardPerchHunter['biteDuration']>; readonly underRadius: v.GenericSchema<ShardPerchHunterInput['underRadius'], ShardPerchHunter['underRadius']>; readonly underSeconds: v.GenericSchema<ShardPerchHunterInput['underSeconds'], ShardPerchHunter['underSeconds']>; readonly holdRadius: v.GenericSchema<ShardPerchHunterInput['holdRadius'], ShardPerchHunter['holdRadius']>; readonly runSpeed: v.GenericSchema<ShardPerchHunterInput['runSpeed'], ShardPerchHunter['runSpeed']>; readonly activeGroundSeconds: v.GenericSchema<ShardPerchHunterInput['activeGroundSeconds'], ShardPerchHunter['activeGroundSeconds']>; readonly biteCooldown: v.GenericSchema<ShardPerchHunterInput['biteCooldown'], ShardPerchHunter['biteCooldown']>; readonly throwCooldownMin: v.GenericSchema<ShardPerchHunterInput['throwCooldownMin'], ShardPerchHunter['throwCooldownMin']>; readonly throwCooldownMax: v.GenericSchema<ShardPerchHunterInput['throwCooldownMax'], ShardPerchHunter['throwCooldownMax']>; readonly alertCue: v.GenericSchema<ShardPerchHunterInput['alertCue'], ShardPerchHunter['alertCue']>; readonly noticeCue: v.GenericSchema<ShardPerchHunterInput['noticeCue'], ShardPerchHunter['noticeCue']>; }, undefined>, v.CheckAction<{ [K in keyof ShardPerchHunter]: ShardPerchHunter[K] }, 'Ordered perch attack ranges and cooldowns'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('perch-hunter'), thinkDivisor: cadence, throwRadius: radius, throwDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)),
  biteRadius: radius, biteDuration: v.pipe(duration, v.minValue(Number.MIN_VALUE)), underRadius: radius, underSeconds: duration,
  holdRadius: radius, runSpeed: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(15)), activeGroundSeconds: duration,
  biteCooldown: duration, throwCooldownMin: duration, throwCooldownMax: duration, alertCue: cue, noticeCue: cue,
}), v.check(row => row.biteRadius <= row.throwRadius && row.throwCooldownMin <= row.throwCooldownMax, 'Ordered perch attack ranges and cooldowns'));
/** Admitted ranged-perch and ground-attack policy parameters. */

/** Validate policy data while retaining the loader's authority over perches, projectiles and tokens. */
export function parsePerchHunter(data: unknown): ShardPerchHunter { return v.parse(PerchHunterSchema, data); }

/** One home/perch guardian archetype; each branch keeps the exact legacy bounds, defaults and predicate. */
export const GuardianPatternsSchema: v.VariantSchema<'pattern', readonly [
 v.StrictObjectSchema<(typeof GuardianSchema)['pipe'][0]['entries'] & { readonly pattern: v.LiteralSchema<'interior', undefined> }, undefined>,
 v.StrictObjectSchema<Omit<(typeof PerchHunterSchema)['pipe'][0]['entries'], 'kind'> & { readonly kind: v.LiteralSchema<'guardian', undefined>; readonly pattern: v.LiteralSchema<'perch', undefined> }, undefined>
], undefined> = v.variant('pattern', [
  v.pipe(v.strictObject({ ...GuardianSchema.pipe[0].entries, pattern: v.literal('interior') }),
    v.check(row => GuardianSchema.pipe[1].requirement(row), 'Ordered guardian radii')),
  v.pipe(v.strictObject({ ...PerchHunterSchema.pipe[0].entries, kind: v.literal('guardian'), pattern: v.literal('perch') }),
    v.check(row => PerchHunterSchema.pipe[1].requirement({ ...row, kind: 'perch-hunter' }), 'Ordered perch attack ranges and cooldowns')),
]);
/** Admitted guardian pattern data; native floor/perch/body/RNG ports retain gameplay authority. */

/** Validate a pattern without allocating an actor or executing its native recipes. */
export function parseGuardianPattern(data: unknown): ShardGuardianPattern { return v.parse(GuardianPatternsSchema, data); }
/** Canonical old row, including parsed field order, for existing native adapters and saved policy strings. */
export function guardianPreset(data: ShardGuardianPattern): ShardGuardian | ShardPerchHunter {
  const { pattern: _pattern, ...row } = data;
  return data.pattern === 'interior' ? parseGuardian(row) : parsePerchHunter({ ...row, kind: 'perch-hunter' });
}

/** Circling melee pattern of the stalker archetype, retaining exact legacy bounds and cadence. */
export const StalkerSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardStalkerInput['id'], ShardStalker['id']>; readonly kind: v.GenericSchema<ShardStalkerInput['kind'], ShardStalker['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardStalkerInput['thinkDivisor'], undefined>, Exclude<ShardStalker['thinkDivisor'], undefined>>, 6>; readonly awareRadius: v.GenericSchema<ShardStalkerInput['awareRadius'], ShardStalker['awareRadius']>; readonly shyRadius: v.GenericSchema<ShardStalkerInput['shyRadius'], ShardStalker['shyRadius']>; readonly disengageRadius: v.GenericSchema<ShardStalkerInput['disengageRadius'], ShardStalker['disengageRadius']>; readonly holdRadius: v.GenericSchema<ShardStalkerInput['holdRadius'], ShardStalker['holdRadius']>; readonly attackRadius: v.GenericSchema<ShardStalkerInput['attackRadius'], ShardStalker['attackRadius']>; readonly attackDuration: v.GenericSchema<ShardStalkerInput['attackDuration'], ShardStalker['attackDuration']>; readonly attackCooldown: v.GenericSchema<ShardStalkerInput['attackCooldown'], ShardStalker['attackCooldown']>; readonly alertCooldown: v.GenericSchema<ShardStalkerInput['alertCooldown'], ShardStalker['alertCooldown']>; readonly fleeSpeed: v.GenericSchema<ShardStalkerInput['fleeSpeed'], ShardStalker['fleeSpeed']>; readonly subordinateVariant: v.GenericSchema<ShardStalkerInput['subordinateVariant'], ShardStalker['subordinateVariant']>; readonly leaderVariant: v.GenericSchema<ShardStalkerInput['leaderVariant'], ShardStalker['leaderVariant']>; readonly noticeCue: v.GenericSchema<ShardStalkerInput['noticeCue'], ShardStalker['noticeCue']>; readonly pattern: v.GenericSchema<ShardStalkerInput['pattern'], ShardStalker['pattern']>; }, undefined>, v.CheckAction<{ [K in keyof ShardStalker]: ShardStalker[K] }, 'Ordered skirmisher perception and strike radii'>]> = v.pipe(v.strictObject({ ...SkirmisherSchema.pipe[0].entries,
  kind: v.literal('stalker'), pattern: v.literal('skirmish') }),
  v.check(row => SkirmisherSchema.pipe[1].requirement({ ...row, kind: 'skirmisher' }), 'Ordered skirmisher perception and strike radii'));
/** Admitted stalker pattern data; native body, attack tokens and RNG remain host-owned. */

/** Admit a stalker row before any actor, native recipe or callback is allocated. */
export function parseStalker(data: unknown): ShardStalker { return v.parse(StalkerSchema, data); }
/** Canonical legacy row, including parsed key order, for native adapters and existing saved policy strings. */
export function stalkerPreset(data: ShardStalker): ShardSkirmisher {
  const { pattern: _pattern, ...row } = data;
  return parseSkirmisher({ ...row, kind: 'skirmisher' });
}

/** Admitted data contracts, independent of validator implementation metadata. */
interface ShardSkirmisherInputFields {
    id: string;
    kind: 'skirmisher';
    thinkDivisor?: number | undefined;
    awareRadius: number;
    shyRadius: number;
    disengageRadius: number;
    holdRadius: number;
    attackRadius: number;
    attackDuration: number;
    attackCooldown: number;
    alertCooldown: number;
    fleeSpeed: number;
    subordinateVariant: string;
    leaderVariant: string;
    noticeCue: string;
}
export type ShardSkirmisherInput = { [Key in keyof ShardSkirmisherInputFields]: ShardSkirmisherInputFields[Key] };
interface ShardSkirmisherFields {
    id: string;
    kind: 'skirmisher';
    thinkDivisor: number;
    awareRadius: number;
    shyRadius: number;
    disengageRadius: number;
    holdRadius: number;
    attackRadius: number;
    attackDuration: number;
    attackCooldown: number;
    alertCooldown: number;
    fleeSpeed: number;
    subordinateVariant: string;
    leaderVariant: string;
    noticeCue: string;
}
export type ShardSkirmisher = { [Key in keyof ShardSkirmisherFields]: ShardSkirmisherFields[Key] };
export type ShardScriptBrainInput = ShardScriptBrain;
interface ShardScriptBrainFields {
    id: string;
    kind: 'script';
    module: string;
    thinkDivisor: number;
    maxSpeed: number;
    maxStrafe: number;
    maxTurnRate: number;
    parameters: (number)[];
    strikes: ({
        event: number;
        strike: string;
    })[];
}
export type ShardScriptBrain = { [Key in keyof ShardScriptBrainFields]: ShardScriptBrainFields[Key] };
interface ShardGuardianInputFields {
    id: string;
    kind: 'guardian';
    thinkDivisor?: number | undefined;
    wakeRadius: number;
    guardRadius: number;
    approachRadius: number;
    swingRadius: number;
    swingDuration: number;
    speed: number;
    holdRadius: number;
    sideSpeed: number;
    sideFlipSeconds: number;
    sinkAfterSeconds: number;
    cooldownSeconds: number;
    hideOffset: number;
    noticeCue: string;
}
export type ShardGuardianInput = { [Key in keyof ShardGuardianInputFields]: ShardGuardianInputFields[Key] };
interface ShardGuardianFields {
    id: string;
    kind: 'guardian';
    thinkDivisor: number;
    wakeRadius: number;
    guardRadius: number;
    approachRadius: number;
    swingRadius: number;
    swingDuration: number;
    speed: number;
    holdRadius: number;
    sideSpeed: number;
    sideFlipSeconds: number;
    sinkAfterSeconds: number;
    cooldownSeconds: number;
    hideOffset: number;
    noticeCue: string;
}
export type ShardGuardian = { [Key in keyof ShardGuardianFields]: ShardGuardianFields[Key] };
interface ShardPerchHunterInputFields {
    id: string;
    kind: 'perch-hunter';
    thinkDivisor?: number | undefined;
    throwRadius: number;
    throwDuration: number;
    biteRadius: number;
    biteDuration: number;
    underRadius: number;
    underSeconds: number;
    holdRadius: number;
    runSpeed: number;
    activeGroundSeconds: number;
    biteCooldown: number;
    throwCooldownMin: number;
    throwCooldownMax: number;
    alertCue: string;
    noticeCue: string;
}
export type ShardPerchHunterInput = { [Key in keyof ShardPerchHunterInputFields]: ShardPerchHunterInputFields[Key] };
interface ShardPerchHunterFields {
    id: string;
    kind: 'perch-hunter';
    thinkDivisor: number;
    throwRadius: number;
    throwDuration: number;
    biteRadius: number;
    biteDuration: number;
    underRadius: number;
    underSeconds: number;
    holdRadius: number;
    runSpeed: number;
    activeGroundSeconds: number;
    biteCooldown: number;
    throwCooldownMin: number;
    throwCooldownMax: number;
    alertCue: string;
    noticeCue: string;
}
export type ShardPerchHunter = { [Key in keyof ShardPerchHunterFields]: ShardPerchHunterFields[Key] };
export type ShardGuardianPatternInput = (Omit<v.InferInput<(typeof GuardianSchema)['pipe'][0]>, keyof ({
    pattern: 'interior';
})> & {
    pattern: 'interior';
}) | (Omit<v.InferInput<(typeof PerchHunterSchema)['pipe'][0]>, keyof ({
    kind: 'guardian';
    pattern: 'perch';
})> & {
    kind: 'guardian';
    pattern: 'perch';
});
export type ShardGuardianPattern = (Omit<v.InferOutput<(typeof GuardianSchema)['pipe'][0]>, keyof ({
    pattern: 'interior';
})> & {
    pattern: 'interior';
}) | (Omit<v.InferOutput<(typeof PerchHunterSchema)['pipe'][0]>, keyof ({
    kind: 'guardian';
    pattern: 'perch';
})> & {
    kind: 'guardian';
    pattern: 'perch';
});
export type ShardStalkerInput = Omit<v.InferInput<(typeof SkirmisherSchema)['pipe'][0]>, keyof ({
    kind: 'stalker';
    pattern: 'skirmish';
})> & {
    kind: 'stalker';
    pattern: 'skirmish';
};
export type ShardStalker = Omit<v.InferOutput<(typeof SkirmisherSchema)['pipe'][0]>, keyof ({
    kind: 'stalker';
    pattern: 'skirmish';
})> & {
    kind: 'stalker';
    pattern: 'skirmish';
};

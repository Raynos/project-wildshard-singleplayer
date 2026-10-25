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
export const RamGrazerSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardRamGrazerInput['id'], ShardRamGrazer['id']>; readonly kind: v.GenericSchema<ShardRamGrazerInput['kind'], ShardRamGrazer['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardRamGrazerInput['thinkDivisor'], undefined>, Exclude<ShardRamGrazer['thinkDivisor'], undefined>>, 6>; readonly strike: v.GenericSchema<ShardRamGrazerInput['strike'], ShardRamGrazer['strike']>; readonly grazeSpeed: v.GenericSchema<ShardRamGrazerInput['grazeSpeed'], ShardRamGrazer['grazeSpeed']>; readonly ramSpeed: v.GenericSchema<ShardRamGrazerInput['ramSpeed'], ShardRamGrazer['ramSpeed']>; readonly noticeRadius: v.GenericSchema<ShardRamGrazerInput['noticeRadius'], ShardRamGrazer['noticeRadius']>; readonly rimMargin: v.GenericSchema<ShardRamGrazerInput['rimMargin'], ShardRamGrazer['rimMargin']>; readonly fallDrop: v.GenericSchema<ShardRamGrazerInput['fallDrop'], ShardRamGrazer['fallDrop']>; readonly levelTolerance: v.GenericSchema<ShardRamGrazerInput['levelTolerance'], ShardRamGrazer['levelTolerance']>; readonly threatSpeed: v.GenericSchema<ShardRamGrazerInput['threatSpeed'], ShardRamGrazer['threatSpeed']>; readonly wanderMinSeconds: v.GenericSchema<ShardRamGrazerInput['wanderMinSeconds'], ShardRamGrazer['wanderMinSeconds']>; readonly wanderMaxSeconds: v.GenericSchema<ShardRamGrazerInput['wanderMaxSeconds'], ShardRamGrazer['wanderMaxSeconds']>; readonly rampRate: v.GenericSchema<ShardRamGrazerInput['rampRate'], ShardRamGrazer['rampRate']>; }, undefined>, v.CheckAction<{ [K in keyof ShardRamGrazer]: ShardRamGrazer[K] }, 'Ordered grazer wander interval'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('ram-grazer'), thinkDivisor: cadence, strike: key,
  grazeSpeed: v.pipe(speed, v.maxValue(10)), ramSpeed: speed, noticeRadius: radius,
  rimMargin: radius, fallDrop: radius, levelTolerance: positive, threatSpeed: speed,
  wanderMinSeconds: positive, wanderMaxSeconds: positive, rampRate: positive,
}), v.check(row => orderedWander(row), 'Ordered grazer wander interval'));
/** An admitted rim-aware grazer policy; spawn identity, current home and strike recipes remain loader-owned. */

/** Validate a ram policy without touching an actor, its random stream or the native world. */
export function parseRamGrazer(data: unknown): ShardRamGrazer { return v.parse(RamGrazerSchema, data); }

/** Timed challenge policy with an ordered charge/close pair, declared utility weights and pose memory fields. */
export const ChallengeGrazerSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardChallengeGrazerInput['id'], ShardChallengeGrazer['id']>; readonly kind: v.GenericSchema<ShardChallengeGrazerInput['kind'], ShardChallengeGrazer['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<ShardChallengeGrazerInput['thinkDivisor'], undefined>, Exclude<ShardChallengeGrazer['thinkDivisor'], undefined>>, 6>; readonly charge: v.GenericSchema<ShardChallengeGrazerInput['charge'], ShardChallengeGrazer['charge']>; readonly close: v.GenericSchema<ShardChallengeGrazerInput['close'], ShardChallengeGrazer['close']>; readonly noticeRadius: v.GenericSchema<ShardChallengeGrazerInput['noticeRadius'], ShardChallengeGrazer['noticeRadius']>; readonly chargeRadius: v.GenericSchema<ShardChallengeGrazerInput['chargeRadius'], ShardChallengeGrazer['chargeRadius']>; readonly loseRadius: v.GenericSchema<ShardChallengeGrazerInput['loseRadius'], ShardChallengeGrazer['loseRadius']>; readonly walkSpeed: v.GenericSchema<ShardChallengeGrazerInput['walkSpeed'], ShardChallengeGrazer['walkSpeed']>; readonly approachSpeed: v.GenericSchema<ShardChallengeGrazerInput['approachSpeed'], ShardChallengeGrazer['approachSpeed']>; readonly homeRadius: v.GenericSchema<ShardChallengeGrazerInput['homeRadius'], ShardChallengeGrazer['homeRadius']>; readonly faceSeconds: v.GenericSchema<ShardChallengeGrazerInput['faceSeconds'], ShardChallengeGrazer['faceSeconds']>; readonly circleRate: v.GenericSchema<ShardChallengeGrazerInput['circleRate'], ShardChallengeGrazer['circleRate']>; readonly farPreferenceRadius: v.GenericSchema<ShardChallengeGrazerInput['farPreferenceRadius'], ShardChallengeGrazer['farPreferenceRadius']>; readonly farWeight: v.GenericSchema<ShardChallengeGrazerInput['farWeight'], ShardChallengeGrazer['farWeight']>; readonly nearWeight: v.GenericSchema<ShardChallengeGrazerInput['nearWeight'], ShardChallengeGrazer['nearWeight']>; readonly closeWeight: v.GenericSchema<ShardChallengeGrazerInput['closeWeight'], ShardChallengeGrazer['closeWeight']>; readonly windupField: v.GenericSchema<ShardChallengeGrazerInput['windupField'], ShardChallengeGrazer['windupField']>; readonly recoveryField: v.GenericSchema<ShardChallengeGrazerInput['recoveryField'], ShardChallengeGrazer['recoveryField']>; }, undefined>, v.CheckAction<{ [K in keyof ShardChallengeGrazer]: ShardChallengeGrazer[K] }, 'Distinct challenge strikes and fields, ordered perception'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('challenge-grazer'), thinkDivisor: cadence, charge: key, close: key,
  noticeRadius: radius, chargeRadius: positive, loseRadius: radius, walkSpeed: speed, approachSpeed: speed,
  homeRadius: radius, faceSeconds: positive, circleRate: radius,
  farPreferenceRadius: radius, farWeight: radius, nearWeight: radius, closeWeight: radius,
  windupField: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128)),
  recoveryField: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128)),
}), v.check(row => distinctChallenge(row), 'Distinct challenge strikes and fields, ordered perception'));
/** Admitted timed challenge policy; stable actor phase and contact recipes arrive from trusted loader ports. */

/** Reject nonfinite tuning, unknown fields and conflicting identities before installation. */
export function parseChallengeGrazer(data: unknown): ShardChallengeGrazer { return v.parse(ChallengeGrazerSchema, data); }

/** One grazer archetype: both attack patterns retain their exact legacy bounds and clocks. */
export const GrazerSchema: v.VariantSchema<'pattern', readonly [
 v.StrictObjectSchema<Omit<(typeof RamGrazerSchema)['pipe'][0]['entries'], 'kind'> & {
  readonly kind: v.LiteralSchema<'grazer', undefined>;
  readonly pattern: v.LiteralSchema<'wander-ram', undefined>;
 }, undefined>,
 v.StrictObjectSchema<Omit<(typeof ChallengeGrazerSchema)['pipe'][0]['entries'], 'kind'> & {
  readonly kind: v.LiteralSchema<'grazer', undefined>;
  readonly pattern: v.LiteralSchema<'circle-challenge', undefined>;
 }, undefined>
], undefined> = v.variant('pattern', [
  v.pipe(v.strictObject({ ...RamGrazerSchema.pipe[0].entries, kind: v.literal('grazer'), pattern: v.literal('wander-ram') }),
    v.check(row => orderedWander(row), 'Ordered grazer wander interval')),
  v.pipe(v.strictObject({ ...ChallengeGrazerSchema.pipe[0].entries, kind: v.literal('grazer'), pattern: v.literal('circle-challenge') }),
    v.check(row => distinctChallenge(row), 'Distinct challenge strikes and fields, ordered perception')),
]);
/** Admitted grazer data; floor, RNG and body authority remain trusted pattern-specific ports. */

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

/** Admitted data contracts, independent of validator implementation metadata. */
interface ShardRamGrazerInputFields {
    id: string;
    kind: 'ram-grazer';
    thinkDivisor?: number | undefined;
    strike: string;
    grazeSpeed: number;
    ramSpeed: number;
    noticeRadius: number;
    rimMargin: number;
    fallDrop: number;
    levelTolerance: number;
    threatSpeed: number;
    wanderMinSeconds: number;
    wanderMaxSeconds: number;
    rampRate: number;
}
export type ShardRamGrazerInput = { [Key in keyof ShardRamGrazerInputFields]: ShardRamGrazerInputFields[Key] };
interface ShardRamGrazerFields {
    id: string;
    kind: 'ram-grazer';
    thinkDivisor: number;
    strike: string;
    grazeSpeed: number;
    ramSpeed: number;
    noticeRadius: number;
    rimMargin: number;
    fallDrop: number;
    levelTolerance: number;
    threatSpeed: number;
    wanderMinSeconds: number;
    wanderMaxSeconds: number;
    rampRate: number;
}
export type ShardRamGrazer = { [Key in keyof ShardRamGrazerFields]: ShardRamGrazerFields[Key] };
interface ShardChallengeGrazerInputFields {
    id: string;
    kind: 'challenge-grazer';
    thinkDivisor?: number | undefined;
    charge: string;
    close: string;
    noticeRadius: number;
    chargeRadius: number;
    loseRadius: number;
    walkSpeed: number;
    approachSpeed: number;
    homeRadius: number;
    faceSeconds: number;
    circleRate: number;
    farPreferenceRadius: number;
    farWeight: number;
    nearWeight: number;
    closeWeight: number;
    windupField: string;
    recoveryField: string;
}
export type ShardChallengeGrazerInput = { [Key in keyof ShardChallengeGrazerInputFields]: ShardChallengeGrazerInputFields[Key] };
interface ShardChallengeGrazerFields {
    id: string;
    kind: 'challenge-grazer';
    thinkDivisor: number;
    charge: string;
    close: string;
    noticeRadius: number;
    chargeRadius: number;
    loseRadius: number;
    walkSpeed: number;
    approachSpeed: number;
    homeRadius: number;
    faceSeconds: number;
    circleRate: number;
    farPreferenceRadius: number;
    farWeight: number;
    nearWeight: number;
    closeWeight: number;
    windupField: string;
    recoveryField: string;
}
export type ShardChallengeGrazer = { [Key in keyof ShardChallengeGrazerFields]: ShardChallengeGrazerFields[Key] };
export type ShardGrazerInput = (Omit<v.InferInput<(typeof RamGrazerSchema)['pipe'][0]>, keyof ({
    kind: 'grazer';
    pattern: 'wander-ram';
})> & {
    kind: 'grazer';
    pattern: 'wander-ram';
}) | (Omit<v.InferInput<(typeof ChallengeGrazerSchema)['pipe'][0]>, keyof ({
    kind: 'grazer';
    pattern: 'circle-challenge';
})> & {
    kind: 'grazer';
    pattern: 'circle-challenge';
});
export type ShardGrazer = (Omit<v.InferOutput<(typeof RamGrazerSchema)['pipe'][0]>, keyof ({
    kind: 'grazer';
    pattern: 'wander-ram';
})> & {
    kind: 'grazer';
    pattern: 'wander-ram';
}) | (Omit<v.InferOutput<(typeof ChallengeGrazerSchema)['pipe'][0]>, keyof ({
    kind: 'grazer';
    pattern: 'circle-challenge';
})> & {
    kind: 'grazer';
    pattern: 'circle-challenge';
});

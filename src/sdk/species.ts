import * as v from 'valibot';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const nonnegative = v.pipe(finite, v.minValue(0));
const positive = v.pipe(nonnegative, v.check(n => n > 0, 'positive number'));
const text = v.pipe(v.string(), v.maxLength(4096));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const angle = v.pipe(nonnegative, v.maxValue(Math.PI));
const shape = v.variant('kind', [
  v.strictObject({ kind: v.literal('arc'), radius: nonnegative, halfAngle: angle, yawOffset: v.exactOptional(finite) }),
  v.strictObject({ kind: v.literal('lane'), length: nonnegative, width: positive }),
  v.pipe(v.strictObject({ kind: v.literal('ring'), inner: finite, outer: finite }), v.check(r => r.inner <= r.outer, 'ordered ring')),
  v.strictObject({ kind: v.literal('wedge'), length: nonnegative, halfAngle: angle }),
  v.strictObject({ kind: v.literal('point'), radius: nonnegative, exclusive: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('sphere'), radius: nonnegative }),
]);
const weight = v.variant('kind', [
  v.strictObject({ kind: v.literal('constant'), value: finite }),
  v.strictObject({ kind: v.literal('horizontal-distance'), above: nonnegative, far: finite, near: finite }),
]);
const tag = v.custom<CombatTag>(value => typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value));
/** Full native strike data, including its finite score program; no author callback is admitted. */
export const StrikeSchema = v.strictObject({
  id, shape, windup: nonnegative, active: nonnegative, recover: nonnegative, cooldown: nonnegative,
  range: v.nullable(nonnegative), damage: nonnegative, tags: v.pipe(v.array(tag), v.maxLength(32)), weight,
  units: v.exactOptional(v.picklist(['world', 'actor'])), alternatives: v.exactOptional(v.pipe(v.array(shape), v.maxLength(16))),
  motion: v.exactOptional(v.strictObject({ speed: v.exactOptional(nonnegative), delay: v.exactOptional(nonnegative),
    track: v.exactOptional(v.picklist(['none', 'lead', 'follow'])), overshoot: v.exactOptional(finite), skid: v.exactOptional(nonnegative) })),
  eligibility: v.exactOptional(v.strictObject({ maxDy: v.exactOptional(nonnegative), jumpDodges: v.exactOptional(v.boolean()) })),
});
/** Serializable native strike accepted by the SDK, without an authored callback. */
export type StrikeData = v.InferOutput<typeof StrikeSchema>;
/** Validate a serializable native strike before its trusted engine adapter is constructed. */
export function strike(data: unknown): StrikeData { return v.parse(StrikeSchema, data); }

const ordered = v.pipe(v.tuple([positive, positive]), v.check(([a, b]) => a <= b, 'ordered range'));
const mods = v.strictObject({ speed: v.exactOptional(nonnegative), chargeDist: v.exactOptional(nonnegative),
  damageTaken: v.exactOptional(nonnegative), chargeDamage: v.exactOptional(nonnegative), relentless: v.exactOptional(v.boolean()) });
const variant = v.strictObject({ id, label: text, weight: nonnegative, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  scale: ordered, hp: v.exactOptional(positive), mods: v.exactOptional(mods) });
const stalk = v.strictObject({ detect: nonnegative, speed: nonnegative, giveUp: nonnegative, rechargeCd: nonnegative,
  huffMin: nonnegative, huffMax: nonnegative, roar: text, fleeBelowHp: nonnegative, fleeChance: nonnegative });
const tuning = v.strictObject({
  hp: nonnegative, sightRange: nonnegative, sightRangeGraze: nonnegative, sightCone: nonnegative, hearStill: nonnegative,
  hearCrouch: nonnegative, hearWalk: nonnegative, hearSprint: nonnegative, noticeRate: nonnegative, forgetRate: nonnegative,
  alertAt: nonnegative, boltAt: nonnegative, freezeMin: nonnegative, freezeMax: nonnegative, relaxAfter: nonnegative,
  panicDist: nonnegative, runSpeed: nonnegative, trotSpeed: nonnegative, fleeMinTime: nonnegative, fleeUntil: nonnegative,
  fleeUntilMax: nonnegative, fleeMaxTime: nonnegative, lookBack: nonnegative, waryTime: nonnegative, waryBoost: nonnegative,
  herdAlertRadius: nonnegative, herdBoltDelayMin: nonnegative, herdBoltDelayMax: nonnegative, impactSpook: nonnegative, impactAlert: nonnegative,
  stalk: v.exactOptional(stalk),
});
const flight = v.strictObject({ altitude: finite, above: v.exactOptional(v.picklist(['ground', 'world'])),
  climbRate: positive, diveRate: positive, lockRange: v.exactOptional(positive),
  bank: v.exactOptional(v.pipe(positive, v.check(n => n < Math.PI / 2, 'bank below pi/2'))) });
/** Gameplay-only species fields. Native brain, view, parent selection and recipe stay outside the authored row. */
export type SpeciesData = Omit<SpeciesRow, 'parent' | 'think' | 'act'>;
/** Strict species data, with bounded ordered variants and no native callback fields. */
export const SpeciesSchema = v.strictObject({
  id, kind: id, label: text, variants: v.pipe(v.array(variant), v.minLength(1), v.maxLength(64)),
  spawnOnly: v.exactOptional(v.pipe(v.array(variant), v.maxLength(64))), aggressive: v.exactOptional(v.boolean()),
  walkSpeed: v.exactOptional(nonnegative), chargeSpeed: v.exactOptional(nonnegative), chargeDamage: v.exactOptional(nonnegative),
  chargeWindup: v.exactOptional(nonnegative), ringRadius: v.exactOptional(nonnegative), trampleRadius: v.exactOptional(nonnegative),
  tuning: v.exactOptional(tuning), sounds: v.exactOptional(v.strictObject({ call: text, hurt: text,
    callVariants: v.exactOptional(v.pipe(v.array(text), v.maxLength(64))), callEvery: v.exactOptional(ordered) })),
  tick: v.exactOptional(v.picklist(['ai', 'always'])), corpseFade: v.exactOptional(nonnegative), blood: v.exactOptional(v.boolean()),
  flight: v.exactOptional(flight), lockable: v.exactOptional(v.boolean()),
});
/** Refuse malformed species data before registration, setup draws, actor construction or view creation. */
export function species(data: unknown): SpeciesData { return v.parse(SpeciesSchema, data); }

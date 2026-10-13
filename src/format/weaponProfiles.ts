import * as v from 'valibot';
import { isJsonData } from './json';

const scalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(10000));
const positive = v.pipe(scalar, v.minValue(0.000001));
const seconds = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(86400));
const duration = v.pipe(seconds, v.minValue(0.000001));
const count = v.pipe(scalar, v.integer(), v.maxValue(1024));
const slots = v.pipe(count, v.minValue(1));
const probability = v.pipe(scalar, v.maxValue(1));
const swing = v.pipe(v.strictObject({ windup: seconds, slashEnd: duration, total: duration, damage: scalar,
  stagger: v.exactOptional(scalar), sweep: v.exactOptional(v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000))), reach: v.exactOptional(positive) }),
  v.check(row => row.windup <= row.slashEnd && row.slashEnd <= row.total, 'Ordered native swing phases'));
const flight = v.strictObject({ gravity: scalar, drag: scalar, windCoupling: scalar });
const cone = v.strictObject({ degrees: scalar, radius: v.picklist(['linear', 'sqrt']), axisScale: v.picklist([1, 2]) });

/** Renderer-free contact and clock parameters for the shared melee/swept family. Poses and trails belong to WP-4 views. */
export const MeleeWeaponProfileSchema = v.strictObject({
  family: v.literal('melee'), damage: scalar, reach: positive, swingScale: positive,
  cooldown: seconds, comboGap: seconds, chainLag: seconds, heavyCharge: duration,
  moves: v.strictObject({ combo: v.pipe(v.array(swing), v.minLength(1), v.maxLength(16)), heavy: swing,
    passes: v.exactOptional(v.strictObject({ left: swing, right: swing })) }),
  mounted: v.exactOptional(v.strictObject({ reach: positive, cooldown: seconds, sense: scalar, chainWindow: seconds,
    chainStep: scalar, chainMax: v.pipe(scalar, v.minValue(1)), speedDivisor: positive,
    behind: v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000)) })),
  lunge: v.pipe(v.strictObject({ range: scalar, heavyRange: scalar, cone: scalar, stop: scalar,
    speed: positive, minTime: seconds, maxTime: seconds }), v.check(row => row.minTime <= row.maxTime, 'Ordered lunge duration')),
  sweep: v.strictObject({ rays: slots, extensions: v.pipe(v.array(scalar), v.minLength(1), v.maxLength(32)), step: positive, maxSamples: slots, maxHits: slots }),
});

/** Shared held/full-release bow timing and flight numbers; wind, aim, bodies and ammunition remain native owner ports. */
export const BowWeaponProfileSchema = v.strictObject({
  family: v.literal('bow'), quiver: count, speedBase: scalar, speedDraw: scalar, damageScale: scalar,
  draw: v.pipe(v.strictObject({ drawTime: duration, letdownTime: duration, renockTime: duration, renockEarly: probability,
    holdSteady: seconds, holdTire: duration, tiredTime: seconds }), v.check(row => row.holdSteady < row.holdTire, 'Ordered bow fatigue')),
  spread: v.strictObject({ ...cone.entries, aimMultiplier: probability, motion: scalar }), flight, muzzle: scalar, pool: slots, substeps: v.pipe(slots, v.maxValue(64)), lifetime: duration,
});

/** Magazine, per-round lever and single-bolt parameters for the shared firearm family. Rendering and sounds are separate. */
export const FirearmWeaponProfileSchema = v.strictObject({
  family: v.literal('firearm'), action: v.picklist(['semi', 'lever', 'bolt']), magazine: slots, reserve: count,
  interval: seconds, reload: duration, reloadMode: v.picklist(['magazine', 'perRound', 'single']), autoReload: seconds,
  damageScale: scalar, range: positive, spreadAds: scalar, spreadHip: scalar, spreadRadius: v.picklist(['linear', 'sqrt']), spreadAxisScale: v.optional(v.picklist([1, 2])),
  bloomShot: scalar, bloomMax: scalar, movingSpread: scalar, movingAimReduction: probability,
  lever: v.exactOptional(v.strictObject({ cycleDelay: seconds, cycleTime: duration, reloadIn: seconds, reloadOut: seconds,
    ejectAt: probability, cockAt: probability, autoReloadClose: duration })),
  projectile: v.strictObject({ kind: v.picklist(['bullet', 'bolt']), delivery: v.picklist(['hitscan', 'flight']),
    speed: scalar, radius: scalar, muzzle: v.optional(scalar), flight, pool: slots, substeps: v.pipe(slots, v.maxValue(64)), lifetime: duration }),
});

/** Existing ThrownProfile numeric launch, pool, pickup and recovery fields as data; no target, RNG or physics authority. */
export const ThrownWeaponProfileSchema = v.pipe(v.strictObject({
  family: v.literal('thrown'), speed: positive, gravity: scalar, damage: scalar, headMultiplier: scalar,
  radius: positive, headOffset: scalar, windup: duration, release: duration, recovery: duration,
  carried: count, pool: slots, pickupRadius: positive, pickupHeight: positive, survive: probability,
  arcPoints: v.pipe(slots, v.minValue(2)), arcAfter: seconds, stagger: scalar,
}), v.check(row => row.carried <= row.pool, 'Carried thrown weapons fit the native pool'));

/** Native timed lash contacts: bounded unroll/double-crack clocks, pull/stagger reactions and named pipeline moves.
 * The profile supplies values only; the trusted family retains its contact ordering and continuation. */
export const LashWeaponProfileSchema = v.pipe(v.strictObject({
  family: v.literal('lash'),
  contact: v.exactOptional(v.strictObject({ chestHeight: scalar, bodyAllowance: scalar })),
  timing: v.strictObject({ unroll: duration, second: duration, show: duration, stagger: scalar, pull: positive, pullMaxHp: positive }),
  moves: v.strictObject({ light: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    first: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), second: v.pipe(v.string(), v.minLength(1), v.maxLength(128)) }),
}), v.check(row => row.timing.second > row.timing.unroll && row.timing.show > row.timing.unroll, 'Ordered native lash contacts'));

const contactTag = v.custom<`${string}.${string}`>((value) => typeof value === 'string'
  && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value) && value.length <= 128);
const reaction = v.variant('kind', [
  v.strictObject({ when: v.picklist(['before', 'survived']), kind: v.literal('impulse'),
    direction: v.picklist(['radial-away', 'aim-backward']), speed: scalar,
    lift: v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000)), maxHealth: v.exactOptional(scalar) }),
  v.strictObject({ when: v.picklist(['before', 'survived']), kind: v.literal('stagger'),
    strength: scalar, aboveHealth: v.exactOptional(scalar) }),
]);
/** Ordered cone/lane contacts, with authority supplied by the trusted owner rather than JSON. */
export const MeleeContactRowSchema = v.pipe(v.strictObject({
  lane: v.picklist(['primary', 'secondary']), heavy: v.boolean(), cooldown: seconds,
  shape: v.picklist(['cone', 'lane']), reach: v.pipe(positive, v.maxValue(20)),
  size: v.pipe(positive, v.maxValue(20)), height: v.pipe(scalar, v.maxValue(20)), allowance: v.pipe(scalar, v.maxValue(20)),
  lands: v.pipe(v.array(seconds), v.maxLength(16)), show: seconds, reports: v.boolean(),
  hits: v.pipe(v.array(v.strictObject({ source: v.picklist(['owner', 'env']), damage: scalar,
    tags: v.pipe(v.array(contactTag), v.maxLength(32)), moveId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    copyVectors: v.boolean(), copyTags: v.boolean(), reactions: v.pipe(v.array(reaction), v.maxLength(16)) })), v.minLength(1), v.maxLength(16)),
}), v.check(row => row.lands.length === 0 ? row.hits.length === 1
  : row.lands.length === row.hits.length && row.lands.every((at, i) => at <= row.show && (i === 0 || at > (row.lands[i - 1] ?? Infinity))),
  'Immediate contact or ordered one-hit-per-landing contacts'));
type AuthoredContact<T> = T extends readonly (infer U)[] ? readonly AuthoredContact<U>[]
  : T extends object ? { readonly [K in keyof T]: AuthoredContact<T[K]> } : T;
/** Literal authored rows accept readonly arrays; the engine retains their declared vector/tag ownership. */
export type MeleeContactRow = AuthoredContact<v.InferOutput<typeof MeleeContactRowSchema>>;
/** Optional item attachment, bounded before the shared contact controller allocates its moves. */
export const MeleeContactsSchema = v.pipe(v.array(MeleeContactRowSchema), v.minLength(1), v.maxLength(16));
/** Cone contacts read slash damage/cooldowns from the item; this profile declares the reach allowance and gust. */
export const ConeWeaponProfileSchema = v.strictObject({
  family: v.literal('cone'), slash: v.strictObject({ reachAllowance: v.pipe(scalar, v.maxValue(20)) }),
  gust: v.strictObject({ reach: positive, halfAngle: v.pipe(positive, v.maxValue(Math.PI)),
    push: scalar, lift: scalar, damage: scalar, cooldown: seconds,
    tags: v.pipe(v.array(contactTag), v.maxLength(32)),
    move: v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u), v.maxLength(128)),
  }),
});
/** Parsed cone contact parameters; view poses, input and body authority stay outside the profile. */
export type ConeWeaponProfile = v.InferOutput<typeof ConeWeaponProfileSchema>;

/** Bounded numeric weapon profiles. Optional item attachment is additive; native family controllers stay with their owners. */
export const WeaponProfileSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only weapon profile'),
  v.variant('family', [MeleeWeaponProfileSchema, BowWeaponProfileSchema, FirearmWeaponProfileSchema, ThrownWeaponProfileSchema, LashWeaponProfileSchema, ConeWeaponProfileSchema]));
/** Authored numeric profile, independent of engine, game, renderer and injected view callbacks. */
export type WeaponProfile = v.InferOutput<typeof WeaponProfileSchema>;
/** Validate all bounds and relationships before allocation or passing data to a native family. */
export function parseWeaponProfile(input: unknown): WeaponProfile { return v.parse(WeaponProfileSchema, input); }

const nativeKey = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const nativeBinding = v.strictObject({ key: nativeKey,
  source: v.picklist(['constant', 'primary', 'secondary', 'time', 'heavy', 'landed', 'target', 'world', 'direction']),
  constant: v.exactOptional(v.pipe(v.number(), v.finite())),
  min: v.exactOptional(v.pipe(v.number(), v.finite())), max: v.exactOptional(v.pipe(v.number(), v.finite())) });
/** Fixed-step melee owner policy. Contacts stay on the item; continuation fields preserve an existing wire contract. */
export const NativeMeleeRowSchema = v.pipe(v.strictObject({
  step: nativeKey, eye: v.pipe(scalar, v.maxValue(20)), mode: v.picklist(['timed', 'immediate']),
  pitchLimit: v.nullable(v.pipe(positive, v.maxValue(Math.PI))), zeroAim: v.picklist(['retain', 'refuse']),
  body: v.picklist(['volumes', 'none']), liveTargetsOnly: v.boolean(), commandsAfterCool: v.boolean(),
  actions: v.pipe(v.array(v.strictObject({ action: v.pipe(count, v.maxValue(15)), move: v.pipe(count, v.maxValue(15)),
    aim: v.picklist(['selected', 'facing']), hook: v.nullable(v.picklist([3, 4])) })), v.minLength(1), v.maxLength(16)),
  continuation: v.strictObject({ encoding: v.picklist(['json', 'object']), fields: v.pipe(v.array(nativeBinding), v.minLength(1), v.maxLength(16)) }),
}), v.check(row => new Set(row.actions.map(action => action.action)).size === row.actions.length
  && new Set(row.continuation.fields.map(field => field.key)).size === row.continuation.fields.length
  && new Set(row.continuation.fields.map(field => field.source)).size === row.continuation.fields.length
  && row.continuation.fields.every(field => (field.source === 'constant') === (field.constant !== undefined)
    && (field.min === undefined || field.max === undefined || field.min <= field.max))
  && (row.mode === 'timed' ? ['primary', 'time', 'heavy', 'landed', 'target', 'world', 'direction'] : ['primary', 'secondary'])
    .every(source => row.continuation.fields.some(field => field.source === source)), 'Unique actions and complete native melee continuation'));
/** Authoring accepts literal readonly rows; the host validates before installing its step. */
export type NativeMeleeRow = AuthoredContact<v.InferOutput<typeof NativeMeleeRowSchema>>;
/** Refuse malformed owner policies before allocating contacts or registering a step. */
export function parseNativeMeleeRow(input: unknown): v.InferOutput<typeof NativeMeleeRowSchema> { return v.parse(NativeMeleeRowSchema, input); }

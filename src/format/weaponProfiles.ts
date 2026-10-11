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
  timing: v.strictObject({ unroll: duration, second: duration, show: duration, stagger: scalar, pull: positive, pullMaxHp: positive }),
  moves: v.strictObject({ light: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    first: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), second: v.pipe(v.string(), v.minLength(1), v.maxLength(128)) }),
}), v.check(row => row.timing.second > row.timing.unroll && row.timing.show > row.timing.unroll, 'Ordered native lash contacts'));

/** Bounded numeric weapon profiles. Optional item attachment is additive; native family controllers stay with their owners. */
export const WeaponProfileSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only weapon profile'),
  v.variant('family', [MeleeWeaponProfileSchema, BowWeaponProfileSchema, FirearmWeaponProfileSchema, ThrownWeaponProfileSchema, LashWeaponProfileSchema]));
/** Authored numeric profile, independent of engine, game, renderer and injected view callbacks. */
export type WeaponProfile = v.InferOutput<typeof WeaponProfileSchema>;
/** Validate all bounds and relationships before allocation or passing data to a native family. */
export function parseWeaponProfile(input: unknown): WeaponProfile { return v.parse(WeaponProfileSchema, input); }

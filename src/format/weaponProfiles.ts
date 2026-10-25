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
export const MeleeWeaponProfileSchema: v.StrictObjectSchema<{ readonly family: v.GenericSchema<MeleeWeaponProfileRowsInput['family'], MeleeWeaponProfileRows['family']>; readonly damage: v.GenericSchema<MeleeWeaponProfileRowsInput['damage'], MeleeWeaponProfileRows['damage']>; readonly reach: v.GenericSchema<MeleeWeaponProfileRowsInput['reach'], MeleeWeaponProfileRows['reach']>; readonly swingScale: v.GenericSchema<MeleeWeaponProfileRowsInput['swingScale'], MeleeWeaponProfileRows['swingScale']>; readonly cooldown: v.GenericSchema<MeleeWeaponProfileRowsInput['cooldown'], MeleeWeaponProfileRows['cooldown']>; readonly comboGap: v.GenericSchema<MeleeWeaponProfileRowsInput['comboGap'], MeleeWeaponProfileRows['comboGap']>; readonly chainLag: v.GenericSchema<MeleeWeaponProfileRowsInput['chainLag'], MeleeWeaponProfileRows['chainLag']>; readonly heavyCharge: v.GenericSchema<MeleeWeaponProfileRowsInput['heavyCharge'], MeleeWeaponProfileRows['heavyCharge']>; readonly moves: v.GenericSchema<MeleeWeaponProfileRowsInput['moves'], MeleeWeaponProfileRows['moves']>; readonly mounted: v.ExactOptionalSchema<v.GenericSchema<Exclude<MeleeWeaponProfileRowsInput['mounted'], undefined>, Exclude<MeleeWeaponProfileRows['mounted'], undefined>>, undefined>; readonly lunge: v.GenericSchema<MeleeWeaponProfileRowsInput['lunge'], MeleeWeaponProfileRows['lunge']>; readonly sweep: v.GenericSchema<MeleeWeaponProfileRowsInput['sweep'], MeleeWeaponProfileRows['sweep']>; }, undefined> = v.strictObject({
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
export const BowWeaponProfileSchema: v.StrictObjectSchema<{ readonly family: v.GenericSchema<BowWeaponProfileRowsInput['family'], BowWeaponProfileRows['family']>; readonly quiver: v.GenericSchema<BowWeaponProfileRowsInput['quiver'], BowWeaponProfileRows['quiver']>; readonly speedBase: v.GenericSchema<BowWeaponProfileRowsInput['speedBase'], BowWeaponProfileRows['speedBase']>; readonly speedDraw: v.GenericSchema<BowWeaponProfileRowsInput['speedDraw'], BowWeaponProfileRows['speedDraw']>; readonly damageScale: v.GenericSchema<BowWeaponProfileRowsInput['damageScale'], BowWeaponProfileRows['damageScale']>; readonly draw: v.GenericSchema<BowWeaponProfileRowsInput['draw'], BowWeaponProfileRows['draw']>; readonly spread: v.GenericSchema<BowWeaponProfileRowsInput['spread'], BowWeaponProfileRows['spread']>; readonly flight: v.GenericSchema<BowWeaponProfileRowsInput['flight'], BowWeaponProfileRows['flight']>; readonly muzzle: v.GenericSchema<BowWeaponProfileRowsInput['muzzle'], BowWeaponProfileRows['muzzle']>; readonly pool: v.GenericSchema<BowWeaponProfileRowsInput['pool'], BowWeaponProfileRows['pool']>; readonly substeps: v.GenericSchema<BowWeaponProfileRowsInput['substeps'], BowWeaponProfileRows['substeps']>; readonly lifetime: v.GenericSchema<BowWeaponProfileRowsInput['lifetime'], BowWeaponProfileRows['lifetime']>; }, undefined> = v.strictObject({
  family: v.literal('bow'), quiver: count, speedBase: scalar, speedDraw: scalar, damageScale: scalar,
  draw: v.pipe(v.strictObject({ drawTime: duration, letdownTime: duration, renockTime: duration, renockEarly: probability,
    holdSteady: seconds, holdTire: duration, tiredTime: seconds }), v.check(row => row.holdSteady < row.holdTire, 'Ordered bow fatigue')),
  spread: v.strictObject({ ...cone.entries, aimMultiplier: probability, motion: scalar }), flight, muzzle: scalar, pool: slots, substeps: v.pipe(slots, v.maxValue(64)), lifetime: duration,
});

/** Serializable held-bow feel, clocks and mounting policy. A null final gait
 * bound represents infinity on the wire; view strategies come from the bake. */
export const HeldBowBaseSchema: v.GenericSchema<HeldBowBaseRowsInput, HeldBowBaseRows> = v.strictObject({
  family: v.literal('bow'), parent: v.exactOptional(v.pipe(v.string(), v.regex(/^(weapon|tool)\.[a-zA-Z0-9.-]+$/u, 'Invalid held bow parent'))), quiver: count,
  swayMax: scalar, speedBase: scalar, speedDraw: scalar, damageScale: scalar,
  aimZoom: scalar, aimVmZoom: scalar, aimSway: scalar, aimSpread: scalar, aimIn: scalar,
  arcFrom: scalar, arcColour: v.number(), arcMode: v.picklist(['setting', 'aim']), zoomLook: v.boolean(),
  inspectZ: v.number(), inspectHidesArms: v.boolean(), transparentParts: v.boolean(), vmScale: scalar,
  draw: v.exactOptional(BowWeaponProfileSchema.entries.draw),
  loose: v.exactOptional(v.strictObject({ ...cone.entries, aimMultiplier: v.exactOptional(probability), motion: scalar, muzzle: scalar })),
  projectile: v.exactOptional(v.strictObject({ ...flight.entries, maxFlying: slots, substeps: slots, lifetime: duration })),
  mounted: v.exactOptional(v.strictObject({ drawTime: duration, rearAngle: scalar, rearDraw: scalar, rearSpread: scalar, arc: v.boolean(),
    gaits: v.pipe(v.array(v.strictObject({ below: v.nullable(scalar), spread: scalar })), v.minLength(1), v.maxLength(32), v.check(gaits => !gaits.some(({ below }, index) => below === null ? index !== gaits.length - 1 : index > 0 && below <= (gaits[index - 1]?.below ?? Infinity)), 'Invalid held bow gaits')) })),
});

/** Magazine, per-round lever and single-bolt parameters for the shared firearm family. Rendering and sounds are separate. */
export const FirearmWeaponProfileSchema: v.StrictObjectSchema<{ readonly family: v.GenericSchema<FirearmWeaponProfileRowsInput['family'], FirearmWeaponProfileRows['family']>; readonly action: v.GenericSchema<FirearmWeaponProfileRowsInput['action'], FirearmWeaponProfileRows['action']>; readonly magazine: v.GenericSchema<FirearmWeaponProfileRowsInput['magazine'], FirearmWeaponProfileRows['magazine']>; readonly reserve: v.GenericSchema<FirearmWeaponProfileRowsInput['reserve'], FirearmWeaponProfileRows['reserve']>; readonly interval: v.GenericSchema<FirearmWeaponProfileRowsInput['interval'], FirearmWeaponProfileRows['interval']>; readonly reload: v.GenericSchema<FirearmWeaponProfileRowsInput['reload'], FirearmWeaponProfileRows['reload']>; readonly reloadMode: v.GenericSchema<FirearmWeaponProfileRowsInput['reloadMode'], FirearmWeaponProfileRows['reloadMode']>; readonly autoReload: v.GenericSchema<FirearmWeaponProfileRowsInput['autoReload'], FirearmWeaponProfileRows['autoReload']>; readonly damageScale: v.GenericSchema<FirearmWeaponProfileRowsInput['damageScale'], FirearmWeaponProfileRows['damageScale']>; readonly range: v.GenericSchema<FirearmWeaponProfileRowsInput['range'], FirearmWeaponProfileRows['range']>; readonly spreadAds: v.GenericSchema<FirearmWeaponProfileRowsInput['spreadAds'], FirearmWeaponProfileRows['spreadAds']>; readonly spreadHip: v.GenericSchema<FirearmWeaponProfileRowsInput['spreadHip'], FirearmWeaponProfileRows['spreadHip']>; readonly spreadRadius: v.GenericSchema<FirearmWeaponProfileRowsInput['spreadRadius'], FirearmWeaponProfileRows['spreadRadius']>; readonly spreadAxisScale: v.OptionalSchema<v.GenericSchema<Exclude<FirearmWeaponProfileRowsInput['spreadAxisScale'], undefined>, Exclude<FirearmWeaponProfileRows['spreadAxisScale'], undefined>>, undefined>; readonly bloomShot: v.GenericSchema<FirearmWeaponProfileRowsInput['bloomShot'], FirearmWeaponProfileRows['bloomShot']>; readonly bloomMax: v.GenericSchema<FirearmWeaponProfileRowsInput['bloomMax'], FirearmWeaponProfileRows['bloomMax']>; readonly movingSpread: v.GenericSchema<FirearmWeaponProfileRowsInput['movingSpread'], FirearmWeaponProfileRows['movingSpread']>; readonly movingAimReduction: v.GenericSchema<FirearmWeaponProfileRowsInput['movingAimReduction'], FirearmWeaponProfileRows['movingAimReduction']>; readonly lever: v.ExactOptionalSchema<v.GenericSchema<Exclude<FirearmWeaponProfileRowsInput['lever'], undefined>, Exclude<FirearmWeaponProfileRows['lever'], undefined>>, undefined>; readonly projectile: v.GenericSchema<FirearmWeaponProfileRowsInput['projectile'], FirearmWeaponProfileRows['projectile']>; }, undefined> = v.strictObject({
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
export const ThrownWeaponProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly family: v.GenericSchema<ThrownWeaponProfileRowsInput['family'], ThrownWeaponProfileRows['family']>; readonly speed: v.GenericSchema<ThrownWeaponProfileRowsInput['speed'], ThrownWeaponProfileRows['speed']>; readonly gravity: v.GenericSchema<ThrownWeaponProfileRowsInput['gravity'], ThrownWeaponProfileRows['gravity']>; readonly damage: v.GenericSchema<ThrownWeaponProfileRowsInput['damage'], ThrownWeaponProfileRows['damage']>; readonly headMultiplier: v.GenericSchema<ThrownWeaponProfileRowsInput['headMultiplier'], ThrownWeaponProfileRows['headMultiplier']>; readonly radius: v.GenericSchema<ThrownWeaponProfileRowsInput['radius'], ThrownWeaponProfileRows['radius']>; readonly headOffset: v.GenericSchema<ThrownWeaponProfileRowsInput['headOffset'], ThrownWeaponProfileRows['headOffset']>; readonly windup: v.GenericSchema<ThrownWeaponProfileRowsInput['windup'], ThrownWeaponProfileRows['windup']>; readonly release: v.GenericSchema<ThrownWeaponProfileRowsInput['release'], ThrownWeaponProfileRows['release']>; readonly recovery: v.GenericSchema<ThrownWeaponProfileRowsInput['recovery'], ThrownWeaponProfileRows['recovery']>; readonly carried: v.GenericSchema<ThrownWeaponProfileRowsInput['carried'], ThrownWeaponProfileRows['carried']>; readonly pool: v.GenericSchema<ThrownWeaponProfileRowsInput['pool'], ThrownWeaponProfileRows['pool']>; readonly pickupRadius: v.GenericSchema<ThrownWeaponProfileRowsInput['pickupRadius'], ThrownWeaponProfileRows['pickupRadius']>; readonly pickupHeight: v.GenericSchema<ThrownWeaponProfileRowsInput['pickupHeight'], ThrownWeaponProfileRows['pickupHeight']>; readonly survive: v.GenericSchema<ThrownWeaponProfileRowsInput['survive'], ThrownWeaponProfileRows['survive']>; readonly arcPoints: v.GenericSchema<ThrownWeaponProfileRowsInput['arcPoints'], ThrownWeaponProfileRows['arcPoints']>; readonly arcAfter: v.GenericSchema<ThrownWeaponProfileRowsInput['arcAfter'], ThrownWeaponProfileRows['arcAfter']>; readonly stagger: v.GenericSchema<ThrownWeaponProfileRowsInput['stagger'], ThrownWeaponProfileRows['stagger']>; }, undefined>, v.CheckAction<{ [K in keyof ThrownWeaponProfileRows]: ThrownWeaponProfileRows[K] }, 'Carried thrown weapons fit the native pool'>]> = v.pipe(v.strictObject({
  family: v.literal('thrown'), speed: positive, gravity: scalar, damage: scalar, headMultiplier: scalar,
  radius: positive, headOffset: scalar, windup: duration, release: duration, recovery: duration,
  carried: count, pool: slots, pickupRadius: positive, pickupHeight: positive, survive: probability,
  arcPoints: v.pipe(slots, v.minValue(2)), arcAfter: seconds, stagger: scalar,
}), v.check(row => row.carried <= row.pool, 'Carried thrown weapons fit the native pool'));

/** Native timed lash contacts: bounded unroll/double-crack clocks, pull/stagger reactions and named pipeline moves.
 * The profile supplies values only; the trusted family retains its contact ordering and continuation. */
export const LashWeaponProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly family: v.GenericSchema<LashWeaponProfileRowsInput['family'], LashWeaponProfileRows['family']>; readonly contact: v.ExactOptionalSchema<v.GenericSchema<Exclude<LashWeaponProfileRowsInput['contact'], undefined>, Exclude<LashWeaponProfileRows['contact'], undefined>>, undefined>; readonly timing: v.GenericSchema<LashWeaponProfileRowsInput['timing'], LashWeaponProfileRows['timing']>; readonly moves: v.GenericSchema<LashWeaponProfileRowsInput['moves'], LashWeaponProfileRows['moves']>; }, undefined>, v.CheckAction<{ [K in keyof LashWeaponProfileRows]: LashWeaponProfileRows[K] }, 'Ordered native lash contacts'>]> = v.pipe(v.strictObject({
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
export const MeleeContactRowSchema: v.GenericSchema<MeleeContactDataInput, MeleeContactData> = v.pipe(v.strictObject({
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
export const MeleeContactsSchema: v.GenericSchema<MeleeContactsRowsInput, MeleeContactsRows> = v.pipe(v.array(MeleeContactRowSchema), v.minLength(1), v.maxLength(16));
/** Cone contacts read slash damage/cooldowns from the item; this profile declares the reach allowance and gust. */
export const ConeWeaponProfileSchema: v.StrictObjectSchema<{
 readonly family: v.LiteralSchema<'cone', undefined>;
 readonly slash: v.GenericSchema<ConeWeaponProfileRowsInput['slash'], ConeWeaponProfileRows['slash']>;
 readonly gust: v.StrictObjectSchema<{
  [Key in Exclude<keyof ConeWeaponProfileRows['gust'], 'tags'>]: v.GenericSchema<ConeWeaponProfileRowsInput['gust'][Key], ConeWeaponProfileRows['gust'][Key]>;
 } & { readonly tags: v.GenericSchema<ConeWeaponProfileRowsInput['gust']['tags'], ConeWeaponProfileRows['gust']['tags']> & {
  readonly pipe: readonly [v.ArraySchema<v.CustomSchema<`${string}.${string}`, undefined>, undefined>, unknown];
 } }, undefined>;
}, undefined> = v.strictObject({
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
export const WeaponProfileSchema: v.GenericSchema<WeaponProfileInput, WeaponProfile> = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only weapon profile'),
  v.variant('family', [MeleeWeaponProfileSchema, BowWeaponProfileSchema, FirearmWeaponProfileSchema, ThrownWeaponProfileSchema, LashWeaponProfileSchema, ConeWeaponProfileSchema]));
/** Authored numeric profile, independent of engine, game, renderer and injected view callbacks. */

/** Validate all bounds and relationships before allocation or passing data to a native family. */
export function parseWeaponProfile(input: unknown): WeaponProfile { return v.parse(WeaponProfileSchema, input); }

const nativeKey = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const nativeBinding = v.strictObject({ key: nativeKey,
  source: v.picklist(['constant', 'primary', 'secondary', 'time', 'heavy', 'landed', 'target', 'world', 'direction']),
  constant: v.exactOptional(v.pipe(v.number(), v.finite())),
  min: v.exactOptional(v.pipe(v.number(), v.finite())), max: v.exactOptional(v.pipe(v.number(), v.finite())) });
const nativeHeld = v.strictObject({ action: v.pipe(count, v.maxValue(15)), mode: v.picklist(['replace', 'after']),
  continuation: v.variant('kind', [v.strictObject({ kind: v.literal('step'), id: nativeKey }),
    v.strictObject({ kind: v.literal('field'), key: nativeKey })]) });
const nativeInput = v.strictObject({ attack: v.pipe(count,v.maxValue(15)), aimActor: v.exactOptional(nativeKey),
  scripts: v.pipe(v.array(v.strictObject({actor:nativeKey,value:v.pipe(count,v.maxValue(65535)),action:v.pipe(count,v.maxValue(15))})),v.maxLength(32)),
  world: v.exactOptional(v.strictObject({light:v.pipe(count,v.maxValue(15)),heavy:v.pipe(count,v.maxValue(15))})) });
/** Fixed-step melee owner policy. Contacts stay on the item; continuation fields preserve an existing wire contract. */
export const NativeMeleeRowSchema: v.GenericSchema<NativeMeleeRowsInput, NativeMeleeRows> = v.pipe(v.strictObject({
  step: nativeKey, input: v.exactOptional(nativeInput), held: v.exactOptional(nativeHeld), eye: v.pipe(scalar, v.maxValue(20)), mode: v.picklist(['timed', 'immediate']),
  pitchLimit: v.nullable(v.pipe(positive, v.maxValue(Math.PI))), zeroAim: v.picklist(['retain', 'refuse']),
  body: v.picklist(['volumes', 'none']), liveTargetsOnly: v.boolean(), commandsAfterCool: v.boolean(),
  actions: v.pipe(v.array(v.strictObject({ action: v.pipe(count, v.maxValue(15)), move: v.pipe(count, v.maxValue(15)),
    aim: v.picklist(['selected', 'facing']), hook: v.nullable(v.picklist([3, 4])) })), v.minLength(1), v.maxLength(16)),
  continuation: v.strictObject({ encoding: v.picklist(['json', 'object']), fields: v.pipe(v.array(nativeBinding), v.minLength(1), v.maxLength(16)) }),
}), v.check(row => new Set(row.actions.map(action => action.action)).size === row.actions.length
  && new Set(row.continuation.fields.map(field => field.key)).size === row.continuation.fields.length
  && new Set(row.continuation.fields.map(field => field.source)).size === row.continuation.fields.length
  && (row.held === undefined || row.actions.some(action => action.action === row.held?.action)
    && (row.held.continuation.kind === 'step' ? row.held.continuation.id !== row.step : !row.continuation.fields.some(field => field.key === (row.held?.continuation.kind === 'field' ? row.held.continuation.key : undefined))))
  && (row.input===undefined || [row.input.attack,...row.input.scripts.map(script=>script.action),...(row.input.world===undefined?[]:[row.input.world.light,row.input.world.heavy])].every(id=>row.actions.some(action=>action.action===id))
    && new Set(row.input.scripts.map(script=>`${script.actor}:${script.value}`)).size===row.input.scripts.length)
  && row.continuation.fields.every(field => (field.source === 'constant') === (field.constant !== undefined)
    && (field.min === undefined || field.max === undefined || field.min <= field.max))
  && (row.mode === 'timed' ? ['primary', 'time', 'heavy', 'landed', 'target', 'world', 'direction'] : ['primary', 'secondary'])
    .every(source => row.continuation.fields.some(field => field.source === source)), 'Unique actions and complete native melee continuation'));

/** Admit only the supported native single-bolt or per-round hitscan law, before allocation or RNG. */
export function parseNativeFirearmProfile(input: unknown, mode: 'bolt' | 'lever'): v.InferOutput<typeof FirearmWeaponProfileSchema> {
  if (mode === 'bolt') {
    const p = v.parse(FirearmWeaponProfileSchema, input);
  if (p.action !== 'bolt' || p.magazine !== 1 || p.reloadMode !== 'single' || p.lever !== undefined ||
    p.projectile.kind !== 'bolt' || p.projectile.delivery !== 'flight' || p.projectile.speed <= 0 || p.projectile.radius <= 0 || p.projectile.muzzle === undefined ||
    p.spreadAxisScale === undefined || p.projectile.flight.windCoupling !== 0 || p.range !== 310 ||
    p.bloomShot !== 0 || p.bloomMax !== 0 || p.movingSpread !== 0 || p.movingAimReduction !== 0) throw new Error('Unsupported native single-bolt profile');
  return p;
  }
  const row = v.parse(FirearmWeaponProfileSchema, input);
  if (row.action !== 'lever' || row.reloadMode !== 'perRound' || row.lever === undefined || row.projectile.kind !== 'bullet' || row.projectile.delivery !== 'hitscan'
    || row.bloomShot !== 0 || row.bloomMax !== 0 || row.interval !== row.lever.cycleDelay + row.lever.cycleTime
    || row.projectile.speed !== 0 || row.projectile.radius !== 0 || row.projectile.pool !== 1 || row.projectile.substeps !== 1
    || row.projectile.flight.gravity !== 0 || row.projectile.flight.drag !== 0 || row.projectile.flight.windCoupling !== 0) throw new Error('Unsupported native per-round profile');
  return { ...row, lever: row.lever };
}

// A held firearm's view rows as JSON (game/plugin/heldFirearm HeldModelRows and HeldFirearmRows `presentation`), admitted
// before the host builds anything; shards keep them in data (Nalati's heldRifle.json, Pine's custom/leverDetails rows).
// Plain numbers: JSON holds no non-finite value, and a product section's wire schema has no `finite` action.
const real = v.number(), vec3 = v.tuple([real, real, real]), rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
const primitive = v.strictObject({ kind: v.picklist(['box', 'cylinder', 'cone', 'sphere', 'torus', 'icosahedron', 'capsule']), args: v.pipe(v.array(real), v.maxLength(8)),
  ops: v.exactOptional(v.array(v.union([v.tuple([v.picklist(['translate', 'scale']), real, real, real]), v.tuple([v.picklist(['rotateX', 'rotateY', 'rotateZ']), real])]))) });
const look = v.strictObject({ set: v.exactOptional(rowId), normalScale: v.exactOptional(v.tuple([real, real])), color: v.exactOptional(vec3),
  roughness: v.exactOptional(real), metalness: v.exactOptional(real), envMapIntensity: v.exactOptional(real), specularIntensity: v.exactOptional(real) });
/** A held model's rows (materials, procedural sets, primitive geometry, parts, anchors, glow, brass, root scale). */
export const HeldModelRowsSchema: v.ObjectSchema<{ readonly materials: v.GenericSchema<HeldModelDataInput['materials'], HeldModelData['materials']>; readonly textures: v.ExactOptionalSchema<v.GenericSchema<Exclude<HeldModelDataInput['textures'], undefined>, Exclude<HeldModelData['textures'], undefined>>, undefined>; readonly primitives: v.ExactOptionalSchema<v.GenericSchema<Exclude<HeldModelDataInput['primitives'], undefined>, Exclude<HeldModelData['primitives'], undefined>>, undefined>; readonly parts: v.GenericSchema<HeldModelDataInput['parts'], HeldModelData['parts']>; readonly anchors: v.GenericSchema<HeldModelDataInput['anchors'], HeldModelData['anchors']>; readonly glow: v.ExactOptionalSchema<v.GenericSchema<Exclude<HeldModelDataInput['glow'], undefined>, Exclude<HeldModelData['glow'], undefined>>, undefined>; readonly brass: v.ExactOptionalSchema<v.GenericSchema<Exclude<HeldModelDataInput['brass'], undefined>, Exclude<HeldModelData['brass'], undefined>>, undefined>; readonly scaleRoot: v.ExactOptionalSchema<v.GenericSchema<Exclude<HeldModelDataInput['scaleRoot'], undefined>, Exclude<HeldModelData['scaleRoot'], undefined>>, undefined>; }, undefined> = v.object({
  materials: v.record(rowId, v.union([v.strictObject({ name: rowId, look }), v.strictObject({ name: rowId, basic: v.strictObject({ color: real, opacity: real }) })])),
  textures: v.exactOptional(v.record(rowId, v.strictObject({ set: v.picklist(['gunmetal', 'anodised', 'polymer', 'walnut', 'brushed-steel', 'leather', 'cord', 'bolt']), repeat: v.exactOptional(v.tuple([real, real])) }))),
  primitives: v.exactOptional(v.record(rowId, v.pipe(v.array(primitive), v.maxLength(512)))),
  parts: v.pipe(v.array(v.strictObject({ id: rowId, geometry: rowId, material: rowId, at: v.exactOptional(v.union([rowId, vec3])), rot: v.exactOptional(vec3),
    sighted: v.exactOptional(v.boolean()), hidden: v.exactOptional(v.boolean()), display: v.exactOptional(v.union([v.boolean(), v.strictObject({ rot: vec3 })])) })), v.maxLength(64)),
  anchors: v.record(rowId, vec3),
  glow: v.exactOptional(v.strictObject({ part: rowId, opacity: real })), brass: v.exactOptional(v.strictObject({ geometry: rowId, material: rowId })), scaleRoot: v.exactOptional(v.boolean()),
});
const kick = v.tuple([v.picklist(['right', 'up', 'forward']), real, real]);
/** A held firearm's presentation: the held camera's timing, the muzzle flash, the ejected case, the tracer, the hit muzzle. */
export const HeldPresentationSchema: v.GenericSchema<HeldPresentationRowsInput, HeldPresentationRows> = v.strictObject({
  frame: v.strictObject({ clock: v.picklist(['frame', 'world']), fovWhen: v.picklist(['always', 'active']), recoil: v.strictObject({ decay: real, attack: real, recovery: real }),
    lag: v.strictObject({ gain: real, clampYaw: real, clampPitch: real, k: real, c: real }), clampAfter: v.boolean(),
    readout: v.strictObject({ range: real, mask: real, held: v.boolean(), posed: v.boolean() }) }),
  flash: v.strictObject({ shape: v.strictObject({ size: v.exactOptional(real), y: real, z: real, secondaryZ: real, secondaryScale: vec3, lightY: real, lightZ: real }), colour: real }),
  ejection: v.strictObject({ velocity: v.tuple([kick, kick, kick]), spin: v.tuple([vec3, vec3, vec3]), rotation: v.tuple([real, real, real, real]), floorOffset: real }),
  tracer: v.strictObject({ mode: v.picklist(['segment', 'trail']), points: real, width: real, color: vec3, order: real, lifetime: real, fade: real, markerScale: real }),
  hitMuzzle: vec3,
});
/** Complete held-firearm playback rows, shared by magazine and lever weapons. */
export const HeldFirearmRowsSchema: v.GenericSchema<HeldFirearmRowsInput, HeldFirearmRows> = v.object({ ...HeldModelRowsSchema.entries,
  mount: v.picklist(['ownPass', 'shared']), gate: v.exactOptional(rowId), round: v.exactOptional(rowId),
  brass: v.strictObject({ geometry: rowId, material: rowId }), rotationReads: v.exactOptional(v.record(rowId, rowId)),
  playback: v.strictObject({ groups: v.record(rowId, v.array(v.unknown())),
    inputs: v.array(v.strictObject({ group: rowId, rows: v.unknown() })),
    outputs: v.array(v.strictObject({ group: rowId, rows: v.array(v.strictObject({ property: v.string(), target: v.string(), path: v.array(v.string()) })), target: v.picklist(['frame', 'sight', 'values', 'grip']) })),
    schedule: v.strictObject({ frame: rowId, sight: rowId, pose: rowId, action: v.array(rowId), grip: v.array(rowId) }) }),
  presentation: HeldPresentationSchema,
});
/** Camera and pool tuning for the existing held-firearm owner. */
export const HeldFirearmViewSchema: v.GenericSchema<HeldFirearmViewRowsInput, HeldFirearmViewRows> = v.looseObject({ kick: real, port: vec3,
  sight: v.looseObject({ muzzleZ: real }), timing: v.looseObject({ autoReloadDelay: real, autoReloadClose: v.exactOptional(real) }),
  hip: v.strictObject({ px: real, py: real, pz: real, rx: real, ry: real, rz: real, scale: real }),
  flash: v.strictObject({ frames: real, lightTime: real, light: real, size: v.exactOptional(real) }),
  brass: v.strictObject({ count: real, life: real }), tracer: v.strictObject({ count: real, time: real }),
});
/** Complete baked firearm page; product admission validates it before native allocation. */
export const HeldFirearmPageSchema: v.GenericSchema<HeldFirearmPageRowsInput, HeldFirearmPageRows> = v.object({
  feel: v.looseObject({ ads: v.looseObject({ blend: real }) }),
  view: HeldFirearmViewSchema, rows: HeldFirearmRowsSchema,
});

/** Admit complete playback without changing the existing firearm controller. */
export function parseHeldFirearmRows(input: unknown): v.InferOutput<typeof HeldFirearmRowsSchema> { return v.parse(HeldFirearmRowsSchema, input); }
/** Admit camera/pool rows before the held owner allocates them. */
export function parseHeldFirearmView(input: unknown): v.InferOutput<typeof HeldFirearmViewSchema> { return v.parse(HeldFirearmViewSchema, input); }

/** Admit a held model's JSON rows before building anything. */
export function parseHeldModelRows(input: unknown): v.InferOutput<typeof HeldModelRowsSchema> { return v.parse(HeldModelRowsSchema, input); }
/** Admit a held firearm's presentation rows before building anything. */
export function parseHeldPresentation(input: unknown): v.InferOutput<typeof HeldPresentationSchema> { return v.parse(HeldPresentationSchema, input); }

/** Shared baked bow view rows: borrowed part names, material data and numeric shape samples. */
const heldBowNumber = v.pipe(v.number(), v.finite());
const heldBowTriple = v.tuple([heldBowNumber, heldBowNumber, heldBowNumber]), heldBowNumbers = v.pipe(v.array(heldBowNumber), v.maxLength(65536));
const heldBowPose = v.strictObject({ pos: heldBowTriple, aim: heldBowTriple, cant: heldBowNumber, pitch: heldBowNumber });
const heldBowPainterly = v.strictObject({ rim: v.exactOptional(heldBowNumber), bands: v.exactOptional(heldBowNumber), shade: v.exactOptional(heldBowNumber), transparent: v.exactOptional(v.boolean()) });
const heldBowLook = v.strictObject({ set: v.exactOptional(v.string()), normalScale: v.exactOptional(v.tuple([heldBowNumber, heldBowNumber])), color: v.exactOptional(heldBowTriple),
  roughness: heldBowNumber, metalness: heldBowNumber, envMapIntensity: v.exactOptional(heldBowNumber), specularIntensity: v.exactOptional(heldBowNumber),
  anisotropy: v.exactOptional(heldBowNumber), anisotropyRotation: v.exactOptional(heldBowNumber), emissive: v.exactOptional(heldBowNumber), emissiveIntensity: v.exactOptional(heldBowNumber),
  alphaTest: v.exactOptional(heldBowNumber), vertexColors: v.exactOptional(v.boolean()), forceSinglePass: v.exactOptional(v.boolean()), side: v.exactOptional(v.picklist([0, 1, 2])) });
const heldBowMaterial = v.union([v.strictObject({ name: v.string(), painterly: heldBowPainterly }), v.strictObject({ name: v.string(), look: heldBowLook })]);
/** Baked bow rows support both lit and painterly material data. */
export const HeldBowRowsSchema: v.GenericSchema<HeldBowRowsInput, HeldBowRows> = v.strictObject({
  bake: v.strictObject({ look: v.string(), arrow: v.string(), ringU: heldBowNumbers, ringSign: heldBowNumbers, limbVerts: heldBowNumber, dynVerts: heldBowNumber,
    sectionSamples: v.strictObject({ widths: heldBowNumbers, ridges: heldBowNumbers }), lWrist: heldBowTriple, rWrist: heldBowTriple, rHook: heldBowTriple, rWristDir: heldBowTriple }),
  parts: v.strictObject({ stave: v.string(), nocked: v.string(), rightFist: v.string(), leftSleeve: v.string(), rightSleeve: v.string(), arrow: v.string() }),
  materials: v.strictObject({ bow: heldBowMaterial, arrow: heldBowMaterial }),
  arrow: v.strictObject({ gravity: heldBowNumber, drag: heldBowNumber, windCoupling: heldBowNumber, bury: heldBowNumber, recover: heldBowNumber, maxFlying: heldBowNumber, maxStuck: heldBowNumber }),
  wind: v.union([v.strictObject({ base: heldBowNumber, gust: heldBowNumber }), v.strictObject({ field: v.literal('steppe') })]),
  poses: v.strictObject({ rest: heldBowPose, drawn: heldBowPose, restPort: heldBowPose, drawnPort: heldBowPose, aim: heldBowPose, aimPort: heldBowPose }),
  styles: v.exactOptional(v.pipe(v.record(v.string(), v.string()), v.minEntries(1, 'Invalid held bow styles'), v.maxEntries(8, 'Invalid held bow styles'))),
});

/** Complete held-bow binding; executable view strategies belong to the shared host. */
export const HeldBowDefinitionSchema: v.StrictObjectSchema<{ readonly base: v.GenericSchema<HeldBowDefinitionRowsInput['base'], HeldBowDefinitionRows['base']>; readonly bow: v.GenericSchema<HeldBowDefinitionRowsInput['bow'], HeldBowDefinitionRows['bow']>; }, undefined> = v.strictObject({ base: HeldBowBaseSchema, bow: HeldBowRowsSchema });
/** The same named-pool document admitted before an entered bow reads it. */
const heldBowPoolNames = v.pipe(v.array(v.pipe(v.string(), v.maxLength(256))), v.maxLength(32));
const HeldBowPoolSchema = v.strictObject({ url: v.pipe(v.string(), v.maxLength(512)), parts: heldBowPoolNames, channels: v.exactOptional(v.pipe(v.array(v.strictObject({
  name: v.string(), source: v.string(), width: v.picklist([1, 2, 3, 4]), parts: v.exactOptional(heldBowPoolNames) })), v.maxLength(8))) });
export const HeldBowFileSchema: v.GenericSchema<HeldBowFileRowsInput, HeldBowFileRows> = v.strictObject({ pool: HeldBowPoolSchema, bow: HeldBowRowsSchema, base: HeldBowBaseSchema });


/** Admitted data contracts, independent of validator implementation metadata. */
export type MeleeWeaponProfileRowsInput = MeleeWeaponProfileRows;
interface MeleeWeaponProfileRowsFields {
    family: 'melee';
    damage: number;
    reach: number;
    swingScale: number;
    cooldown: number;
    comboGap: number;
    chainLag: number;
    heavyCharge: number;
    moves: {
        combo: ({
            windup: number;
            slashEnd: number;
            total: number;
            damage: number;
            stagger?: number;
            sweep?: number;
            reach?: number;
        })[];
        heavy: {
            windup: number;
            slashEnd: number;
            total: number;
            damage: number;
            stagger?: number;
            sweep?: number;
            reach?: number;
        };
        passes?: {
            left: {
                windup: number;
                slashEnd: number;
                total: number;
                damage: number;
                stagger?: number;
                sweep?: number;
                reach?: number;
            };
            right: {
                windup: number;
                slashEnd: number;
                total: number;
                damage: number;
                stagger?: number;
                sweep?: number;
                reach?: number;
            };
        };
    };
    mounted?: {
        reach: number;
        cooldown: number;
        sense: number;
        chainWindow: number;
        chainStep: number;
        chainMax: number;
        speedDivisor: number;
        behind: number;
    };
    lunge: {
        range: number;
        heavyRange: number;
        cone: number;
        stop: number;
        speed: number;
        minTime: number;
        maxTime: number;
    };
    sweep: {
        rays: number;
        extensions: (number)[];
        step: number;
        maxSamples: number;
        maxHits: number;
    };
}
export type MeleeWeaponProfileRows = { [Key in keyof MeleeWeaponProfileRowsFields]: MeleeWeaponProfileRowsFields[Key] };
export type BowWeaponProfileRowsInput = BowWeaponProfileRows;
interface BowWeaponProfileRowsFields {
    family: 'bow';
    quiver: number;
    speedBase: number;
    speedDraw: number;
    damageScale: number;
    draw: {
        drawTime: number;
        letdownTime: number;
        renockTime: number;
        renockEarly: number;
        holdSteady: number;
        holdTire: number;
        tiredTime: number;
    };
    spread: {
        aimMultiplier: number;
        motion: number;
    } & {
        degrees: number;
        radius: 'linear' | 'sqrt';
        axisScale: 1 | 2;
    };
    flight: {
        gravity: number;
        drag: number;
        windCoupling: number;
    };
    muzzle: number;
    pool: number;
    substeps: number;
    lifetime: number;
}
export type BowWeaponProfileRows = { [Key in keyof BowWeaponProfileRowsFields]: BowWeaponProfileRowsFields[Key] };
export type FirearmWeaponProfileRowsInput = FirearmWeaponProfileRows;
interface FirearmWeaponProfileRowsFields {
    family: 'firearm';
    action: 'semi' | 'lever' | 'bolt';
    magazine: number;
    reserve: number;
    interval: number;
    reload: number;
    reloadMode: 'magazine' | 'perRound' | 'single';
    autoReload: number;
    damageScale: number;
    range: number;
    spreadAds: number;
    spreadHip: number;
    spreadRadius: 'linear' | 'sqrt';
    spreadAxisScale?: 1 | 2 | undefined;
    bloomShot: number;
    bloomMax: number;
    movingSpread: number;
    movingAimReduction: number;
    lever?: {
        cycleDelay: number;
        cycleTime: number;
        reloadIn: number;
        reloadOut: number;
        ejectAt: number;
        cockAt: number;
        autoReloadClose: number;
    };
    projectile: {
        kind: 'bullet' | 'bolt';
        delivery: 'hitscan' | 'flight';
        speed: number;
        radius: number;
        muzzle?: number | undefined;
        flight: {
            gravity: number;
            drag: number;
            windCoupling: number;
        };
        pool: number;
        substeps: number;
        lifetime: number;
    };
}
export type FirearmWeaponProfileRows = { [Key in keyof FirearmWeaponProfileRowsFields]: FirearmWeaponProfileRowsFields[Key] };
export type ThrownWeaponProfileRowsInput = ThrownWeaponProfileRows;
interface ThrownWeaponProfileRowsFields {
    family: 'thrown';
    speed: number;
    gravity: number;
    damage: number;
    headMultiplier: number;
    radius: number;
    headOffset: number;
    windup: number;
    release: number;
    recovery: number;
    carried: number;
    pool: number;
    pickupRadius: number;
    pickupHeight: number;
    survive: number;
    arcPoints: number;
    arcAfter: number;
    stagger: number;
}
export type ThrownWeaponProfileRows = { [Key in keyof ThrownWeaponProfileRowsFields]: ThrownWeaponProfileRowsFields[Key] };
export type LashWeaponProfileRowsInput = LashWeaponProfileRows;
interface LashWeaponProfileRowsFields {
    family: 'lash';
    contact?: {
        chestHeight: number;
        bodyAllowance: number;
    };
    timing: {
        unroll: number;
        second: number;
        show: number;
        stagger: number;
        pull: number;
        pullMaxHp: number;
    };
    moves: {
        light: string;
        first: string;
        second: string;
    };
}
export type LashWeaponProfileRows = { [Key in keyof LashWeaponProfileRowsFields]: LashWeaponProfileRowsFields[Key] };
interface HeldBowBaseRowsInputFields {
    family: 'bow';
    parent?: string;
    quiver: number;
    swayMax: number;
    speedBase: number;
    speedDraw: number;
    damageScale: number;
    aimZoom: number;
    aimVmZoom: number;
    aimSway: number;
    aimSpread: number;
    aimIn: number;
    arcFrom: number;
    arcColour: number;
    arcMode: 'setting' | 'aim';
    zoomLook: boolean;
    inspectZ: number;
    inspectHidesArms: boolean;
    transparentParts: boolean;
    vmScale: number;
    draw?: v.InferInput<typeof BowWeaponProfileSchema.entries.draw>;
    loose?: {
        aimMultiplier?: number;
        motion: number;
        muzzle: number;
    } & {
        degrees: number;
        radius: 'linear' | 'sqrt';
        axisScale: 1 | 2;
    };
    projectile?: {
        maxFlying: number;
        substeps: number;
        lifetime: number;
    } & {
        gravity: number;
        drag: number;
        windCoupling: number;
    };
    mounted?: {
        drawTime: number;
        rearAngle: number;
        rearDraw: number;
        rearSpread: number;
        arc: boolean;
        gaits: ({
            below: (number) | null;
            spread: number;
        })[];
    };
}
export type HeldBowBaseRowsInput = { [Key in keyof HeldBowBaseRowsInputFields]: HeldBowBaseRowsInputFields[Key] };
interface HeldBowBaseRowsFields {
    family: 'bow';
    parent?: string;
    quiver: number;
    swayMax: number;
    speedBase: number;
    speedDraw: number;
    damageScale: number;
    aimZoom: number;
    aimVmZoom: number;
    aimSway: number;
    aimSpread: number;
    aimIn: number;
    arcFrom: number;
    arcColour: number;
    arcMode: 'setting' | 'aim';
    zoomLook: boolean;
    inspectZ: number;
    inspectHidesArms: boolean;
    transparentParts: boolean;
    vmScale: number;
    draw?: v.InferOutput<typeof BowWeaponProfileSchema.entries.draw>;
    loose?: {
        aimMultiplier?: number;
        motion: number;
        muzzle: number;
    } & {
        degrees: number;
        radius: 'linear' | 'sqrt';
        axisScale: 1 | 2;
    };
    projectile?: {
        maxFlying: number;
        substeps: number;
        lifetime: number;
    } & {
        gravity: number;
        drag: number;
        windCoupling: number;
    };
    mounted?: {
        drawTime: number;
        rearAngle: number;
        rearDraw: number;
        rearSpread: number;
        arc: boolean;
        gaits: ({
            below: (number) | null;
            spread: number;
        })[];
    };
}
export type HeldBowBaseRows = { [Key in keyof HeldBowBaseRowsFields]: HeldBowBaseRowsFields[Key] };
export type MeleeContactDataInput = MeleeContactData;
interface MeleeContactDataFields {
    lane: 'primary' | 'secondary';
    heavy: boolean;
    cooldown: number;
    shape: 'cone' | 'lane';
    reach: number;
    size: number;
    height: number;
    allowance: number;
    lands: (number)[];
    show: number;
    reports: boolean;
    hits: ({
        source: 'owner' | 'env';
        damage: number;
        tags: (`${string}.${string}`)[];
        moveId: string;
        copyVectors: boolean;
        copyTags: boolean;
        reactions: (({
            when: 'before' | 'survived';
            kind: 'impulse';
            direction: 'radial-away' | 'aim-backward';
            speed: number;
            lift: number;
            maxHealth?: number;
        }) | ({
            when: 'before' | 'survived';
            kind: 'stagger';
            strength: number;
            aboveHealth?: number;
        }))[];
    })[];
}
export type MeleeContactData = { [Key in keyof MeleeContactDataFields]: MeleeContactDataFields[Key] };
export type MeleeContactsRowsInput = (MeleeContactDataInput)[];
export type MeleeContactsRows = (MeleeContactData)[];
export type WeaponProfileInput = unknown;
export type WeaponProfile = (MeleeWeaponProfileRows) | (BowWeaponProfileRows) | (FirearmWeaponProfileRows) | (ThrownWeaponProfileRows) | (LashWeaponProfileRows) | ({
    family: 'cone';
    slash: {
        reachAllowance: number;
    };
    gust: {
        reach: number;
        halfAngle: number;
        push: number;
        lift: number;
        damage: number;
        cooldown: number;
        tags: (`${string}.${string}`)[];
        move: string;
    };
});
export type NativeMeleeRowsInput = NativeMeleeRows;
interface NativeMeleeRowsFields {
    step: string;
    input?: {
        attack: number;
        aimActor?: string;
        scripts: ({
            actor: string;
            value: number;
            action: number;
        })[];
        world?: {
            light: number;
            heavy: number;
        };
    };
    held?: {
        action: number;
        mode: 'replace' | 'after';
        continuation: ({
            kind: 'step';
            id: string;
        }) | ({
            kind: 'field';
            key: string;
        });
    };
    eye: number;
    mode: 'timed' | 'immediate';
    pitchLimit: (number) | null;
    zeroAim: 'retain' | 'refuse';
    body: 'volumes' | 'none';
    liveTargetsOnly: boolean;
    commandsAfterCool: boolean;
    actions: ({
        action: number;
        move: number;
        aim: 'selected' | 'facing';
        hook: (3 | 4) | null;
    })[];
    continuation: {
        encoding: 'json' | 'object';
        fields: ({
            key: string;
            source: 'constant' | 'primary' | 'secondary' | 'time' | 'heavy' | 'landed' | 'target' | 'world' | 'direction';
            constant?: number;
            min?: number;
            max?: number;
        })[];
    };
}
export type NativeMeleeRows = { [Key in keyof NativeMeleeRowsFields]: NativeMeleeRowsFields[Key] };
export type HeldModelDataInput = HeldModelData;
interface HeldModelDataFields {
    materials: Record<string, ({
        name: string;
        look: {
            set?: string;
            normalScale?: [
                number,
                number
            ];
            color?: [
                number,
                number,
                number
            ];
            roughness?: number;
            metalness?: number;
            envMapIntensity?: number;
            specularIntensity?: number;
        };
    }) | ({
        name: string;
        basic: {
            color: number;
            opacity: number;
        };
    })>;
    textures?: Record<string, {
        set: 'gunmetal' | 'anodised' | 'polymer' | 'walnut' | 'brushed-steel' | 'leather' | 'cord' | 'bolt';
        repeat?: [
            number,
            number
        ];
    }>;
    primitives?: Record<string, ({
        kind: 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'icosahedron' | 'capsule';
        args: (number)[];
        ops?: (([
            'translate' | 'scale',
            number,
            number,
            number
        ]) | ([
            'rotateX' | 'rotateY' | 'rotateZ',
            number
        ]))[];
    })[]>;
    parts: ({
        id: string;
        geometry: string;
        material: string;
        at?: (string) | ([
            number,
            number,
            number
        ]);
        rot?: [
            number,
            number,
            number
        ];
        sighted?: boolean;
        hidden?: boolean;
        display?: (boolean) | ({
            rot: [
                number,
                number,
                number
            ];
        });
    })[];
    anchors: Record<string, [
        number,
        number,
        number
    ]>;
    glow?: {
        part: string;
        opacity: number;
    };
    brass?: {
        geometry: string;
        material: string;
    };
    scaleRoot?: boolean;
}
export type HeldModelData = { [Key in keyof HeldModelDataFields]: HeldModelDataFields[Key] };
export type HeldPresentationRowsInput = HeldPresentationRows;
interface HeldPresentationRowsFields {
    frame: {
        clock: 'frame' | 'world';
        fovWhen: 'always' | 'active';
        recoil: {
            decay: number;
            attack: number;
            recovery: number;
        };
        lag: {
            gain: number;
            clampYaw: number;
            clampPitch: number;
            k: number;
            c: number;
        };
        clampAfter: boolean;
        readout: {
            range: number;
            mask: number;
            held: boolean;
            posed: boolean;
        };
    };
    flash: {
        shape: {
            size?: number;
            y: number;
            z: number;
            secondaryZ: number;
            secondaryScale: [
                number,
                number,
                number
            ];
            lightY: number;
            lightZ: number;
        };
        colour: number;
    };
    ejection: {
        velocity: [
            [
                'right' | 'up' | 'forward',
                number,
                number
            ],
            [
                'right' | 'up' | 'forward',
                number,
                number
            ],
            [
                'right' | 'up' | 'forward',
                number,
                number
            ]
        ];
        spin: [
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ]
        ];
        rotation: [
            number,
            number,
            number,
            number
        ];
        floorOffset: number;
    };
    tracer: {
        mode: 'segment' | 'trail';
        points: number;
        width: number;
        color: [
            number,
            number,
            number
        ];
        order: number;
        lifetime: number;
        fade: number;
        markerScale: number;
    };
    hitMuzzle: [
        number,
        number,
        number
    ];
}
export type HeldPresentationRows = { [Key in keyof HeldPresentationRowsFields]: HeldPresentationRowsFields[Key] };
export type HeldFirearmRowsInput = {
    mount: 'ownPass' | 'shared';
    gate?: string;
    round?: string;
    brass: {
        geometry: string;
        material: string;
    };
    rotationReads?: Record<string, string>;
    playback: {
        groups: Record<string, (unknown)[]>;
        inputs: ({
            group: string;
            rows: unknown;
        })[];
        outputs: ({
            group: string;
            rows: ({
                property: string;
                target: string;
                path: (string)[];
            })[];
            target: 'frame' | 'sight' | 'values' | 'grip';
        })[];
        schedule: {
            frame: string;
            sight: string;
            pose: string;
            action: (string)[];
            grip: (string)[];
        };
    };
    presentation: HeldPresentationRowsInput;
} & HeldModelDataInput;
export type HeldFirearmRows = {
    mount: 'ownPass' | 'shared';
    gate?: string;
    round?: string;
    brass: {
        geometry: string;
        material: string;
    };
    rotationReads?: Record<string, string>;
    playback: {
        groups: Record<string, (unknown)[]>;
        inputs: ({
            group: string;
            rows: unknown;
        })[];
        outputs: ({
            group: string;
            rows: ({
                property: string;
                target: string;
                path: (string)[];
            })[];
            target: 'frame' | 'sight' | 'values' | 'grip';
        })[];
        schedule: {
            frame: string;
            sight: string;
            pose: string;
            action: (string)[];
            grip: (string)[];
        };
    };
    presentation: HeldPresentationRows;
} & HeldModelData;
export type HeldFirearmViewRowsInput = HeldFirearmViewRows;
export type HeldFirearmViewRows = ({
    kick: number;
    port: [
        number,
        number,
        number
    ];
    sight: ({
        muzzleZ: number;
    }) & Record<string, unknown>;
    timing: ({
        autoReloadDelay: number;
        autoReloadClose?: number;
    }) & Record<string, unknown>;
    hip: {
        px: number;
        py: number;
        pz: number;
        rx: number;
        ry: number;
        rz: number;
        scale: number;
    };
    flash: {
        frames: number;
        lightTime: number;
        light: number;
        size?: number;
    };
    brass: {
        count: number;
        life: number;
    };
    tracer: {
        count: number;
        time: number;
    };
}) & Record<string, unknown>;
interface HeldFirearmPageRowsInputFields {
    feel: ({
        ads: ({
            blend: number;
        }) & Record<string, unknown>;
    }) & Record<string, unknown>;
    view: HeldFirearmViewRowsInput;
    rows: HeldFirearmRowsInput;
}
export type HeldFirearmPageRowsInput = { [Key in keyof HeldFirearmPageRowsInputFields]: HeldFirearmPageRowsInputFields[Key] };
interface HeldFirearmPageRowsFields {
    feel: ({
        ads: ({
            blend: number;
        }) & Record<string, unknown>;
    }) & Record<string, unknown>;
    view: HeldFirearmViewRows;
    rows: HeldFirearmRows;
}
export type HeldFirearmPageRows = { [Key in keyof HeldFirearmPageRowsFields]: HeldFirearmPageRowsFields[Key] };
export type HeldBowRowsInput = HeldBowRows;
interface HeldBowRowsFields {
    bake: {
        look: string;
        arrow: string;
        ringU: (number)[];
        ringSign: (number)[];
        limbVerts: number;
        dynVerts: number;
        sectionSamples: {
            widths: (number)[];
            ridges: (number)[];
        };
        lWrist: [
            number,
            number,
            number
        ];
        rWrist: [
            number,
            number,
            number
        ];
        rHook: [
            number,
            number,
            number
        ];
        rWristDir: [
            number,
            number,
            number
        ];
    };
    parts: {
        stave: string;
        nocked: string;
        rightFist: string;
        leftSleeve: string;
        rightSleeve: string;
        arrow: string;
    };
    materials: {
        bow: ({
            name: string;
            painterly: {
                rim?: number;
                bands?: number;
                shade?: number;
                transparent?: boolean;
            };
        }) | ({
            name: string;
            look: {
                set?: string;
                normalScale?: [
                    number,
                    number
                ];
                color?: [
                    number,
                    number,
                    number
                ];
                roughness: number;
                metalness: number;
                envMapIntensity?: number;
                specularIntensity?: number;
                anisotropy?: number;
                anisotropyRotation?: number;
                emissive?: number;
                emissiveIntensity?: number;
                alphaTest?: number;
                vertexColors?: boolean;
                forceSinglePass?: boolean;
                side?: 0 | 1 | 2;
            };
        });
        arrow: ({
            name: string;
            painterly: {
                rim?: number;
                bands?: number;
                shade?: number;
                transparent?: boolean;
            };
        }) | ({
            name: string;
            look: {
                set?: string;
                normalScale?: [
                    number,
                    number
                ];
                color?: [
                    number,
                    number,
                    number
                ];
                roughness: number;
                metalness: number;
                envMapIntensity?: number;
                specularIntensity?: number;
                anisotropy?: number;
                anisotropyRotation?: number;
                emissive?: number;
                emissiveIntensity?: number;
                alphaTest?: number;
                vertexColors?: boolean;
                forceSinglePass?: boolean;
                side?: 0 | 1 | 2;
            };
        });
    };
    arrow: {
        gravity: number;
        drag: number;
        windCoupling: number;
        bury: number;
        recover: number;
        maxFlying: number;
        maxStuck: number;
    };
    wind: ({
        base: number;
        gust: number;
    }) | ({
        field: 'steppe';
    });
    poses: {
        rest: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
        drawn: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
        restPort: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
        drawnPort: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
        aim: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
        aimPort: {
            pos: [
                number,
                number,
                number
            ];
            aim: [
                number,
                number,
                number
            ];
            cant: number;
            pitch: number;
        };
    };
    styles?: Record<string, string>;
}
export type HeldBowRows = { [Key in keyof HeldBowRowsFields]: HeldBowRowsFields[Key] };
interface HeldBowDefinitionRowsInputFields {
    base: HeldBowBaseRowsInput;
    bow: HeldBowRowsInput;
}
export type HeldBowDefinitionRowsInput = { [Key in keyof HeldBowDefinitionRowsInputFields]: HeldBowDefinitionRowsInputFields[Key] };
interface HeldBowDefinitionRowsFields {
    base: HeldBowBaseRows;
    bow: HeldBowRows;
}
export type HeldBowDefinitionRows = { [Key in keyof HeldBowDefinitionRowsFields]: HeldBowDefinitionRowsFields[Key] };
interface HeldBowFileRowsInputFields {
    pool: {
        url: string;
        parts: (string)[];
        channels?: ({
            name: string;
            source: string;
            width: 1 | 2 | 3 | 4;
            parts?: (string)[];
        })[];
    };
    bow: HeldBowRowsInput;
    base: HeldBowBaseRowsInput;
}
export type HeldBowFileRowsInput = { [Key in keyof HeldBowFileRowsInputFields]: HeldBowFileRowsInputFields[Key] };
interface HeldBowFileRowsFields {
    pool: {
        url: string;
        parts: (string)[];
        channels?: ({
            name: string;
            source: string;
            width: 1 | 2 | 3 | 4;
            parts?: (string)[];
        })[];
    };
    bow: HeldBowRows;
    base: HeldBowBaseRows;
}
export type HeldBowFileRows = { [Key in keyof HeldBowFileRowsFields]: HeldBowFileRowsFields[Key] };

/** Admitted data contracts, independent of validator implementation metadata. */
export type ConeWeaponProfileRowsInput = ConeWeaponProfileRows;
interface ConeWeaponProfileRowsFields {
    family: 'cone';
    slash: {
        reachAllowance: number;
    };
    gust: {
        reach: number;
        halfAngle: number;
        push: number;
        lift: number;
        damage: number;
        cooldown: number;
        tags: (`${string}.${string}`)[];
        move: string;
    };
}
export type ConeWeaponProfileRows = { [Key in keyof ConeWeaponProfileRowsFields]: ConeWeaponProfileRowsFields[Key] };

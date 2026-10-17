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

/** Serializable held-bow feel, clocks and mounting policy. A null final gait
 * bound represents infinity on the wire; view strategies come from the bake. */
export const HeldBowBaseSchema = v.strictObject({
  family: v.literal('bow'), parent: v.exactOptional(v.string()), quiver: count,
  swayMax: scalar, speedBase: scalar, speedDraw: scalar, damageScale: scalar,
  aimZoom: scalar, aimVmZoom: scalar, aimSway: scalar, aimSpread: scalar, aimIn: scalar,
  arcFrom: scalar, arcColour: v.number(), arcMode: v.picklist(['setting', 'aim']), zoomLook: v.boolean(),
  inspectZ: v.number(), inspectHidesArms: v.boolean(), transparentParts: v.boolean(), vmScale: scalar,
  draw: v.exactOptional(BowWeaponProfileSchema.entries.draw.pipe[0]),
  loose: v.exactOptional(v.strictObject({ ...cone.entries, aimMultiplier: v.exactOptional(probability), motion: scalar, muzzle: scalar })),
  projectile: v.exactOptional(v.strictObject({ ...flight.entries, maxFlying: slots, substeps: slots, lifetime: duration })),
  mounted: v.exactOptional(v.strictObject({ drawTime: duration, rearAngle: scalar, rearDraw: scalar, rearSpread: scalar, arc: v.boolean(),
    gaits: v.pipe(v.array(v.strictObject({ below: v.nullable(scalar), spread: scalar })), v.minLength(1), v.maxLength(32)) })),
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
const nativeHeld = v.strictObject({ action: v.pipe(count, v.maxValue(15)), mode: v.picklist(['replace', 'after']),
  continuation: v.variant('kind', [v.strictObject({ kind: v.literal('step'), id: nativeKey }),
    v.strictObject({ kind: v.literal('field'), key: nativeKey })]) });
const nativeInput = v.strictObject({ attack: v.pipe(count,v.maxValue(15)), aimActor: v.exactOptional(nativeKey),
  scripts: v.pipe(v.array(v.strictObject({actor:nativeKey,value:v.pipe(count,v.maxValue(65535)),action:v.pipe(count,v.maxValue(15))})),v.maxLength(32)),
  world: v.exactOptional(v.strictObject({light:v.pipe(count,v.maxValue(15)),heavy:v.pipe(count,v.maxValue(15))})) });
/** Fixed-step melee owner policy. Contacts stay on the item; continuation fields preserve an existing wire contract. */
export const NativeMeleeRowSchema = v.pipe(v.strictObject({
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
/** Authoring accepts literal readonly rows; the host validates before installing its step. */
export type NativeMeleeRow = AuthoredContact<v.InferOutput<typeof NativeMeleeRowSchema>>;
/** Refuse malformed owner policies before allocating contacts or registering a step. */
export function parseNativeMeleeRow(input: unknown): v.InferOutput<typeof NativeMeleeRowSchema> { return v.parse(NativeMeleeRowSchema, input); }

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
export const HeldModelRowsSchema = v.object({
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
export const HeldPresentationSchema = v.strictObject({
  frame: v.strictObject({ clock: v.picklist(['frame', 'world']), fovWhen: v.picklist(['always', 'active']), recoil: v.strictObject({ decay: real, attack: real, recovery: real }),
    lag: v.strictObject({ gain: real, clampYaw: real, clampPitch: real, k: real, c: real }), clampAfter: v.boolean(),
    readout: v.strictObject({ range: real, mask: real, held: v.boolean(), posed: v.boolean() }) }),
  flash: v.strictObject({ shape: v.strictObject({ size: v.exactOptional(real), y: real, z: real, secondaryZ: real, secondaryScale: vec3, lightY: real, lightZ: real }), colour: real }),
  ejection: v.strictObject({ velocity: v.tuple([kick, kick, kick]), spin: v.tuple([vec3, vec3, vec3]), rotation: v.tuple([real, real, real, real]), floorOffset: real }),
  tracer: v.strictObject({ mode: v.picklist(['segment', 'trail']), points: real, width: real, color: vec3, order: real, lifetime: real, fade: real, markerScale: real }),
  hitMuzzle: vec3,
});
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
export const HeldBowRowsSchema = v.strictObject({
  bake: v.strictObject({ look: v.string(), arrow: v.string(), ringU: heldBowNumbers, ringSign: heldBowNumbers, limbVerts: heldBowNumber, dynVerts: heldBowNumber,
    sectionSamples: v.strictObject({ widths: heldBowNumbers, ridges: heldBowNumbers }), lWrist: heldBowTriple, rWrist: heldBowTriple, rHook: heldBowTriple, rWristDir: heldBowTriple }),
  parts: v.strictObject({ stave: v.string(), nocked: v.string(), rightFist: v.string(), leftSleeve: v.string(), rightSleeve: v.string(), arrow: v.string() }),
  materials: v.strictObject({ bow: heldBowMaterial, arrow: heldBowMaterial }),
  arrow: v.strictObject({ gravity: heldBowNumber, drag: heldBowNumber, windCoupling: heldBowNumber, bury: heldBowNumber, recover: heldBowNumber, maxFlying: heldBowNumber, maxStuck: heldBowNumber }),
  wind: v.union([v.strictObject({ base: heldBowNumber, gust: heldBowNumber }), v.strictObject({ field: v.literal('steppe') })]),
  poses: v.strictObject({ rest: heldBowPose, drawn: heldBowPose, restPort: heldBowPose, drawnPort: heldBowPose, aim: heldBowPose, aimPort: heldBowPose }),
  styles: v.exactOptional(v.record(v.string(), v.string())),
});

/** Complete held-bow binding; executable view strategies belong to the shared host. */
export const HeldBowDefinitionSchema = v.strictObject({ base: HeldBowBaseSchema, bow: HeldBowRowsSchema });

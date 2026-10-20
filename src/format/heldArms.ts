import * as v from 'valibot';
import { ToonLightingSchema } from './toonLighting';
import { PrivateSceneSchema } from './clientChannels';
import { QuestStepRowsSchema } from './questSteps';
import { isJsonData } from './json';

const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const names = v.pipe(v.array(name), v.minLength(1), v.maxLength(64),
  v.check(rows => new Set(rows).size === rows.length));
const vector = v.tuple([finite, finite, finite]);

/** G475 held arms: rig contract, camera framing and graph material bindings supplied by a shard's rows.
 * The sword rig's semantic mesh/socket protocol is owned by RigArms; materials are catalogue identities.
 * Pickup materials may accompany the held look for the same asset's world display. No services or callbacks. */
export const ToonArmsLookSchema = v.strictObject({
  id: name, url: name, skeleton: name, sockets: names,
  lighting: ToonLightingSchema,
  joints: v.strictObject({ sides: names, arm: names, fingers: names,
    phalanges: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)) }),
  offset: vector,
  frame: v.strictObject({ size: v.pipe(finite, v.minValue(0.001)), pitch: finite, yaw: finite, roll: finite }),
  sunward: finite, bladeBase: finite,
  swim: v.strictObject({ tilt: finite, handsZ: finite, waterY: finite, startD: finite }),
  materials: v.strictObject({ arms: name, wood: name, iron: name, swim: name,
    pickupBlade: v.exactOptional(name), pickupFittings: v.exactOptional(name) }),
});

/** Admitted held-arm data. The host checks the corresponding material catalogue when it is lent. */
export type ToonArmsLook = v.InferOutput<typeof ToonArmsLookSchema>;
/** Admit before loading the rig or borrowing any graph material. */
export function parseToonArmsLook(input: unknown): ToonArmsLook { return v.parse(ToonArmsLookSchema, input); }

/** Held sword families, Explorer cards and optional world claims, all driven by the same rig/look catalogue. */
export const HeldArmsSchema = v.strictObject({ slug: name, look: ToonArmsLookSchema,
  weapons: v.pipe(v.array(v.strictObject({ item: name, blade: v.picklist(['wood', 'iron']) })), v.minLength(1), v.maxLength(16)),
  cards: v.pipe(v.array(v.strictObject({ id: name, name, file: name, kind: v.picklist(['wood', 'iron']),
    size: vector, copies: v.pipe(finite, v.integer(), v.minValue(0)) })), v.maxLength(16)),
  claims: v.pipe(v.array(v.strictObject({ id: name, item: name, at: name, position: vector,
    owned: name, prompt: name, toast: name, scene: PrivateSceneSchema, group: name,
    geometries: v.record(name, name), materials: v.record(name, name), seedXor: finite,
    lift: finite, scale: finite, tilt: finite, radius: finite,
    guard: v.strictObject({ condition: QuestStepRowsSchema.entries.guards.item, radius: finite, toast: name }),
    light: v.strictObject({ colour: finite, intensity: finite, distance: finite, decay: finite, height: finite }),
    halo: v.strictObject({ size: finite, colour: finite, opacity: finite, flickerOpacity: finite,
      height: finite, scale: finite, order: finite, stops: v.pipe(v.array(v.tuple([finite,finite])),v.maxLength(16)) }),
    phase: finite, waves: v.pipe(v.array(v.tuple([finite,finite])),v.maxLength(16)),
    fade: v.strictObject({ light: finite, opacity: finite, scale: finite }),
  })), v.maxLength(16)),
});
/** Admitted catalogue shared by entered equipment and cold Explorer cards. */
export type HeldArmsRows = v.InferOutput<typeof HeldArmsSchema>;

const count = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4096));
const bounded = <T extends v.GenericSchema>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
/** G475 held arms drawn in graph looks: a skinned rig played by the shared arm player (its blade row is the hit sweep's
 * and the swing trail's), its meshes dressed from rows, the trail sampled along the blade during each swing, and the
 * per-frame look writes as named sources. Client-only presentation; ids only, no callbacks. */
export const GraphArmsSchema = v.strictObject({
  rig: v.strictObject({ url: name, skeleton: name, sockets: names, joints: bounded(names, 8), holdRight: bounded(name, 32), holdLeft: bounded(name, 32),
    walkRate: finite, lag: v.strictObject({ max: finite, pitch: finite, yaw: finite }) }),
  /** the blade on its socket: base and tip along the socket's +Y (rig units) */
  blade: v.strictObject({ socket: name, base: finite, tip: finite }),
  /** the swing trail: ribbon profile, its look and seed param, its life as a share of the clip (or `total` s), sampled from `from` of the blade */
  trail: v.strictObject({ look: name, seed: name, samples: count, subdivisions: count, movementSq: finite, life: finite, total: finite, from: finite, order: finite }),
  /** meshes whose name starts with this show with the claw */
  claw: name,
  /** every look's params, by look id; a frame source with no look writes each look that declares its param */
  params: v.record(name, bounded(name, 128)),
  meshes: bounded(v.strictObject({ name, channels: v.record(name, name), look: name, maps: v.exactOptional(name), hull: v.boolean(), doubleSide: v.boolean() }), 64),
  /** per-mesh map pairs: `<base><maps>-<kind>.webp` (or its KTX2 stand-in) lent to the mesh look's params */
  maps: v.strictObject({ base: name, names, kinds: v.strictObject({ maps: name, nrm: name }), anisotropy: finite }),
  /** an R8 repeating weave (a product file of size² texels) and a painted canvas atlas scaled by a plumbing knob */
  weave: v.strictObject({ file: name, size: count, param: name }),
  decal: v.strictObject({ atlas: v.custom<Readonly<Record<string, unknown>>>(isJsonData), knob: name, param: name }),
  back: bounded(name, 64), additive: bounded(name, 64),
  /** the pendants: a private scene on a socket, its geometry read from product JSON (a file of named geometries, or one `field` as `name`) */
  pendants: v.strictObject({ socket: name, scene: PrivateSceneSchema, materials: bounded(name, 64),
    geometry: bounded(v.union([v.strictObject({ file: name }), v.strictObject({ file: name, field: name, name })]), 16) }),
  frame: bounded(v.strictObject({ look: v.exactOptional(name), param: name, source: v.picklist(['time', 'buffer', 'pixels', 'projection']),
    scale: v.exactOptional(finite), min: v.exactOptional(finite) }), 32),
});
export type GraphArmsRow = v.InferOutput<typeof GraphArmsSchema>;
/** Admit before loading the rig, its looks or any texture. */
export function parseGraphArms(input: unknown): GraphArmsRow { return v.parse(GraphArmsSchema, input); }

import * as v from 'valibot';
import { isJsonData } from './json';
import { ScenePointRefSchema, type ScenePointRef } from './sceneRefs';

/** A building leaf/static solid, independent of a renderer or physics backend. */
export interface BuildingCollider { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw?: number; surface?: 'stone' | 'wood' }
/** Compatibility floor boxes remain data while old native floor consumers retire. */
export interface BuildingBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
export interface BuildingFloor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
export interface BuildingRoom { x: number; z: number; hw: number; hd: number }
export type BuildingLightKind = 'fire' | 'lamp';
export type BuildingWave = readonly [rate: number, seedScale: number, amount: number];

export type Xyz = readonly [number, number, number];

/** A light as a building record holds it: colour, intensity, range, decay, where (in its parent's frame), seed, kind, rank. */
export interface BakedBuildingLight {
  readonly color: number; readonly intensity: number; readonly distance: number; readonly decay: number; readonly at: Xyz;
  readonly seed: number; readonly kind: BuildingLightKind; readonly rank: number;
}

/**
 * What a building adds to its root, in the order it added it (a number names a geometry in the pack): a swinging door
 * (leaf, hinges, battens on its pivot; `collider` its legacy box, `top` that box's closed top, `use` its prompt's spot,
 * `slab` the leaf's box in the pivot's frame), a glow, a fire pit's model copy, a particle cloud (`seeds` its instance
 * seeds, `mat` its program), a hung lantern (its pivot, ring and light), a wheel on its pivot, and a light on the root.
 */
export type BakedBuildingNode<P extends string> =
  | { readonly t: 'door'; readonly pivot: Xyz; readonly leaf: number; readonly iron: number; readonly batten: number; readonly id: string; readonly collider: number; readonly top: number; readonly use: Xyz; readonly slab: BuildingCollider }
  | { readonly t: 'glow'; readonly g: number; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'pit'; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'particles'; readonly mat: P; readonly seeds: number; readonly at: Xyz; readonly order: number; readonly detail: boolean }
  | { readonly t: 'lantern'; readonly pivot: Xyz; readonly ring: number; readonly light: BakedBuildingLight; readonly swing: number }
  | { readonly t: 'wheel'; readonly g: number; readonly at: Xyz; readonly yaw: number }
  | { readonly t: 'light'; readonly light: BakedBuildingLight };

/** One building as its bake wrote it (world space unless said); `K` names its kit materials, `P` its particle programs. */
export interface BakedBuildingRecord<K extends string, P extends string> {
  readonly at: Xyz;
  readonly rot: number;
  /** its parts per kit material, in the order they first came: one geometry each */
  readonly parts: readonly (readonly [K, number])[];
  /** its window groups, one geometry each */
  readonly glass: readonly number[];
  readonly nodes: readonly BakedBuildingNode<P>[];
  /** its legacy boxes (the door's among them) */
  readonly colliders: readonly BuildingBox[];
  /** its static solids (`prop`: a prop model's own box, which its model registers) */
  readonly solids: readonly { readonly d: BuildingCollider; readonly prop: boolean }[];
  readonly floors: readonly BuildingFloor[];
  /** its rooms, in its own frame */
  readonly rooms: readonly BuildingRoom[];
  readonly doorAt: readonly [number, number];
  /** where its fire pit stands (world space), handed to its owner */
  readonly firePit: Xyz | null;
}

/** How a shard's baked buildings dress and band (a shard's data row); `K` names its kit materials. */
export interface BakedBuildingLook<K extends string = string> {
  /** small parts drawn only within the detail distance, their depth only through the near proxy */
  readonly detail: readonly K[];
  /** merged parts drawn within twice the detail distance */
  readonly far: readonly K[];
  /** a door's leaf, hinge and batten materials, its prompt's reach (m) and its prompts closed and open */
  readonly door: { readonly leaf: K; readonly hinges: K; readonly battens: K; readonly reach: number; readonly open: string; readonly close: string };
  /** a wheel's material */
  readonly wheel: K;
  /**
   * The hung lantern: its ring's material and drop (m); the model copy's drop (m) and scale on its pivot; the material name
   * (any case) that marks its glass; the glass and the frame rebuilt as plain standard materials (the glTF's physical
   * brass and tangents gave NaN fragments): the glass lit by the clock at its emissive intensity.
   */
  readonly lantern: {
    readonly ring: K; readonly ringY: number; readonly drop: number; readonly scale: number; readonly glassName: string;
    readonly glass: { readonly color: number; readonly emissive: Xyz; readonly emissiveIntensity: number; readonly roughness: number; readonly metalness: number; readonly opacity: number };
    readonly frame: { readonly metalness: number; readonly roughness: number; readonly color: number };
  };
  /** every particle cloud's bounding sphere in its own frame */
  readonly particles: { readonly center: Xyz; readonly radius: number };
  /** a building's box reaches this far below and above each of its floors (m) */
  readonly deck: readonly [below: number, above: number];
}


/** Live quality choices are copied at assembly; no getter or code crosses the host boundary. */
export interface BakedBuildingTier { readonly detailDist: number; readonly detailShadows: boolean; readonly sharedLights: boolean }
export type BakedBuildingRole = 'standalone' | 'member' | 'specimen';
/** Assembly uses named, platform-owned native resources. All variation is JSON. */
export interface BuildingAssemblyRows<K extends string = string, P extends string = string> {
  readonly id: string;
  readonly record: BakedBuildingRecord<K, P>;
  readonly geometry: Readonly<Record<string, string>>;
  readonly materials: { readonly parts: Readonly<Record<K, string>>; readonly particles: Readonly<Record<P, string>>; readonly glass: string; readonly glow: string };
  readonly models: { readonly firePit: string; readonly lantern: string };
  readonly role: BakedBuildingRole;
  readonly look: BakedBuildingLook<K>;
  readonly tier: BakedBuildingTier;
  /** Frozen scene rows own all static shell meshes and their depth; only living nodes assemble here. */
  readonly bakedStatic?: boolean;
  /** Optional Z2 publication prefix for this building's root, dressing and native material loans. */
  readonly publish?: string;
}
/** A smoke/ember cloud is either baked quads or a seed geometry instanced as unit quads. */
export interface BuildingCloudRow {
  readonly geometry: string; readonly material: string | null; readonly seeds: boolean;
  readonly name: string; readonly at: Xyz | ScenePointRef; readonly center: Xyz; readonly radius: number;
  /** Convert a referenced world point into this named parent's local frame. */
  readonly parent?: string;
  readonly order: number; readonly visible: boolean;
}
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const pair = v.tuple([finite, finite]);
const triple = v.tuple([finite, finite, finite]);
const waves = v.pipe(v.array(triple), v.maxLength(32));
/** Clock presentation and reversible doors; validated without loading a client view. */
export const BuildingLifeLookSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Building look requires plain JSON'), v.strictObject({
  wheel: finite, door: v.strictObject({ seconds: v.pipe(finite, v.minValue(0.001)), angle: finite, collision: v.exactOptional(v.strictObject({ name: id, file: id, surface: v.picklist(['wood', 'stone', 'metal']), rearmRadius: nonnegative })) }),
  flicker: v.strictObject({ depth: finite, waves }), fire: pair, lamp: pair, glass: pair,
  swing: v.strictObject({ z: waves, x: pair }),
  indoor: v.exactOptional(v.strictObject({ doorRadius: nonnegative, ranks: v.pipe(v.array(finite), v.maxLength(32)) })),
}));
export interface BuildingLifeLook {
  readonly wheel: number;
  readonly door: { readonly seconds: number; readonly angle: number; readonly collision?: { readonly name: string; readonly file: string; readonly surface: 'wood' | 'stone' | 'metal'; readonly rearmRadius: number } };
  readonly flicker: { readonly depth: number; readonly waves: readonly BuildingWave[] };
  readonly fire: readonly [number, number]; readonly lamp: readonly [number, number]; readonly glass: readonly [number, number];
  readonly swing: { readonly z: readonly BuildingWave[]; readonly x: readonly [number, number] };
  readonly indoor?: { readonly doorRadius: number; readonly ranks: readonly number[] };
}
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: nonnegative, hy: nonnegative, hz: nonnegative,
  yaw: v.exactOptional(finite), surface: v.exactOptional(v.picklist(['stone', 'wood'])) });
const lightKind = v.picklist(['fire', 'lamp']);
/** Shared affine/pulse presentation: offset + gain × pulse × night gain. */
const materialPulse = v.strictObject({ material: id, color: triple, offset: finite, gain: finite,
  pulse: pair, waves: v.pipe(v.array(pair), v.maxLength(8)), night: pair });
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T) => v.pipe(v.array(schema), v.maxLength(128));
const door = v.strictObject({ id, pivot: id, at: triple, reach: nonnegative, open: id, close: id, slab: box });
const light = v.strictObject({ light: id, base: finite, seed: finite, kind: lightKind });
const anchor = v.strictObject({ anchor: id, color: finite, intensity: finite, distance: nonnegative, decay: nonnegative, seed: finite, kind: lightKind, rank: finite });
const site = v.strictObject({ id, root: id, anchors: list(anchor),
  rooms: v.exactOptional(list(v.strictObject({ x: finite, z: finite, hw: nonnegative, hd: nonnegative }))),
  door: v.exactOptional(pair) });
/** Typed resource ids, bounded before any prompt or motion owner is allocated. */
export const BuildingLifeRowsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Building life requires plain JSON'),
  v.strictObject({ doors: list(door), swings: list(v.strictObject({ pivot: id, seed: finite })), wheels: list(v.strictObject({ id, object: id })),
    colors: v.optional(list(materialPulse), []), params: v.optional(list(v.strictObject({ look: id, param: id })), []),
    flickers: list(light), lamps: list(v.strictObject({ material: id, full: finite })), sites: list(site), shared: v.pipe(v.array(id), v.maxLength(8)) }));
export type BuildingLifeRows = v.InferOutput<typeof BuildingLifeRowsSchema>;
/** Exact continuation includes in-flight reversal and accumulated wheel phase. */
export const BuildingContinuationSchema = v.strictObject({ version: v.literal(1), speed: finite,
  doors: list(v.strictObject({ id, open: v.boolean(), enabled: v.boolean(), t: v.pipe(finite, v.minValue(0), v.maxValue(1)) })),
  wheels: list(v.strictObject({ id, angle: finite })) });
export type BuildingContinuation = v.InferOutput<typeof BuildingContinuationSchema>;
/** A parsed empty batch is useful when a native/static assembler publishes its first row. */
export function emptyBuildingLifeRows(): BuildingLifeRows { return { doors: [], swings: [], wheels: [], colors: [], params: [], flickers: [], lamps: [], sites: [], shared: [] }; }
export function parseBuildingLifeLook(input: unknown): BuildingLifeLook { return v.parse(BuildingLifeLookSchema, input); }
export function parseBuildingLifeRows(input: unknown): BuildingLifeRows { return v.parse(BuildingLifeRowsSchema, input); }

/** Visual recipe for an ordinary seed or baked-quad cloud. */
export const BuildingCloudSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Building cloud requires plain JSON'), v.strictObject({
  geometry: id, material: v.nullable(id), seeds: v.boolean(), name: v.pipe(v.string(), v.maxLength(256)), at: v.union([triple, ScenePointRefSchema]), center: triple,
  radius: nonnegative, order: finite, visible: v.boolean(), parent: v.exactOptional(id),
}), v.check(row => row.parent === undefined || !Array.isArray(row.at), 'Cloud parent requires a scene point reference'));
const frame = v.strictObject({ metalness: finite, roughness: finite, color: finite });
/** Building appearance is independent of the shape library and the life clock. */
export const BakedBuildingLookSchema = v.strictObject({ detail: list(id), far: list(id),
  door: v.strictObject({ leaf: id, hinges: id, battens: id, reach: nonnegative, open: id, close: id }), wheel: id,
  lantern: v.strictObject({ ring: id, ringY: finite, drop: finite, scale: finite, glassName: id,
    glass: v.strictObject({ color: finite, emissive: triple, emissiveIntensity: finite, roughness: finite, metalness: finite, opacity: finite }), frame }),
  particles: v.strictObject({ center: triple, radius: nonnegative }), deck: pair,
});
const ordinal = v.pipe(nonnegative, v.integer());
const buildingLight = v.strictObject({ color: finite, intensity: finite, distance: nonnegative, decay: nonnegative, at: triple, seed: finite, kind: lightKind, rank: finite });
const buildingNode = v.variant('t', [
  v.strictObject({ t: v.literal('door'), pivot: triple, leaf: ordinal, iron: ordinal, batten: ordinal, id, collider: ordinal, top: finite, use: triple, slab: box }),
  v.strictObject({ t: v.literal('glow'), g: ordinal, at: triple, yaw: finite }),
  v.strictObject({ t: v.literal('pit'), at: triple, yaw: finite }),
  v.strictObject({ t: v.literal('particles'), mat: id, seeds: ordinal, at: triple, order: finite, detail: v.boolean() }),
  v.strictObject({ t: v.literal('lantern'), pivot: triple, ring: ordinal, light: buildingLight, swing: finite }),
  v.strictObject({ t: v.literal('wheel'), g: ordinal, at: triple, yaw: finite }),
  v.strictObject({ t: v.literal('light'), light: buildingLight }),
]);
const refs = v.pipe(v.record(id, id), v.check(rows => Object.keys(rows).length <= 256));
const buildingAssembly = v.pipe(v.unknown(), v.check(isJsonData, 'Building assembly requires plain JSON'), v.strictObject({ id,
  // Author bakes may carry static catalogue metadata alongside the public building record.
  record: v.object({ at: triple, rot: finite, parts: list(v.tuple([id, ordinal])), glass: list(ordinal), nodes: list(buildingNode),
    colliders: list(v.strictObject({ x: finite, z: finite, hw: nonnegative, hd: nonnegative, rot: finite, yTop: finite, yBottom: finite })),
    solids: list(v.strictObject({ d: box, prop: v.boolean() })), floors: list(v.strictObject({ x: finite, z: finite, rot: finite, hw: nonnegative, hd: nonnegative, y: finite })),
    rooms: list(v.strictObject({ x: finite, z: finite, hw: nonnegative, hd: nonnegative })), doorAt: pair, firePit: v.nullable(triple) }),
  geometry: refs, materials: v.strictObject({ parts: refs, particles: refs, glass: id, glow: id }), models: v.strictObject({ firePit: id, lantern: id }),
  role: v.picklist(['standalone', 'member', 'specimen']), look: BakedBuildingLookSchema,
  tier: v.strictObject({ detailDist: nonnegative, detailShadows: v.boolean(), sharedLights: v.boolean() }),
  bakedStatic: v.exactOptional(v.boolean()), publish: v.exactOptional(id),
}));
/** Runtime admission for native and future Z2 publication; geometry/material references
 * are checked by the host against its platform-owned resource context next. */
export function admitBuildingAssembly(input: unknown): void { v.parse(buildingAssembly, input); }

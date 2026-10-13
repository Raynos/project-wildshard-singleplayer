/**
 * The live log kit's validated rows (G285): what both the offline cabin bake (`../generators/logCabin.ts`, which builds
 * every log building) and the page (the landmarks' timber, ./timber.ts; the fire lookout; the baked buildings,
 * ./cabinBake.ts) read. Shape helpers exist only in generators/cabinShapes.ts; the live path reads admitted geometry.
 */
import * as v from 'valibot';
import type { BuildingDoor, BuildingFloor, BuildingFlicker, BuildingLightAnchor, BuildingLightKind, BuildingRoom, BuildingSwing } from '../runtime/props/buildingLife';

/** a building part's material: the PBR sets (homestead.ts `Mats`) a baked part names */
export type KitMat = 'log' | 'endGrain' | 'chink' | 'roof' | 'beam' | 'deck' | 'door' | 'stone' | 'bark' | 'iron' | 'cloth' | 'char';

/** a door: its pivot, state, legacy box, prompt and leaf (@wildshard/sdk/props/buildingLife runs it) */
export type Door = BuildingDoor;
/** `kind`: a fire burns all day and only reads stronger at night; a lamp (lantern, room light) is lit by the clock (PH-L3) */
export type LightKind = BuildingLightKind;
/** a light of its own that flickers */
export type Fire = BuildingFlicker;
/** phone tier: a point light's slot — the shared lights jump to the nearest cabin's anchors (`rank`: which ones get a light) */
export type LightAnchor = BuildingLightAnchor;
/** a room's floor rectangle in the building's frame (inside = the pooled pair lights the room) */
export type Room = BuildingRoom;
/** a swinging pivot (a hung lantern) */
export type Swing = BuildingSwing;
/** a floor / deck rectangle in world space */
export type Floor = BuildingFloor;
export type PropKind = 'crate' | 'barrel' | 'bucket' | 'hatchet';
export const PROP_KINDS: readonly PropKind[] = ['crate', 'barrel', 'bucket', 'hatchet'];

/**
 * PHYSICS P3: a prop's box — the glTF scan's bounds (wooden_crate_02 0.53 × 0.45 × 1.17, wine_barrel_01 ⌀0.74 × 0.87,
 * wooden_bucket_01 ⌀0.35 × 0.35) at scale 1, standing on its foot: half-width across (x), half-depth along (z), height.
 * The hatchet has none (it sits in its chopping block's collider). Each prop model collides as its box (E315).
 */
export const PROP_BOXES: Readonly<Record<PropKind, { readonly hw: number; readonly hd: number; readonly h: number } | null>> = {
  crate: { hw: 0.265, hd: 0.583, h: 0.455 }, barrel: { hw: 0.34, hd: 0.34, h: 0.872 }, bucket: { hw: 0.17, hd: 0.17, h: 0.35 }, hatchet: null,
};

// ───────────────────────────── the baked buildings' rows (data/cabins.json) ─────────────────────────────

const n = v.pipe(v.number(), v.finite()), xyz = v.tuple([n, n, n]);
const Light = v.strictObject({ color: n, intensity: n, distance: n, decay: n, at: xyz, seed: n, kind: v.picklist(['fire', 'lamp']), rank: n });
/** a static box solid as the builder emitted it (world space, turned by `yaw`) */
const BoxRow = v.strictObject({ kind: v.literal('box'), x: n, y: n, z: n, hx: n, hy: n, hz: n, yaw: v.exactOptional(n), surface: v.exactOptional(v.picklist(['stone', 'wood'])) });
/** a legacy box (src/engine/physics/box.ts `BoxSpec`) */
const LegacyRow = v.strictObject({ x: n, z: n, hw: n, hd: n, rot: n, yTop: n, yBottom: n });
/**
 * What a building adds to its root, in the order it added it. A number names a geometry in the bake's binary (by index):
 * a swinging door (leaf, strap hinges, battens on its pivot; `collider` its legacy box), a fire glow, the fire pit's model
 * copy, a particle cloud (its instance seeds are geometry `seeds`), the porch lantern (its pivot, the ring, its light), the
 * mill wheel on its pivot, and a light straight on the root.
 */
const Node = v.variant('t', [
  v.strictObject({ t: v.literal('door'), pivot: xyz, leaf: n, iron: n, batten: n, id: v.string(), collider: n, top: n, use: xyz, slab: BoxRow }),
  v.strictObject({ t: v.literal('glow'), g: n, at: xyz, yaw: n }),
  v.strictObject({ t: v.literal('pit'), at: xyz, yaw: n }),
  v.strictObject({ t: v.literal('particles'), mat: v.picklist(['flame', 'ember', 'smoke']), seeds: n, at: xyz, order: n, detail: v.boolean() }),
  v.strictObject({ t: v.literal('lantern'), pivot: xyz, ring: n, light: Light, swing: n }),
  v.strictObject({ t: v.literal('wheel'), g: n, at: xyz, yaw: n }),
  v.strictObject({ t: v.literal('light'), light: Light }),
]);
const KIT_MATS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly KitMat[];
const Matrices = v.array(v.array(n));
/** one building as the bake built it where it stands (world space unless said) */
const Building = v.strictObject({
  id: v.string(), index: n, hamlet: v.boolean(), at: xyz, rot: n,
  /** its main room's width (across the ridge) and length (along it), m */
  size: v.tuple([n, n]),
  /** its parts per material, in the order they first came: one geometry each (the builder's list, merged) */
  parts: v.array(v.tuple([v.picklist(KIT_MATS), n])),
  /** its window groups, one geometry each */
  glass: v.array(n),
  nodes: v.array(Node),
  /** its legacy boxes (the door's among them) and its static solids (`prop`: a prop model's own box) */
  colliders: v.array(LegacyRow),
  solids: v.array(v.strictObject({ d: BoxRow, prop: v.boolean() })),
  floors: v.array(v.strictObject({ x: n, z: n, rot: n, hw: n, hd: n, y: n })),
  rooms: v.array(v.strictObject({ x: n, z: n, hw: n, hd: n })),
  doorAt: v.tuple([n, n]),
  /** the props it set about: world matrices (column-major) per kind */
  props: v.strictObject({ crate: Matrices, barrel: Matrices, bucket: Matrices, hatchet: Matrices }),
  firePit: v.nullable(xyz),
});
/** One geometry in the binary: its attributes (name, item size), its vertices (`unique` stored, expanded by `index` when
 *  it was built without one), or its own index (`own`: u16 / u32) kept as built. */
const Geometry = v.strictObject({ attrs: v.array(v.tuple([v.string(), n])), count: n, unique: n, own: v.nullable(v.picklist(['u16', 'u32'])), indexCount: n });
/** the bake's rows: the binary's content hash and size, its geometries in byte order, the buildings, the hamlet's root */
export const CabinRowsSchema = v.strictObject({ bin: v.string(), bytes: n, geometries: v.array(Geometry), buildings: v.array(Building), hamlet: v.nullable(v.strictObject({ at: xyz, pad: n })) });
export type CabinRows = v.InferOutput<typeof CabinRowsSchema>;
export type BakedBuilding = v.InferOutput<typeof Building>;
export type BakedNode = v.InferOutput<typeof Node>;
export type BakedLight = v.InferOutput<typeof Light>;
export type BakedGeometry = v.InferOutput<typeof Geometry>;


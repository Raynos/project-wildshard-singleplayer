import * as v from 'valibot';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { Material } from '@wildshard/engine/physics/surface';
import baked from './physics.baked.json' with { type: 'json' };

/** The baked floor's lattice: Rapier's own 256² heightfield over the 500 m chunk, as the page built it (crag cuts included). */
export const PINE_GROUND_RES = 256, PINE_GROUND_SIZE = 500;

const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite }), triple = v.tuple([finite, finite, finite]);
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.exactOptional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite,
    headAt: v.exactOptional(triple), bodyAt: v.exactOptional(triple), bodyPitch: v.exactOptional(finite),
    fore: v.exactOptional(v.strictObject({ bone: v.string(), at: triple, halfLen: finite, radius: finite })) }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });
const Actor = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, spec: BakedSpec, seed: finite, scale: finite, scripted: v.boolean() });
const Parked = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), spec: BakedSpec, seed: finite, scale: finite });
// Exhaustive against the defining engine union; no untagged solid acquires an invented material.
const materials: Readonly<Record<Material, true>> = { sand: true, wetSand: true, grass: true, rock: true, planks: true, stone: true, water: true,
  wood: true, metal: true, flesh: true, shell: true, ground: true, edge: true, felt: true, earth: true };
const MaterialSchema = v.custom<Material>(input => typeof input === 'string' && Object.hasOwn(materials, input), 'Unknown baked Pine material');
const Solid = v.strictObject({ shape: v.picklist([1, 2, 6, 9]), groups: finite, friction: finite, body: v.nullable(finite), at: triple, rot: v.tuple([finite, finite, finite, finite]),
  material: v.exactOptional(MaterialSchema),
  ownerId: v.exactOptional(v.pipe(v.string(), v.regex(/^(?:piece|declared):[^\r\n]{1,256}$/u))),
  half: v.exactOptional(triple), halfHeight: v.exactOptional(finite), radius: v.exactOptional(finite), vertices: v.exactOptional(v.string()), indices: v.exactOptional(v.string()) });
const KingHit = v.strictObject({ head: triple, body: v.tuple([triple, triple]), fore: v.tuple([triple, triple]), ribs: triple, radius: v.pipe(finite, v.minValue(0.001)) });
const Bake = v.object({ version: v.literal(1),
  ground: v.strictObject({ rows: v.literal(PINE_GROUND_RES - 1), cols: v.literal(PINE_GROUND_RES - 1), scale: xyz, at: xyz, friction: finite, groups: finite, heights: v.string() }),
  kingHit: KingHit, solids: v.array(Solid), actors: v.array(Actor), parked: v.array(Parked), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })) });

/** One baked fixed WORLD collider: a cuboid, a capsule, a triangle mesh or a convex hull, at its load pose (doors included). */
export interface PineSolid {
  readonly shape: 1 | 2 | 6 | 9; readonly groups: number; readonly friction: number;
  readonly at: readonly [number, number, number]; readonly rot: readonly [number, number, number, number];
  readonly half?: readonly [number, number, number]; readonly halfHeight?: number; readonly radius?: number;
  /** Actual page query-owner provenance: registry object identity or declared string, never a geometric guess. */
  readonly ownerId?: string;
  /** Actual native collider material when tagged; absence retains the query's legacy wood fallback. */
  readonly material?: Material;
  readonly points?: Float32Array; readonly indices?: Uint32Array;
}
/** A baked body at load: the manager's id, kind / variant, herd slot (−1: none), native spec, seed, scale; elites are `scripted`. */
export interface PineBakedActor { readonly id: string; readonly kind: string; readonly variant: string; readonly herd: number; readonly spec: AnimalSimSpec; readonly seed: number; readonly scale: number; readonly scripted: boolean }
/** The trusted browser bake (scripts/bake-pine-physics.mjs), parsed strictly and decoded once. */
export interface PineBake {
  readonly ground: { readonly heights: Float32Array; readonly friction: number; readonly groups: number; readonly scale: { x: number; y: number; z: number }; readonly at: { x: number; y: number; z: number } };
  /** Page-rig rest-space head/main/chest hit volumes and ribcage, measured from the native inverse binds. */
  readonly kingHit: v.InferOutput<typeof KingHit>;
  readonly solids: readonly PineSolid[];
  readonly actors: readonly PineBakedActor[];
  /** the Antler King's prewarm (his body, an elk thrall, a boar thrall): spawned at boot, parked out of the manager's list */
  readonly parked: readonly Omit<PineBakedActor, 'herd' | 'scripted'>[];
  readonly herds: readonly { readonly kind: string; readonly members: readonly string[] }[];
}

const bytesOf = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.codePointAt(0) ?? 0);
const floats = (text: string): Float32Array => new Float32Array(bytesOf(text).buffer);
function spec(row: v.InferOutput<typeof BakedSpec>, kind: string, variant: string, id: string): AnimalSimSpec {
  if (row.kind !== kind || row.variant !== variant) throw new Error(`Divergent baked Pine spec ${id}`);
  return row;
}

/** Decode one trusted native solid, preserving optional exact query-owner provenance. Unknown fields refuse. */
export function parsePineSolid(input: unknown): PineSolid {
  return decodeSolid(v.parse(Solid, input));
}

function decodeSolid({ vertices, indices, body: _body, ...rest }: v.InferOutput<typeof Solid>): PineSolid {
  if ((rest.shape === 6 || rest.shape === 9) !== (vertices !== undefined) || (rest.shape === 6) !== (indices !== undefined)) throw new Error('Unbuildable baked Pine collider');
  return { ...rest, ...(vertices === undefined ? {} : { points: floats(vertices) }), ...(indices === undefined ? {} : { indices: new Uint32Array(bytesOf(indices).buffer) }) };
}

let parsed: PineBake | null = null;
/** Pine Hollow's trusted native bake, strictly parsed and decoded once. */
export function pineBake(): PineBake {
  if (parsed !== null) return parsed;
  const bake = v.parse(Bake, baked), heights = floats(bake.ground.heights);
  if (heights.length !== PINE_GROUND_RES ** 2 || bake.ground.scale.x !== PINE_GROUND_SIZE || bake.ground.scale.z !== PINE_GROUND_SIZE || bake.ground.scale.y !== 1) throw new Error('Pine baked floor is not its 256² lattice');
  const solids = bake.solids.map(decodeSolid);
  parsed = { kingHit: bake.kingHit, ground: { heights, friction: bake.ground.friction, groups: bake.ground.groups, scale: bake.ground.scale, at: bake.ground.at }, solids,
    actors: bake.actors.map(a => ({ ...a, spec: spec(a.spec, a.kind, a.variant, a.id) })),
    parked: bake.parked.map(a => ({ ...a, spec: spec(a.spec, a.kind, a.variant, a.id) })), herds: bake.herds };
  return parsed;
}

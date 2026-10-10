import * as v from 'valibot';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { DriftwoodPoseRecipe } from './posedVolumes';
import baked from './physics.baked.json' with { type: 'json' };

/** The baked floor's lattice (Rapier's own heightfield as the page built it, src/shards/driftwood-isle/generators/bake-driftwood-physics.mjs). */
export const DRIFTWOOD_GROUND_RES = 256, DRIFTWOOD_GROUND_SIZE = 500;

const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite }), xz = v.strictObject({ x: finite, z: finite });
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite, capsuleAxis: v.optional(v.picklist(['z', 'y'])) }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });
const Pose = v.strictObject({ joints: v.pipe(v.array(v.strictObject({ name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), parent: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(31)),
  position: v.tuple([finite, finite, finite]), order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), scale: v.tuple([finite, finite, finite]) })), v.minLength(1), v.maxLength(32)), custom: v.boolean(),
  gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })), pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) });
const Actor = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, spec: BakedSpec, pose: Pose, seed: finite, scale: finite, at: v.nullable(xz) });
const Solid = v.strictObject({ shape: v.picklist([1, 2, 9]), groups: finite, friction: finite, at: v.tuple([finite, finite, finite]), rot: v.tuple([finite, finite, finite, finite]),
  half: v.optional(v.tuple([finite, finite, finite])), halfHeight: v.optional(finite), radius: v.optional(finite), vertices: v.optional(v.string()) });
const Bake = v.object({ version: v.literal(1),
  ground: v.strictObject({ rows: v.literal(DRIFTWOOD_GROUND_RES - 1), cols: v.literal(DRIFTWOOD_GROUND_RES - 1), scale: xyz, at: xyz, friction: finite, groups: finite, heights: v.string() }),
  solids: v.array(Solid), actors: v.array(Actor), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })),
  habitat: v.object({ perches: v.array(xyz), perchBases: v.array(xyz), crabSites: v.array(xz), practice: v.string(),
    hold: v.strictObject({ x: finite, z: finite, r: finite, guardR: finite, step: finite, floor: v.array(v.nullable(finite)) }) }),
  // the finale's captain after `used:altar`: his native spec, his pool (the spawn point and yaw) and his arena radius
  captain: v.strictObject({ spec: BakedSpec, pose: Pose, pool: v.strictObject({ x: finite, z: finite, yaw: finite }), arena: finite }) });

/** One baked fixed WORLD collider: a cuboid (half extents), a capsule (half height, radius) or a convex hull (vertices). */
export type DriftwoodSolid = v.InferOutput<typeof Solid> & { readonly points?: Float32Array };
/** A baked body: the manager's spawn order, kind / variant, herd slot, native spec, seed, scale and spawn point. */
export interface DriftwoodBakedActor { readonly id: string; readonly kind: string; readonly variant: string; readonly herd: number; readonly spec: AnimalSimSpec; readonly pose: DriftwoodPoseRecipe; readonly seed: number; readonly scale: number; readonly at: { readonly x: number; readonly z: number } | null }
/** The trusted browser bake, parsed strictly once. */
export interface DriftwoodBake {
  readonly ground: { readonly heights: Float32Array; readonly friction: number; readonly groups: number; readonly scale: { x: number; y: number; z: number }; readonly at: { x: number; y: number; z: number } };
  readonly solids: readonly DriftwoodSolid[];
  readonly actors: readonly DriftwoodBakedActor[];
  readonly herds: readonly { readonly kind: string; readonly members: readonly string[] }[];
  readonly habitat: v.InferOutput<typeof Bake>['habitat'];
  /** The Drowned Captain as the finale spawns him: his native spec, his pool (spawn point, spawn yaw) and arena radius (m). */
  readonly captain: { readonly spec: AnimalSimSpec; readonly pose: DriftwoodPoseRecipe; readonly pool: { readonly x: number; readonly z: number; readonly yaw: number }; readonly arena: number };
  /** The baked floor anywhere, on Rapier's own triangle split (physics/terrain.ts). */
  readonly floorAt: (x: number, z: number) => number;
  /** The wreck hold's deck / hull floor (Wreck.floorHeightAt), the baked 0.5 m lattice's nearest vertex; undefined off it. */
  readonly holdFloorAt: (x: number, z: number) => number | undefined;
}

const bytesOf = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.codePointAt(0) ?? 0);
const floats = (text: string): Float32Array => new Float32Array(bytesOf(text).buffer);

let parsed: DriftwoodBake | null = null;
/** Driftwood's trusted native bake (src/shards/driftwood-isle/generators/bake-driftwood-physics.mjs), strictly parsed and decoded once. */
export function driftwoodBake(): DriftwoodBake {
  if (parsed !== null) return parsed;
  const bake = v.parse(Bake, baked), RES = DRIFTWOOD_GROUND_RES, SIZE = DRIFTWOOD_GROUND_SIZE, d = SIZE / (RES - 1);
  const heights = floats(bake.ground.heights);
  if (heights.length !== RES * RES || bake.ground.scale.x !== SIZE || bake.ground.scale.z !== SIZE || bake.ground.scale.y !== 1) throw new Error('Driftwood baked floor is not its 256² lattice');
  const vertex = (ix: number, iz: number): number => heights[ix * RES + iz] ?? Number.NaN;
  const floorAt = (x: number, z: number): number => {
    const gx = Math.min(RES - 1, Math.max(0, (x + SIZE / 2) / d)), gz = Math.min(RES - 1, Math.max(0, (z + SIZE / 2) / d));
    const ix = Math.min(RES - 2, Math.floor(gx)), iz = Math.min(RES - 2, Math.floor(gz)), u = gx - ix, w = gz - iz;
    return u + w <= 1 ? vertex(ix, iz) + (vertex(ix + 1, iz) - vertex(ix, iz)) * u + (vertex(ix, iz + 1) - vertex(ix, iz)) * w
      : vertex(ix + 1, iz + 1) + (vertex(ix, iz + 1) - vertex(ix + 1, iz + 1)) * (1 - u) + (vertex(ix + 1, iz) - vertex(ix + 1, iz + 1)) * (1 - w);
  };
  const hold = bake.habitat.hold, side = Math.round((2 * hold.guardR) / hold.step) + 1;
  if (hold.floor.length !== side * side) throw new Error('Driftwood baked hold lattice is not square');
  const holdFloorAt = (x: number, z: number): number | undefined => {
    const ix = Math.round((x - hold.x + hold.guardR) / hold.step), iz = Math.round((z - hold.z + hold.guardR) / hold.step);
    if (ix < 0 || iz < 0 || ix >= side || iz >= side) return undefined;
    return hold.floor[iz * side + ix] ?? undefined;
  };
  /** a baked spec without its absent optional fields */
  const specOf = (spec: v.InferOutput<typeof BakedSpec>): AnimalSimSpec => {
    const { lockable, dims: { capsuleAxis, ...dims }, ...rest } = spec;
    return { ...rest, dims: { ...dims, ...(capsuleAxis === undefined ? {} : { capsuleAxis }) }, ...(lockable === undefined ? {} : { lockable }) };
  };
  const actors = bake.actors.map((actor): DriftwoodBakedActor => {
    if (actor.spec.kind !== actor.kind || actor.spec.variant !== actor.variant) throw new Error(`Divergent baked Driftwood spec ${actor.id}`);
    return { ...actor, spec: specOf(actor.spec) };
  });
  if (bake.captain.spec.kind !== 'captain' || bake.captain.spec.variant !== 'captain') throw new Error('Divergent baked Driftwood captain spec');
  const solids = bake.solids.map((solid): DriftwoodSolid => solid.vertices === undefined ? solid : { ...solid, points: floats(solid.vertices) });
  parsed = { ground: { heights, friction: bake.ground.friction, groups: bake.ground.groups, scale: bake.ground.scale, at: bake.ground.at },
    solids, actors, herds: bake.herds, habitat: bake.habitat, captain: { spec: specOf(bake.captain.spec), pose: bake.captain.pose, pool: bake.captain.pool, arena: bake.captain.arena }, floorAt, holdFloorAt };
  return parsed;
}

/** Every (kind, variant)'s baked native spec; bodies of one variant share one recipe, so a divergent one refuses. */
export function driftwoodSpecs(bake: DriftwoodBake): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>();
  bake.actors.forEach(actor => {
    const key = `${actor.kind}.${actor.variant}`, known = specs.get(key);
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(actor.spec)) throw new Error(`Divergent native Driftwood spec ${key}`);
    specs.set(key, actor.spec);
  });
  specs.set('captain.captain', bake.captain.spec);
  return specs;
}

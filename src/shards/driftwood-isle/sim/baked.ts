import { terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { nativeBodySpecSchema, nativeColliderSchema, nativeBakeFloats, nativeGroundSchema, nativeBakeGround, nativeBakeActors } from '@wildshard/sdk/headlessRuntime';
import * as v from 'valibot';
import { BodySlotsSchema } from '@wildshard/format/bodySlots';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { NativeCreaturePoseRecipe } from '@wildshard/game/plugin/animation';
import DRIFTWOOD_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The baked floor's lattice (Rapier's own column-major heightfield, from authored rows: generators/physics.ts, G350-DW). */
export const DRIFTWOOD_GROUND_RES = DRIFTWOOD_TERRAIN.res, DRIFTWOOD_GROUND_SIZE = DRIFTWOOD_TERRAIN.size;

const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite }), xz = v.strictObject({ x: finite, z: finite });
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = nativeBodySpecSchema('axis');
const Pose = v.strictObject({ joints: v.pipe(v.array(v.strictObject({ name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), parent: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(31)),
  position: v.tuple([finite, finite, finite]), order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), scale: v.tuple([finite, finite, finite]) })), v.minLength(1), v.maxLength(32)), custom: v.boolean(),
  gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })), pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) });
const Actor = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, spec: BakedSpec, pose: Pose, seed: finite, scale: finite, at: v.nullable(xz) });
const Solid = nativeColliderSchema([1, 2, 9], 'tagged');
const Bake = v.object({ version: v.literal(1),
  ground: nativeGroundSchema(DRIFTWOOD_GROUND_RES),
  solids: v.array(Solid), actors: v.array(Actor), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })),
  habitat: v.object({ perches: v.array(xyz), perchBases: v.array(xyz), crabSites: v.array(xz), practice: v.string(),
    hold: v.strictObject({ x: finite, z: finite, r: finite, guardR: finite, step: finite, floor: v.array(v.nullable(finite)) }) }),
  // the finale's captain after `used:altar`: his native spec, his pool (the spawn point and yaw) and his arena radius
  captain: v.strictObject({ spec: BakedSpec, pose: Pose, pool: v.strictObject({ x: finite, z: finite, yaw: finite }), arena: finite }) });

/** One baked fixed WORLD collider: a cuboid (half extents), a capsule (half height, radius) or a convex hull (vertices). */
export type DriftwoodSolid = Omit<v.InferOutput<typeof Solid>, 'indices'> & { readonly points?: Float32Array };
/** A baked body: the manager's spawn order, kind / variant, herd slot, native spec, seed, scale and spawn point. */
export interface DriftwoodBakedActor { readonly id: string; readonly kind: string; readonly variant: string; readonly herd: number; readonly spec: AnimalSimSpec; readonly pose: NativeCreaturePoseRecipe; readonly seed: number; readonly scale: number; readonly at: { readonly x: number; readonly z: number } | null }
/** The trusted browser bake, parsed strictly once. */
export interface DriftwoodBake {
  readonly ground: { readonly heights: Float32Array; readonly friction: number; readonly groups: number; readonly scale: { x: number; y: number; z: number }; readonly at: { x: number; y: number; z: number } };
  readonly solids: readonly DriftwoodSolid[];
  readonly actors: readonly DriftwoodBakedActor[];
  readonly herds: readonly { readonly kind: string; readonly members: readonly string[] }[];
  readonly habitat: v.InferOutput<typeof Bake>['habitat'];
  /** The Drowned Captain as the finale spawns him: his native spec, his pool (spawn point, spawn yaw) and arena radius (m). */
  readonly captain: { readonly spec: AnimalSimSpec; readonly pose: NativeCreaturePoseRecipe; readonly pool: { readonly x: number; readonly z: number; readonly yaw: number }; readonly arena: number };
  /** The baked floor anywhere, on Rapier's own triangle split (physics/terrain.ts). */
  readonly floorAt: (x: number, z: number) => number;
  /** The wreck hold's deck / hull floor (Wreck.floorHeightAt), the baked 0.5 m lattice's nearest vertex; undefined off it. */
  readonly holdFloorAt: (x: number, z: number) => number | undefined;
}


let parsed: DriftwoodBake | null = null;
/** Driftwood's physics product (generators/physics.ts, G350-DW), strictly parsed and decoded once. */
export function driftwoodBake(): DriftwoodBake {
  if (parsed !== null) return parsed;
  const bake = v.parse(Bake, baked), RES = DRIFTWOOD_GROUND_RES, SIZE = DRIFTWOOD_GROUND_SIZE;
  const ground = nativeBakeGround(bake.ground, RES, SIZE, 'Driftwood'), { heights } = ground;
  const floor = { resolution: RES, x: -SIZE / 2, z: -SIZE / 2, size: SIZE, heights };
  const floorAt = (x: number, z: number): number => terrainTileHeight(floor, x, z, DRIFTWOOD_TERRAIN.sampling);
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
  const actorOf = (actor: v.InferOutput<typeof Actor>): DriftwoodBakedActor => ({ ...actor, spec: specOf(actor.spec) });
  const actors = nativeBakeActors(bake.actors, 'Driftwood').map(actorOf);
  if (bake.captain.spec.kind !== 'captain' || bake.captain.spec.variant !== 'captain') throw new Error('Divergent baked Driftwood captain spec');
  const solids = bake.solids.map((solid): DriftwoodSolid => solid.vertices === undefined ? solid : { ...solid, points: nativeBakeFloats(solid.vertices) });
  parsed = { ground,
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

const enemyRow = v.strictObject({ kind: v.picklist(['crab', 'monkey', 'sailor']), variant: v.nullable(v.string()),
  x: finite, z: finite, yaw: finite, herd: finite, practice: v.exactOptional(v.literal(true)) });
const EnemyPlacements = v.object({ seed: finite, practice: xz, native: v.strictObject({
  enemies: v.pipe(v.array(enemyRow), v.maxLength(64)), herds: finite, centres: v.pipe(v.array(xz), v.maxLength(16)),
  kinds: v.pipe(v.array(v.picklist(['crab', 'monkey'])), v.maxLength(16)),
  stream: v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() }),
}) });
/** Native intake admits only the authored spawn rows it consumes, without importing a client module. */
export type NativeEnemyPlacements = v.InferOutput<typeof EnemyPlacements>;
export function readEnemyPlacements(input: unknown): NativeEnemyPlacements { return v.parse(EnemyPlacements, input); }

const stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const keeperRows = v.strictObject({ seed: finite,
  volley: BodySlotsSchema,
  ecology: v.strictObject({ outOfSight: v.pipe(finite, v.minValue(0)), rules: v.record(v.string(), v.strictObject({
    delay: v.strictObject({ min: v.pipe(finite, v.minValue(0)), max: v.pipe(finite, v.minValue(0)) }), night: v.exactOptional(v.boolean()) })) }),
  fauna: v.strictObject({ seed: finite, centres: v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(32)),
    rows: v.pipe(v.array(v.strictObject({ id: v.string(), herd: finite, seed: finite, x: finite, z: finite, yaw: finite, stream })), v.maxLength(64)), stream }),
  variants: v.pipe(v.array(v.strictObject({ kind: v.string(), rows: v.pipe(v.array(v.strictObject({ id: v.string(), scale: v.tuple([finite, finite]) })), v.maxLength(32)) })), v.maxLength(32)),
  herds: v.pipe(v.array(v.strictObject({ kind: v.string(), x: finite, z: finite })), v.maxLength(32)),
  bodies: v.pipe(v.array(v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, x: finite, z: finite,
    yaw: finite, seed: finite, scale: finite, fauna: v.boolean(), practice: v.boolean(), stream: v.nullable(stream) })), v.length(34)) });
/** Admitted immutable keeper boot rows; version-8 live continuation stays with the existing native owner. */
export type NativeKeeperRows = v.InferOutput<typeof keeperRows>;
export function readKeeperRows(input: unknown): NativeKeeperRows { return v.parse(keeperRows, input); }

import { nativeBodySchema, nativeColliderRecordSchema, nativeGroundRecordSchema } from '@wildshard/format/nativePhysics';
import * as v from 'valibot';
import DRIFTWOOD_TERRAIN from '../data/terrainBindings.json' with { type: 'json' };

const DRIFTWOOD_GROUND_RES = DRIFTWOOD_TERRAIN.res;
const finite = v.pipe(v.number(), v.finite()), xyz = v.strictObject({ x: finite, y: finite, z: finite }), xz = v.strictObject({ x: finite, z: finite });
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = nativeBodySchema('axis');
const Pose = v.strictObject({ joints: v.pipe(v.array(v.strictObject({ name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), parent: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(31)),
  position: v.tuple([finite, finite, finite]), order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), scale: v.tuple([finite, finite, finite]) })), v.minLength(1), v.maxLength(32)), custom: v.boolean(),
  gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })), pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) });
const Actor = v.strictObject({ id: v.string(), kind: v.string(), variant: v.string(), herd: finite, spec: BakedSpec, pose: Pose, seed: finite, scale: finite, at: v.nullable(xz) });
const Solid = nativeColliderRecordSchema([1, 2, 9], 'tagged');
const Bake = v.object({ version: v.literal(1),
  ground: nativeGroundRecordSchema(DRIFTWOOD_GROUND_RES),
  solids: v.array(Solid), actors: v.array(Actor), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })),
  habitat: v.object({ perches: v.array(xyz), perchBases: v.array(xyz), crabSites: v.array(xz), practice: v.string(),
    hold: v.strictObject({ x: finite, z: finite, r: finite, guardR: finite, step: finite, floor: v.array(v.nullable(finite)) }) }),
  // the finale's captain after `used:altar`: his native spec, his pool (the spawn point and yaw) and his arena radius
  captain: v.strictObject({ spec: BakedSpec, pose: Pose, pool: v.strictObject({ x: finite, z: finite, yaw: finite }), arena: finite }) });


/** Build-time admission and joins; the native assembly only decodes owned byte channels. */
export function driftwoodNativeRows(input: unknown): { physics: v.InferOutput<typeof Bake>; nativeSpecs: [string, v.InferOutput<typeof BakedSpec>][] } {
  const physics = v.parse(Bake, input);
  const ground = physics.ground;
  if (atob(ground.heights).length !== DRIFTWOOD_TERRAIN.res ** 2 * 4 || ground.scale.x !== DRIFTWOOD_TERRAIN.size || ground.scale.z !== DRIFTWOOD_TERRAIN.size || ground.scale.y !== 1) throw new Error('Divergent native ground lattice');
  for (const actor of physics.actors) if (actor.spec.kind !== actor.kind || actor.spec.variant !== actor.variant) throw new Error(`Divergent native actor ${actor.id}`);
  if (physics.captain.spec.kind !== 'captain' || physics.captain.spec.variant !== 'captain') throw new Error('Divergent baked Driftwood captain spec');
  const hold = physics.habitat.hold, side = Math.round(2 * hold.guardR / hold.step) + 1;
  if (hold.floor.length !== side * side) throw new Error('Driftwood baked hold lattice is not square');
  const specs = new Map<string, typeof physics.captain.spec>();
  for (const actor of physics.actors) {
    const key = `${actor.kind}.${actor.variant}`, known = specs.get(key);
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(actor.spec)) throw new Error(`Divergent native Driftwood spec ${key}`);
    specs.set(key, actor.spec);
  }
  specs.set('captain.captain', physics.captain.spec);
  return { physics, nativeSpecs: [...specs] };
}

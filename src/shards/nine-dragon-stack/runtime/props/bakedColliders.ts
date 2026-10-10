// bakedColliders — a browser bake's registry colliders, read strictly (SHARD-PLATFORM M3, ex Nine Dragon's
// runtime/headless.ts, SF72): every engine `ColliderDesc` kind a page registers (box, capsule, ball, hull, trimesh,
// treads), each on the surfaces the shard's bake may name; an unknown field or kind refuses the bake rather than
// defaulting. `bakedColliderDesc` turns a parsed row back into the engine's descriptor (typed arrays for hull points and
// trimesh buffers), so a renderer-free host registers exactly what the page did.
//
//   const { Surface, Collider } = bakedColliderSchemas(['wood', 'stone']);
//   const colliders = v.parse(v.array(Collider), piece.colliders).map(bakedColliderDesc);
import * as v from 'valibot';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

const finite = v.pipe(v.number(), v.finite());
const Vec = v.strictObject({ x: finite, y: finite, z: finite });

const schemas = (surfaces: readonly Material[]) => {
  const Surface = v.picklist(surfaces);
  const Placed = { x: finite, y: finite, z: finite, yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface: v.exactOptional(Surface) };
  const Collider = v.variant('kind', [
    v.strictObject({ kind: v.literal('box'), ...Placed, hx: finite, hy: finite, hz: finite }),
    v.strictObject({ kind: v.literal('capsule'), ...Placed, halfHeight: finite, radius: finite }),
    v.strictObject({ kind: v.literal('ball'), ...Placed, radius: finite }),
    v.strictObject({ kind: v.literal('hull'), ...Placed, points: v.array(finite) }),
    v.strictObject({ kind: v.literal('trimesh'), ...Placed, vertices: v.array(finite), indices: v.array(v.pipe(finite, v.integer(), v.minValue(0))) }),
    v.strictObject({ kind: v.literal('treads'), from: Vec, to: Vec, width: finite, count: v.pipe(finite, v.integer(), v.minValue(1)), surface: v.exactOptional(Surface) }),
  ]);
  return { Surface, Collider };
};
/** A bake's schemas: the surface picklist and the collider variant. */
export type BakedColliderSchemas = ReturnType<typeof schemas>;
/** The schemas of a bake whose colliders stand on `surfaces`. */
export function bakedColliderSchemas(surfaces: readonly Material[]): BakedColliderSchemas { return schemas(surfaces); }

/** One parsed baked collider. */
export type BakedCollider = v.InferOutput<BakedColliderSchemas['Collider']>;

/** A parsed baked collider as the engine's descriptor (hull points and trimesh buffers as typed arrays). */
export function bakedColliderDesc(c: BakedCollider): ColliderDesc {
  if (c.kind === 'hull') return { ...c, points: Float32Array.from(c.points) };
  if (c.kind === 'trimesh') return { ...c, vertices: Float32Array.from(c.vertices), indices: Uint32Array.from(c.indices) };
  return c;
}

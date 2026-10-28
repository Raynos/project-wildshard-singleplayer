// bakedColliders — a browser bake's registry colliders, read strictly (SHARD-PLATFORM M3, ex Nine Dragon's
// runtime/headless.ts, SF72): every engine `ColliderDesc` kind a page registers (box, capsule, ball, hull, trimesh,
// treads), each on the surfaces the shard's bake may name; an unknown field or kind refuses the bake rather than
// defaulting. `bakedColliderDesc` turns a parsed row back into the engine's descriptor (typed arrays for hull points and
// trimesh buffers), so a renderer-free host registers exactly what the page did.
//
//   const { Surface, Collider } = bakedColliderSchemas(['wood', 'stone']);
//   const colliders = v.parse(v.array(Collider), piece.colliders).map(bakedColliderDesc);
import { sourceColliderSchemas, type SourceColliderSchemas, type SourceCollider } from '@wildshard/sdk/bake/contactRows';
import type { ContactSurface, ColliderDesc } from '@wildshard/sdk/bake/placement';

/** A bake's strict surface picklist and recorded shape grammar. */
export type BakedColliderSchemas = SourceColliderSchemas;
/** The schemas of a bake whose colliders stand on `surfaces`. */
export function bakedColliderSchemas(surfaces: readonly ContactSurface[]): BakedColliderSchemas { return sourceColliderSchemas(surfaces); }
/** One parsed baked collider. */
export type BakedCollider = SourceCollider;

/** A parsed baked collider as the engine's descriptor (hull points and trimesh buffers as typed arrays). */
export function bakedColliderDesc(c: BakedCollider): ColliderDesc {
  if (c.kind === 'hull') return { ...c, points: Float32Array.from(c.points) };
  if (c.kind === 'trimesh') return { ...c, vertices: Float32Array.from(c.vertices), indices: Uint32Array.from(c.indices) };
  return c;
}

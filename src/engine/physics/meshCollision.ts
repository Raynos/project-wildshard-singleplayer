import type { Collider } from '@dimforge/rapier3d-simd';
import type { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import { decodeMeshCollision } from '../core/meshCollision';
import type { Physics } from './Physics';
import { groups } from './groups';
import { tagCollider, type Material } from './surface';

/** Install admitted baked triangles as one scoped static WORLD collider, preserving stacked floors and overhangs. */
export function addBakedMeshCollider(physics: Physics, bytes: Uint8Array, scope: Scope, options: { owner?: unknown; material?: Material } = {}): Collider {
  if (scope.disposed) throw new Error('Mesh collision requires a live scope');
  const data = decodeMeshCollision(bytes);
  const collider = withOwner(scope, () => physics.world.createCollider(physics.R.ColliderDesc.trimesh(data.vertices, data.indices, physics.R.TriMeshFlags.FIX_INTERNAL_EDGES)
    .setCollisionGroups(groups('WORLD')).setFriction(0.9)));
  tagCollider(collider, options.material ?? 'ground', options.owner);
  scope.onDispose(() => { if (collider.isValid()) physics.world.removeCollider(collider, false); });
  return collider;
}

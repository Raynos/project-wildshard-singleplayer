// placedDraws — name a placed model's draws (SHARD-PLATFORM M3, ex Nine Dragon's world/facade/batch.ts): the budget
// ruler's lanes, the GPU ruler's groups and the instance culler's LOD names read a draw's name, so a shard that names its
// lanes names the placed object and its level-0 instanced mesh, and reads back level 0's triangles per copy.
//
//   const tris = namePlacedDraws(place(model, placements, opts), 'facade-balcony');
import { InstancedMesh, type Object3D } from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import { triCount } from '../cull/meshLod';

/** Name a placed model's object and its level-0 instanced mesh `name`; returns level 0's triangles per copy (0 with no instanced mesh). */
export function namePlacedDraws(placed: Placed, name: string): number {
  placed.object.name = name;
  const isBatch = (o: Object3D): o is InstancedMesh => o instanceof InstancedMesh;
  const base = isBatch(placed.object) ? placed.object : placed.object.children.find(isBatch);
  if (base === undefined) return 0;
  base.name = name;
  return triCount(base.geometry);
}

/**
 * The tree stump (E315 M2): Poly Haven's CC0 `tree_stump_01` photoscan, meshoptimizer-simplified
 * (`public/assets/models/tree_stump_01/tree_stump_01_lod.glb`), its node transform baked in (its own space). Collides as
 * the support-point hull of each part (src/engine/models/hull.ts). Placed by src/shards/pine-hollow/world/props.ts along the
 * trails and round the cabins, as if cut for firewood.
 *
 *   await loadTreeStump(ctx);   // place() is synchronous: the GLB first
 */
import type * as THREE from 'three';
import { loadLod, prepModel } from '../world/homestead';
import { bakePart, supportPoints } from '@wildshard/engine/models/hull';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material; hull: Float32Array }

const KEY = 'pine-hollow/tree-stump';

/** Load the scan into this shard's context (once). */
export async function loadTreeStump(ctx: ModelContext): Promise<void> {
  const gltf = await loadLod('tree_stump_01');
  ctx.once(KEY, () => prepModel(gltf.scene, ctx.sky).map((p): Part => {
    const hull = supportPoints(p.geometry, p.matrix);
    return { geometry: bakePart(p.geometry, p.matrix), material: p.material, hull };
  }));
}

const parts = (ctx: ModelContext): Part[] => ctx.once<Part[]>(KEY, () => { throw new Error('[tree-stump] loadTreeStump(ctx) first'); });

export const treeStump = defineModel<Record<string, never>>({
  id: 'pine-hollow/tree-stump', name: 'Tree stump', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/treeStump.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => parts(ctx).map((p) => ({ geometry: p.geometry, material: p.material, castShadow: true, receiveShadow: true })),
  colliders: (_p, ctx) => parts(ctx).map((p) => ({ kind: 'hull', x: 0, y: 0, z: 0, points: p.hull })),
});

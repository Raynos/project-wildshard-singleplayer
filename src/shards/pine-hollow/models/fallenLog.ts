/**
 * The fallen log (E315 M2): Poly Haven's CC0 `dead_tree_trunk` photoscan, meshoptimizer-simplified
 * (`public/assets/models/dead_tree_trunk/dead_tree_trunk_lod.glb`), its node transform baked in (its own space: the trunk
 * lies along its local X). It collides as ONE capsule along that axis, as thick as the bark's mean distance from it over
 * the middle 80 % of the length (the root flare and the broken tip are the ends' 10 %). Placed by
 * src/shards/pine-hollow/world/props.ts (scattered by ../generators/props.ts) near the trail edges, lying along the slope.
 *
 *   await loadFallenLog(ctx);   // place() is synchronous: the GLB first
 */
import type * as THREE from 'three';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { loadSiteTimbers, propShapeGeometry } from '../world/timberSites';
import { loadLod, prepModel } from '../world/homestead';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

interface Log {
  parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
  /** the capsule, own space */
  capsule: ColliderDesc;
}

const KEY = 'pine-hollow/fallen-log';

/** Load the scan into this shard's context (once). */
export async function loadFallenLog(ctx: ModelContext): Promise<void> {
  const [gltf, views] = await Promise.all([loadLod('dead_tree_trunk'), loadSiteTimbers(ctx)]);
  ctx.once(KEY, (): Log => {
    const parts = prepModel(gltf.scene, ctx.sky).map((p, i) => {
      const row = authored.propShapes.log.parts[i]; if (row === undefined) throw new Error('[props] missing authored log');
      return { geometry: propShapeGeometry(views, row.name, row.sphere), material: p.material };
    });
    const capsule: ColliderDesc = { ...authored.propShapes.log.capsule, kind: 'capsule' };
    return { parts, capsule };
  });
}

const log = (ctx: ModelContext): Log => ctx.once<Log>(KEY, () => { throw new Error('[fallen-log] loadFallenLog(ctx) first'); });

export const fallenLog = defineModel<Record<string, never>>({
  id: 'pine-hollow/fallen-log', name: 'Fallen log', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/fallenLog.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => log(ctx).parts.map((p) => ({ geometry: p.geometry, material: p.material, castShadow: true, receiveShadow: true })),
  colliders: (_p, ctx) => [log(ctx).capsule],
});

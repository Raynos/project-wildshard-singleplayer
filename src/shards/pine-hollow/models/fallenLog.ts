/**
 * The fallen log (E315 M2): Poly Haven's CC0 `dead_tree_trunk` photoscan, meshoptimizer-simplified
 * (`public/assets/models/dead_tree_trunk/dead_tree_trunk_lod.glb`), its node transform baked in (its own space: the trunk
 * lies along its local X). It collides as ONE capsule along that axis, as thick as the bark's mean distance from it over
 * the middle 80 % of the length (the root flare and the broken tip are the ends' 10 %). Placed by
 * src/shards/pine-hollow/world/props.ts (scattered by ../generators/props.ts) near the trail edges, lying along the slope.
 *
 *   await loadFallenLog(ctx);   // place() is synchronous: the GLB first
 */
import * as THREE from 'three';
import { loadLod, prepModel } from '../world/homestead';
import { bakePart } from '@wildshard/engine/models/hull';
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
  const gltf = await loadLod('dead_tree_trunk');
  ctx.once(KEY, (): Log => {
    const parts = prepModel(gltf.scene, ctx.sky);
    const p0 = parts[0];
    if (!p0) throw new Error('[fallen-log] dead_tree_trunk has no parts');
    p0.geometry.computeBoundingBox();
    const bb = p0.geometry.boundingBox ?? new THREE.Box3();
    const halfLen = (bb.max.x - bb.min.x) / 2;
    const centre = bb.getCenter(new THREE.Vector3()), pos = p0.geometry.getAttribute('position');
    let rSum = 0, rN = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i) - centre.x) > halfLen * 0.8) continue;
      rSum += Math.hypot(pos.getY(i) - centre.y, pos.getZ(i) - centre.z); rN++;
    }
    const radius = rN > 0 ? rSum / rN : Math.min(bb.max.y - bb.min.y, bb.max.z - bb.min.z) / 2;
    // the capsule in own space: the scan's axis under its node transform (a capsule's axis is its +Y)
    const o = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    p0.matrix.decompose(o, q, sc);
    const c = centre.clone().applyMatrix4(p0.matrix), axis = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const r = radius * sc.x, rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const capsule: ColliderDesc = { kind: 'capsule', x: c.x, y: c.y, z: c.z, halfHeight: Math.max(0.05, halfLen * sc.x - r), radius: r, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
    return { parts: parts.map((p) => ({ geometry: bakePart(p.geometry, p.matrix), material: p.material })), capsule };
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

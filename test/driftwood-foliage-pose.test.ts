import { expect, test } from 'vitest';
import { Matrix4 } from 'three';
import type { ColliderDesc } from '../src/engine/world/registry';
import { placeCollider, poseOf } from '../src/engine/models/colliders';
import { foliagePose, palm, palmColliders, placeFoliageCollider } from '../src/shards/driftwood-isle/generators/foliageModels';

// GR7: the foliage-scene bank places its colliders with shard-local copies of the engine's pose and collider placement;
// the copies must stay exact.
const placements = [
  { x: 1, y: 2, z: 3, params: {} },
  { x: -4, y: 0.5, z: 9, yaw: 0.7, params: {} },
  { x: 2, y: 1, z: -3, yaw: -1.1, leanX: 0.12, leanZ: -0.08, scale: 1.3, params: {} },
  { x: 0, y: 0, z: 0, scale: 0.6, params: {} },
  { x: 5, y: 6, z: 7, matrix: new Matrix4().makeRotationY(0.4).setPosition(5, 6, 7), params: {} },
  { x: 5, y: 6, z: 7, matrix: new Matrix4().makeRotationX(0.3).setPosition(5, 6, 7), params: {} },
];
const colliders: ColliderDesc[] = [
  { kind: 'box', x: 0.5, y: 1, z: -0.2, hx: 1, hy: 0.5, hz: 0.25, yaw: 0.3, surface: 'wood' },
  { kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1, rot: { x: 0.1, y: 0.2, z: 0.05, w: Math.sqrt(1 - 0.01 - 0.04 - 0.0025) } },
  { kind: 'capsule', x: 0, y: 2, z: 0, halfHeight: 1.5, radius: 0.3 },
  { kind: 'ball', x: 1, y: 1, z: 1, radius: 0.4, yaw: -0.5 },
  { kind: 'hull', x: 0, y: 1, z: 0, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]) },
  { kind: 'trimesh', x: 0, y: 0, z: 0, vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]) },
  { kind: 'treads', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 1, z: 2 }, width: 1.2, count: 4 },
  ...palmColliders({ ...palm.defaults, lean: 0.4, leanDir: 1.2 }),
];

test('the foliage pose and collider copies match the engine exactly', () => {
  for (const placement of placements) {
    const mine = foliagePose(placement), engine = poseOf(placement);
    expect([...mine.matrix.elements]).toEqual([...engine.matrix.elements]);
    expect([mine.quat.x, mine.quat.y, mine.quat.z, mine.quat.w, mine.scale, mine.upright]).toEqual([engine.quat.x, engine.quat.y, engine.quat.z, engine.quat.w, engine.scale, engine.upright]);
    for (const collider of colliders) expect(placeFoliageCollider(collider, mine)).toEqual(placeCollider(collider, engine));
  }
});

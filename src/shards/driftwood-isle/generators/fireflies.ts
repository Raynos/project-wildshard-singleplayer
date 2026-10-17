/**
 * The Ring Shrine's firefly cloud (world/Shrine.ts), built offline: FIREFLY_COUNT unit quads from the shrine's fixed
 * seed, each corner carrying its fly's `aFly` (start angle, orbit radius, height over the base, phase). The material
 * graph (data/fireflyLook.ts) poses them on the GPU; the world loads this as the fixed-model template
 * `shrine-fireflies` through the shard's geometry intake.
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { FIREFLY_COUNT } from './fireflyLook';

/** a firefly quad's four corners, x then y (the graph scales and turns them to the camera) */
const CORNERS: readonly number[] = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];

/** the cloud's quads in the shrine base's space (the graph moves every corner to its fly) */
export function fireflyCloud(): THREE.BufferGeometry {
  const rng = new Rng(SEED ^ 0x5418);
  const n = FIREFLY_COUNT, position = new Float32Array(n * 12), uv = new Float32Array(n * 8), fly = new Float32Array(n * 16), index: number[] = [];
  for (let i = 0; i < n; i++) {
    const seed = [rng.range(0, Math.PI * 2), rng.range(4, 13), rng.range(0.4, 3.4), rng.range(0, 100)];
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k, x = CORNERS[k * 2] ?? 0, y = CORNERS[k * 2 + 1] ?? 0;
      position.set([x, y, 0], v * 3); uv.set([x + 0.5, y + 0.5], v * 2); fly.set(seed, v * 4);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aFly', new THREE.BufferAttribute(fly, 4));
  g.setIndex(index);
  return g;
}

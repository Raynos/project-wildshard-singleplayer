/**
 * The reef fish (models/reefFish.ts), built offline: a small faceted fish, a flattened diamond body (8 tris) and a tail
 * fin (2), nose along −z, ~0.35 m long, white vertex colour so each copy's tint shows. Loaded as the fixed-model
 * template `reef-fish` through the shard's geometry intake.
 */
import * as THREE from 'three';

export function reefFishGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const nose = [0, 0, -0.18], tail = [0, 0, 0.14], top = [0, 0.07, -0.02], bot = [0, -0.06, -0.02], l = [-0.035, 0, -0.03], r = [0.035, 0, -0.03];
  const t1 = [0, 0.07, 0.24], t2 = [0, -0.07, 0.24];
  const faces = [[nose, top, l], [nose, r, top], [nose, l, bot], [nose, bot, r], [tail, l, top], [tail, top, r], [tail, bot, l], [tail, r, bot], [tail, t1, t2], [tail, t2, t1]];
  for (const f of faces) for (const v of f) pos.push(...v);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  return geometry;
}

/**
 * The weathered granite block Nalati's rock models are built from (Eagle Rock's tor, the stone stair's steps, the crag
 * ledges and the leopard's cave, the escarpment's outcrops): a rounded box, its surface pushed about by noise;
 * smooth-shaded. A geometry helper, not a model (E306 / E315 M3: the models are in src/shards/nalati-grasslands/models/).
 */
import type * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVerticesByPos } from '@wildshard/engine/world/geometryKit';
import { Noise2D } from '@wildshard/engine/core/noise';
import { bakedGeometry } from '@wildshard/engine/world/geometryBake';

export function graniteBlock(w: number, h: number, d: number, seed: number, rough = 0.18, segs = 3): THREE.BufferGeometry {
  // built at `wildshard build` time and read back at load (SF67: src/engine/world/geometryBake.ts, scripts/bake-geometry.mjs);
  // the bake holds the shape (position, index), and the smooth normals are exact arithmetic, so they are made here
  const g = bakedGeometry('nalati-grasslands/granite', [w, h, d, seed, rough, segs], null, () => graniteShape(w, h, d, seed, rough, segs));
  g.computeVertexNormals();
  return g;
}

/** the block's welded, weathered shape: indexed, `position` only */
function graniteShape(w: number, h: number, d: number, seed: number, rough: number, segs: number): THREE.BufferGeometry {
  const r = Math.min(h * 0.28, Math.min(w, d) * 0.2, 0.9);
  const g = mergeVerticesByPos(new RoundedBoxGeometry(w, h, d, segs, r));
  const n = new Noise2D(seed);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = n.get(x * 0.35 + y * 0.2, z * 0.35 - y * 0.25) * 0.7 + n.get(x * 1.1, z * 1.1 + y) * 0.3;
    const s = 1 + k * rough * (Math.min(w, d) > 4 ? 0.6 : 1);
    pos.setXYZ(i, x * s, y + k * rough * h * 0.3, z * s);
  }
  return g;
}

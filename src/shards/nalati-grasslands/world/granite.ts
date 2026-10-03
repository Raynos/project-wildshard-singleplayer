/**
 * The weathered granite block Nalati's rock models are built from (Eagle Rock's tor, the stone stair's steps, the crag
 * ledges and the leopard's cave, the escarpment's outcrops): a rounded box, its surface pushed about by noise;
 * smooth-shaded. A geometry helper, not a model (E306 / E315 M3: the models are in src/shards/nalati-grasslands/models/).
 */
import type * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVerticesByPos } from './paint';
import { Noise2D } from '#engine';

export function graniteBlock(w: number, h: number, d: number, seed: number, rough = 0.18, segs = 3): THREE.BufferGeometry {
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
  g.computeVertexNormals();
  return g;
}

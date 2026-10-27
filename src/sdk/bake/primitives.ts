import * as THREE from 'three';
import type { Rng } from '../random';

/** Native faceted boulder arithmetic; the caller owns its stream and returned geometry. */
export function bakeRock(r: number, detail: number, rng: Pick<Rng, 'range'>, squash = 0.7, rough = 0.28): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const pos = g.getAttribute('position');
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 1 + rng.range(-rough, rough); seen.set(key, k); }
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return g;
}

/** An ordered triangle soup containing the original Float32 positions only. */
export function bakeTriangles(v: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

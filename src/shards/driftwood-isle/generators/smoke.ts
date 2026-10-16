/**
 * The castaway's campfire smoke column (runtime/looks/smokeColumn.ts), built offline: the row's puff quads, each corner
 * carrying its puff's uv and `aPuff` (start age, life speed, start seed) from the row's LCG. The smoke's material graph
 * (data/smokeLook.ts) poses and fades them on the GPU; the world loads this as the fixed-model template
 * `castaway-smoke` through the shard's geometry intake.
 */
import * as THREE from 'three';
import type { SmokeColumnRow } from '../data/lookRows';

/** a puff quad's four corners, x then y (metres of its size; the graph scales and turns them to the camera) */
const CORNERS: readonly number[] = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
/** the most puffs one column lays */
const MAX_PUFFS = 256;

/** one column's quads in its fire's frame */
export function smokeColumnGeometry(row: SmokeColumnRow): THREE.BufferGeometry {
  const n = Math.min(row.count, MAX_PUFFS), position = new Float32Array(n * 12), uv = new Float32Array(n * 8), puff = new Float32Array(n * 12), index: number[] = [];
  let hs = row.seed;
  const rnd = (): number => { hs = (Math.imul(hs, 1103515245) + 12345) & 0x7fffffff; return hs / 0x7fffffff; };
  for (let i = 0; i < n; i++) {
    const age = rnd(), rate = row.rate[0] + rnd() * row.rate[1], seed = rnd() * row.seedSpread;
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k, x = CORNERS[k * 2] ?? 0, y = CORNERS[k * 2 + 1] ?? 0;
      position.set([x, y, 0], v * 3); uv.set([x + 0.5, y + 0.5], v * 2); puff.set([age, rate, seed], v * 3);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aPuff', new THREE.BufferAttribute(puff, 3));
  g.setIndex(index);
  return g;
}

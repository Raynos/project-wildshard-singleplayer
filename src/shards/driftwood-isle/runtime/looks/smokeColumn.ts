import * as THREE from 'three';
import type { SmokeColumnRow } from '../../data/lookRows';
import { SMOKE_LOOK } from '../../data/smokeLook';

/**
 * A thin, broken smoke column off a fire (SHARD-PLATFORM W2 C2): ONE mesh of camera-facing puff quads that the smoke's
 * material graph (data/smokeLook.ts, the shardfile's look.materials) poses and fades on the frame clock; nothing moves on
 * the CPU. This module only lays the quads: each puff's corner, uv and `aPuff` (start age, life speed, start seed) from the
 * row's LCG. Without the compiled graph (a page that builds the castaway outside the hybrid world) the column is not drawn.
 *
 *   const smoke = new SmokeColumn(row, fireLocal);   // in the parent's frame
 *   group.add(smoke.mesh);
 */

let look: THREE.Material | null = null;
/** hand the smoke its compiled graph (look.materials, data/smokeLook.ts) before the castaway builds */
export function setSmokeLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(SMOKE_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the smoke graph');
  look = material;
}

/** a puff quad's four corners, x then y (metres of its size; the graph scales and turns them to the camera) */
const CORNERS: readonly number[] = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
/** the most puffs one column lays (its loop bounds it by the literal too) */
const MAX_PUFFS = 256;

/** A smoke column (one draw) rising from a fire in its parent's frame. */
export class SmokeColumn {
  /** the column: add it to the fire's parent */
  readonly mesh: THREE.Mesh;

  constructor(row: SmokeColumnRow, at: THREE.Vector3) {
    const n = Math.min(row.count, MAX_PUFFS), position = new Float32Array(n * 12), uv = new Float32Array(n * 8), puff = new Float32Array(n * 12), index: number[] = [];
    let hs = row.seed;
    const rnd = (): number => { hs = (Math.imul(hs, 1103515245) + 12345) & 0x7fffffff; return hs / 0x7fffffff; };
    for (let i = 0; i < Math.min(n, 256); i++) {
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
    const o = row.bounds.offset;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(o[0], o[1], o[2]), row.bounds.radius);
    this.mesh = new THREE.Mesh(g, look ?? undefined);
    this.mesh.name = row.name;
    this.mesh.position.copy(at);
    this.mesh.renderOrder = row.renderOrder;
    this.mesh.visible = look !== null;
  }
}

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { CROWN, DAIS } from '../data/layout';
import { CROWN_RING, CROWN_STONES, type Stone } from '../data/crownLayout';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/crown.glb` + `data/crown.json`;
 * the client draws the bake (`world/crown.ts`) with the modelled stones and dais.
 *
 * The storm crown's arena (loop 4, mockup D): the pennant ropes and flags between the stone tops, and the arena's colliders
 * (the dais and each stone).
 */

const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const rgb = (hex: number): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b]; };

/** Pennant ropes between neighbouring stone tops (not across the entrance): a sagging cord, triangular flags hanging off it. */
function pennants(stones: readonly Stone[]): { rope: BufferGeometry; flags: BufferGeometry } {
  const rope: number[] = [], flag: number[] = [], fcol: number[] = [];
  // muted navy, cream and faded teal and ochre (E399, mockup D's weathered pennants)
  const colors = [rgb(0x4f7a7c), rgb(0xd9cdb4), rgb(0x34405a), rgb(0xb08a4a)];
  let f = 0;
  for (let i = 0; i + 1 < stones.length; i++) {
    const a = stones[i], b = stones[i + 1]; if (a === undefined || b === undefined) continue;
    const ya = CROWN.y + a.h - 0.35, yb = CROWN.y + b.h - 0.35, len = Math.hypot(b.x - a.x, b.z - a.z), sag = len * 0.12, segs = 14;
    const at = (t: number): [number, number, number] => [a.x + (b.x - a.x) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t];
    for (let s = 0; s < segs; s++) {
      const p = at(s / segs), q = at((s + 1) / segs), w = 0.025;
      rope.push(p[0], p[1] + w, p[2], q[0], q[1] + w, q[2], q[0], q[1] - w, q[2], p[0], p[1] + w, p[2], q[0], q[1] - w, q[2], p[0], p[1] - w, p[2]);
    }
    const count = Math.floor(len / 0.85);
    for (let k = 1; k < count; k++) {
      const t0 = (k - 0.3) / count, t1 = (k + 0.3) / count, p = at(t0), q = at(t1), m = at((t0 + t1) / 2), drop = 0.55 + 0.1 * hash(i, k);
      flag.push(...p, ...q, m[0], m[1] - drop, m[2]);
      const c = colors[f++ % colors.length] ?? colors[0] ?? [1, 1, 1]; fcol.push(...c, ...c, ...c);
    }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(rope, 3)); r.computeVertexNormals();
  const fl = new BufferGeometry(); fl.setAttribute('position', new Float32BufferAttribute(flag, 3)); fl.setAttribute('color', new Float32BufferAttribute(fcol, 3)); fl.computeVertexNormals();
  return { rope: r, flags: fl };
}

const one = (geometry: BufferGeometry, material: MeshStandardMaterial, at = new Matrix4()): InstancedMesh => { const mesh = new InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, at); return mesh; };

export interface CrownSet { readonly kinds: (readonly [string, InstancedMesh])[]; readonly colliders: ColliderDesc[] }

/** The arena's code parts in world space: the pennant ropes and flags; and its colliders (the dais and each stone). */
export function buildCrownSet(): CrownSet {
  const stones = CROWN_STONES, { rope, flags } = pennants(stones);
  const ropes = one(rope, new MeshStandardMaterial({ color: 0xd6c095, roughness: 1, metalness: 0, side: DoubleSide }));
  const flagMesh = one(flags, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide }));
  const colliders = [boxDesc({ x: DAIS.x, z: DAIS.z, hw: DAIS.r * 0.9, hd: DAIS.r * 0.9, rot: 0, yBottom: CROWN.y, yTop: CROWN.y + DAIS.h }, 'stone'),
    ...stones.map((st) => boxDesc({ x: st.x, z: st.z, hw: CROWN_RING.width / 2, hd: CROWN_RING.depth / 2, rot: -st.yaw, yBottom: CROWN.y, yTop: CROWN.y + st.h }, 'stone'))];
  return { kinds: [['rope', ropes], ['flags', flagMesh]], colliders };
}

/** The arena's two kinds (one instance each, world space) and its colliders. */
export function bakeSkyCrown(): PieceBake {
  const built = buildCrownSet();
  return bakeKinds('far.crown', built.kinds, built.colliders);
}

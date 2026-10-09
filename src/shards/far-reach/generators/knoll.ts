import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { ISLES, KNOLLS, type Knoll } from '../data/layout';
import { knollHeight } from '../layout';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/knolls.glb` + `data/knolls.json`;
 * the client draws the bake (`world/build.ts`), each knoll in the islands' painted rock, collided by its rows' hull.
 *
 * A grassy rise (E399, layout KNOLLS: proposal B's hill over the bridge, mockup D's look down into the arena): a low
 * convex cap of meadow on an island's deck, walkable (its steepest edge is under the 40 degree climb) and collided by its
 * own convex hull, so you can stand on it and look down the bridge. The meadow's blades grow over it (world/meadow.ts
 * reads `knollHeight`), the island paint covers it.
 */
const RINGS = 12, SEGMENTS = 36;

/** A knoll's cap, local to its centre on the deck. */
function knollGeometry(KNOLL: Knoll): BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], green = new Color(0x6e8a38), out = new Color();
  const at = (i: number, j: number): number => i === 0 ? 0 : 1 + (i - 1) * SEGMENTS + (j % SEGMENTS);
  pos.push(0, KNOLL.h, 0); col.push(green.r, green.g, green.b);
  for (let i = 1; i <= RINGS; i++) {
    const r = (i / RINGS) * KNOLL.base;
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      // the outermost ring tucks a little under the deck, so no seam shows where the rise meets the island top
      const y = i === RINGS ? -0.08 : knollHeight(KNOLL.x + x, KNOLL.z + z, KNOLL);
      pos.push(x, y, z);
      out.copy(green).multiplyScalar(0.9 + 0.2 * Math.sin(a * 5 + i));
      col.push(out.r, out.g, out.b);
    }
  }
  for (let j = 0; j < SEGMENTS; j++) idx.push(at(0, 0), at(1, j + 1), at(1, j));
  for (let i = 1; i < RINGS; i++) for (let j = 0; j < SEGMENTS; j++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
    idx.push(a, b, d, a, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** The knoll's collider points (local to its centre on the deck): its cap rings, the hull Rapier wraps them in. */
export function knollHull(KNOLL: Knoll): Float32Array {
  const pts: number[] = [0, KNOLL.h, 0];
  for (let i = 2; i <= RINGS; i += 2) {
    const r = (i / RINGS) * KNOLL.base;
    for (let j = 0; j < 18; j++) { const a = (j / 18) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pts.push(x, i === RINGS ? 0 : knollHeight(KNOLL.x + x, KNOLL.z + z, KNOLL), z); }
  }
  return new Float32Array(pts);
}

/** One knoll's hull row: its centre on its island's deck and its points (as float32, the collider's own). */
export interface KnollHullRow { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly points: number[] }

/** Each knoll as its own kind (named by its id, one instance on its island's deck), in the islands' painted rock (the default mix). */
export function buildKnolls(): { kinds: (readonly [string, InstancedMesh])[]; hulls: KnollHullRow[] } {
  const kinds: (readonly [string, InstancedMesh])[] = [], hulls: KnollHullRow[] = [];
  for (const k of KNOLLS) {
    const isle = ISLES.find((i) => i.id === k.isle); if (isle === undefined) continue;
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }); material.userData['paint'] = 0.85;
    const mesh = new InstancedMesh(knollGeometry(k), material, 1); mesh.setMatrixAt(0, new Matrix4().makeTranslation(k.x, isle.y, k.z));
    kinds.push([k.id, mesh]); hulls.push({ id: k.id, x: k.x, y: isle.y, z: k.z, points: Array.from(knollHull(k)) });
  }
  return { kinds, hulls };
}

/** The knolls baked, their hulls as rows (`hulls`; the SDK's collider rows are boxes). */
export function bakeSkyKnolls(): PieceBake & { hulls: KnollHullRow[] } {
  const built = buildKnolls();
  return { ...bakeKinds('far.knolls', built.kinds, [], { extra: (m) => { const rockMix: unknown = m.userData['paint']; return typeof rockMix === 'number' ? { paint: rockMix } : {}; } }), hulls: built.hulls };
}

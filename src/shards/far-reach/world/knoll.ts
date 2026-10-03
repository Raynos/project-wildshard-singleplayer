import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { KNOLL, SUNREST, knollHeight } from '../layout';
import { paintIsleMaterial } from './isle';

/**
 * The grassy rise at the spawn bridge head (E399, proposal B: the bridge is seen from a hill above it, the windmill isle
 * below and beyond): a low convex cap of meadow on Sunrest beside the rope bridge's landing, walkable (its steepest edge
 * is under the 40 degree climb) and collided by its own convex hull, so you can stand on it and look down the bridge.
 * The meadow's blades grow over it (world/meadow.ts reads `knollHeight`), the island paint covers it.
 */
const RINGS = 12, SEGMENTS = 36;

export function knollMesh(): Mesh<BufferGeometry, MeshStandardMaterial> {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], green = new Color(0x6e8a38), out = new Color();
  const at = (i: number, j: number): number => i === 0 ? 0 : 1 + (i - 1) * SEGMENTS + (j % SEGMENTS);
  pos.push(0, KNOLL.h, 0); col.push(green.r, green.g, green.b);
  for (let i = 1; i <= RINGS; i++) {
    const r = (i / RINGS) * KNOLL.base;
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      // the outermost ring tucks a little under the deck, so no seam shows where the rise meets the island top
      const y = i === RINGS ? -0.08 : knollHeight(KNOLL.x + x, KNOLL.z + z);
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
  const mesh = new Mesh(g, paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true })));
  mesh.position.set(KNOLL.x, SUNREST.y, KNOLL.z); mesh.name = 'far.knoll';
  return mesh;
}

/** The knoll's collider points (local to its centre on the deck): its cap rings, the hull Rapier wraps them in. */
export function knollHull(): Float32Array {
  const pts: number[] = [0, KNOLL.h, 0];
  for (let i = 2; i <= RINGS; i += 2) {
    const r = (i / RINGS) * KNOLL.base;
    for (let j = 0; j < 18; j++) { const a = (j / 18) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; pts.push(x, i === RINGS ? 0 : knollHeight(KNOLL.x + x, KNOLL.z + z), z); }
  }
  return new Float32Array(pts);
}

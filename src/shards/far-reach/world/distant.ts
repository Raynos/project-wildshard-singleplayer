import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { islandMesh } from './shapes';
import type { Isle } from '../layout';

/**
 * The skyline (loop 2, review item 8): decorative floating islands in 3-D at varied heights and distances, out past the
 * playable archipelago (bounds x ±120, z −240…60), with hanging waterfalls. Not walkable, no colliders; one instanced
 * draw for the islands, one for the falls. The warm distance fog melts the far ones into the haze; the dome's painted
 * silhouettes carry on beyond them.
 */
export const FAR_ISLES: readonly (readonly [x: number, y: number, z: number, scale: number])[] = [
  [-150, 52, -120, 1.4], [-190, 18, -20, 1.1], [-160, 70, 60, 0.8], [-120, 8, -260, 1.6], [-60, 64, -330, 1.1],
  [60, 26, -340, 1.3], [140, 58, -250, 1.0], [180, 14, -130, 1.5], [170, 72, -20, 0.9], [150, 30, 90, 1.2],
  [40, 80, 150, 0.8], [-70, 22, 160, 1.3], [-220, 40, -200, 1.7], [230, 46, -320, 1.6],
];
/** Waterfalls off the skyline islands' rims: [x, lip y, z, length, width, yaw]. */
const FALLS: readonly (readonly [x: number, y: number, z: number, length: number, width: number, yaw: number])[] = [
  [-150 + 12, 52 - 1.2, -120, 46, 2.4, Math.PI / 2], [180 - 13, 14 - 1.2, -130, 30, 2.8, -Math.PI / 2], [-120 + 13, 8 - 1.2, -260, 20, 3, Math.PI / 2],
  [60, 26 - 1.2, -340 + 12, 34, 2.6, 0], [140 - 9, 58 - 1.2, -250, 40, 2, -Math.PI / 2],
];

/** A falling sheet: white at the lip fading to nothing far below (vertex alpha), a slight outward bow. */
export function fallGeometry(length: number, width: number): BufferGeometry {
  const pos: number[] = [], col: number[] = [], rows = 6, c = new Color();
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows, t1 = (r + 1) / rows, y0 = -t0 * length, y1 = -t1 * length, b0 = Math.sin(t0 * 1.4) * 1.5, b1 = Math.sin(t1 * 1.4) * 1.5;
    const a0 = 1 - t0, a1 = 1 - t1;
    const quad: [number, number, number, number][] = [[-width / 2, y0, b0, a0], [width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y1, b1, a1]];
    for (const [x, y, z, a] of quad) { pos.push(x, y, z); c.setRGB(0.95, 0.97, 1); col.push(c.r, c.g, c.b, a * 0.8); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 4));
  return g;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The skyline group, plus one waterfall off the windmill isle's west rim at `mill` (the lead's loop-2 ask). */
export function skyline(mill: Isle): Group {
  const group = new Group(), rnd = seeded(97), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  const proto: Isle = { id: 'far', x: 0, z: 0, r: 10, y: 0, keel: 18 }, source = islandMesh(proto, rnd);
  const isles = new InstancedMesh(source.geometry, source.material, FAR_ISLES.length);
  FAR_ISLES.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, rnd() * 6.28); m.compose(new Vector3(x, y, z), q, new Vector3(s, s * (0.9 + rnd() * 0.5), s)); isles.setMatrixAt(i, m); });
  isles.computeBoundingSphere(); group.add(isles);
  const all = [...FALLS, [mill.x - mill.r * 0.92, mill.y - 1.1, mill.z + 3, 60, 2.2, Math.PI / 2] as const];
  const fall = fallGeometry(1, 1), falls = new InstancedMesh(fall, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }), all.length);
  all.forEach(([x, y, z, length, width, yaw], i) => { q.setFromAxisAngle(up, yaw); m.compose(new Vector3(x, y, z), q, new Vector3(width, length, 1)); falls.setMatrixAt(i, m); });
  falls.computeBoundingSphere(); group.add(falls);
  return group;
}

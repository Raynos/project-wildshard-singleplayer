import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Isle } from '../layout';

/**
 * The falls (loop 5): waterfalls off the playable isles' rims into the cloud sea (the targets have them; council R1C-9).
 * Loop 2's fourteen 3-D skyline islands are gone (council R1C-12 / R1B-7: bare cones in front of the painted matte's
 * finished islands); the panorama (look/sky.ts) carries every far island now. Each fall is [isle, the rim angle in
 * radians (0 = +x), length].
 */
const FALLS: readonly (readonly [isle: string, angle: number, length: number])[] = [
  ['windmill', Math.PI, 60], ['grove', Math.PI * 0.75, 44], ['ruin', 0.2, 50], ['keeper', Math.PI * 1.15, 40], ['crown', Math.PI * 1.55, 70],
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

/** The falls, one instanced draw: each sheet hangs from its isle's lip, facing out. */
export function skyline(isles: readonly Isle[]): Group {
  const group = new Group(), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  const at = FALLS.flatMap(([id, a, length]) => { const isle = isles.find((i) => i.id === id); return isle === undefined ? [] : [{ isle, a, length }]; });
  const fall = fallGeometry(1, 1), falls = new InstancedMesh(fall, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }), at.length);
  at.forEach(({ isle, a, length }, k) => {
    const r = isle.r * Math.cos(Math.PI / 12) * 0.9, width = 1.8 + isle.r * 0.04;
    q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a)));
    m.compose(new Vector3(isle.x + Math.cos(a) * r, isle.y - 1.1, isle.z + Math.sin(a) * r), q, new Vector3(width, length, 1)); falls.setMatrixAt(k, m);
  });
  falls.computeBoundingSphere(); group.add(falls);
  return group;
}

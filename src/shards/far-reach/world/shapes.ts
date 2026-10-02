import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import type { Isle } from '../layout';

/** The Sky Reach palette (sRGB hex): golden-hour grass, warm dirt, violet keel rock, dusk pines. */
export const PALETTE = {
  grass: 0x7f9a55, grassLight: 0x93ab62, dirt: 0x6e4f3e, rock: 0x4d3c5a, rockDark: 0x33283f,
  pine: 0x2f2c41, trunk: 0x3d2b2c, plank: 0x7d5c45, rope: 0xcdb68c, tower: 0x4a3a4f, sail: 0x6f5b70, glow: 0x9fe6f2,
} as const;

type Tri = (a: Vector3, b: Vector3, c: Vector3, color: number) => void;
function builder(): { tri: Tri; geometry: () => BufferGeometry } {
  const pos: number[] = [], col: number[] = [], c = new Color();
  const tri: Tri = (a, b, d, color) => {
    c.setHex(color);
    for (const p of [a, b, d]) { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); }
  };
  return { tri, geometry: () => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; } };
}
export const flat = (color = 0xffffff, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

/**
 * A floating island: a flat 12-gon grass top at local y 0 (its collider top), a dirt band, then a jagged violet keel
 * tapering to a point `keel` metres down. Flat-shaded vertex colours, one draw.
 */
export function islandMesh(isle: Isle, random: () => number): Mesh {
  const { tri, geometry } = builder(), n = 12;
  const ring = (radius: number, y: number, jitter: number, yJitter = 0): Vector3[] => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, rr = radius * (1 - jitter * random());
    return new Vector3(Math.cos(a) * rr, y - yJitter * random(), Math.sin(a) * rr);
  });
  const centre = new Vector3(0, 0.08, 0), inner = ring(isle.r * 0.55, 0.12, 0.08), rim = ring(isle.r, 0, 0);
  const band = ring(isle.r * 0.97, -1.3, 0.02, 0.3), mid = ring(isle.r * 0.72, -isle.keel * 0.38, 0.12, 2);
  const low = ring(isle.r * 0.34, -isle.keel * 0.74, 0.2, 2), tip = new Vector3((random() - 0.5) * 2, -isle.keel, (random() - 0.5) * 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ci, cj, ri, rj, bi, bj, mi, mj, li, lj] = [inner[i], inner[j], rim[i], rim[j], band[i], band[j], mid[i], mid[j], low[i], low[j]];
    if (!ci || !cj || !ri || !rj || !bi || !bj || !mi || !mj || !li || !lj) continue;
    tri(centre, cj, ci, i % 2 ? PALETTE.grass : PALETTE.grassLight);
    tri(ci, cj, rj, PALETTE.grass); tri(ci, rj, ri, i % 3 ? PALETTE.grass : PALETTE.grassLight);
    tri(ri, rj, bj, PALETTE.dirt); tri(ri, bj, bi, PALETTE.dirt);
    tri(bi, bj, mj, PALETTE.rock); tri(bi, mj, mi, i % 2 ? PALETTE.rock : PALETTE.rockDark);
    tri(mi, mj, lj, PALETTE.rockDark); tri(mi, lj, li, PALETTE.rock);
    tri(li, lj, tip, PALETTE.rockDark);
  }
  return new Mesh(geometry(), flat(0xffffff, { vertexColors: true }));
}

/** One pine (trunk + two stacked cones) as a single vertex-coloured geometry for instancing. */
export function pineGeometry(): BufferGeometry {
  const parts: [BufferGeometry, number][] = [];
  const trunk = new CylinderGeometry(0.18, 0.28, 1.6, 5); trunk.translate(0, 0.8, 0); parts.push([trunk, PALETTE.trunk]);
  const low = new ConeGeometry(1.7, 3.6, 6); low.translate(0, 3, 0); parts.push([low, PALETTE.pine]);
  const high = new ConeGeometry(1.15, 3, 6); high.translate(0, 5.1, 0); parts.push([high, PALETTE.pine]);
  const { tri, geometry } = builder(), a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const [part, color] of parts) {
    const flatPart = part.toNonIndexed(), p = flatPart.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); tri(a, b, c, color); }
    part.dispose(); flatPart.dispose();
  }
  return geometry();
}
export function pines(at: readonly (readonly [number, number, number, number])[]): InstancedMesh {
  const mesh = new InstancedMesh(pineGeometry(), flat(0xffffff, { vertexColors: true }), at.length), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  at.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, i * 1.7); m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere(); return mesh;
}

/** A plank bridge along a local -Z run of `length` metres, `width` wide, deck top at local y 0. */
export function plankBridge(length: number, width: number, material: MeshStandardMaterial, rails: MeshStandardMaterial | null): Group {
  const group = new Group(), step = 0.62, count = Math.max(1, Math.floor(length / step));
  const planks = new InstancedMesh(new BoxGeometry(width, 0.12, 0.5), material, count), m = new Matrix4();
  for (let i = 0; i < count; i++) { m.makeTranslation(0, -0.06, -(i + 0.5) * (length / count)); planks.setMatrixAt(i, m); }
  planks.computeBoundingSphere(); group.add(planks);
  if (rails !== null) {
    for (const side of [-1, 1]) {
      const rope = new Mesh(new BoxGeometry(0.06, 0.06, length), rails); rope.position.set(side * width / 2, 1, -length / 2); group.add(rope);
      const low = new Mesh(new BoxGeometry(0.05, 0.05, length), rails); low.position.set(side * width / 2, 0.45, -length / 2); group.add(low);
      for (const z of [0, -length]) { const post = new Mesh(new BoxGeometry(0.16, 1.3, 0.16), flat(PALETTE.trunk)); post.position.set(side * width / 2, 0.55, z); group.add(post); }
    }
  }
  return group;
}

/** The old windmill: a tapered octagonal tower, a cap and four lattice sails on a hub that the plugin turns. */
export function windmill(): { group: Group; hub: Object3D } {
  const group = new Group(), hub = new Group();
  const tower = new Mesh(new CylinderGeometry(1.5, 2.5, 9, 8), flat(PALETTE.tower)); tower.position.y = 4.5; group.add(tower);
  const cap = new Mesh(new ConeGeometry(2.1, 2.4, 8), flat(PALETTE.rockDark)); cap.position.y = 10.2; group.add(cap);
  const door = new Mesh(new BoxGeometry(1, 1.8, 0.2), flat(PALETTE.rockDark)); door.position.set(0, 0.9, 2.4); group.add(door);
  hub.position.set(0, 8.6, 2.2); group.add(hub);
  const sail = flat(PALETTE.sail);
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = (i * Math.PI) / 2; hub.add(arm);
    const spar = new Mesh(new BoxGeometry(0.22, 7, 0.22), sail); spar.position.y = 3.5; arm.add(spar);
    const cloth = new Mesh(new BoxGeometry(1.5, 5.2, 0.06), sail); cloth.position.set(0.85, 4.2, 0.05); arm.add(cloth);
  }
  return { group, hub };
}

/** The bridge winch: a drum between two posts and a crank. */
export function winch(): Group {
  const group = new Group(), wood = flat(PALETTE.trunk);
  for (const x of [-0.7, 0.7]) { const post = new Mesh(new BoxGeometry(0.2, 1.2, 0.2), wood); post.position.set(x, 0.6, 0); group.add(post); }
  const drum = new Mesh(new CylinderGeometry(0.32, 0.32, 1.2, 8), flat(PALETTE.rope)); drum.rotation.z = Math.PI / 2; drum.position.y = 0.95; group.add(drum);
  const crank = new Mesh(new BoxGeometry(0.1, 0.6, 0.1), wood); crank.position.set(0.85, 1.15, 0); group.add(crank);
  return group;
}

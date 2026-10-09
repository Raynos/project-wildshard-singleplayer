import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { NEST, ROOST, SPIRES } from '../data/layout';
import { spireAt } from '../layout';
import { bakeKinds, foldKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/roost.glb` + `data/roost.json`;
 * the client draws the bake (`world/baked.ts`).
 *
 * The Roost (loop 4; review H2: "a jagged island with a nest of driftwood and feathers"): the drift rays' island gets its
 * subject. A great nest of bleached driftwood sticks laid round a straw bowl with three pale eggs and loose feathers, and
 * three wind-cut sandstone spires on the far rim that make the island read as jagged from Sunrest and the hover bridge.
 * Placed clear of the walk lanes (the hover landing on the west rim, the rope bridge north to the ruin; `NEST` and
 * `SPIRES` in data/layout.ts).
 */

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A spire: a noisy tapered column of warm strata, leaning a little, its top broken. */
function spireGeometry(h: number, r: number, rnd: () => number): BufferGeometry {
  const g = new CylinderGeometry(r * 0.35, r, h, 9, 10).toNonIndexed(); g.translate(0, h / 2, 0);
  const p = g.getAttribute('position'), col: number[] = [], c = new Color(), sand = new Color(0xd2a676), ochre = new Color(0xb98257), clay = new Color(0x9a6650), mauve = new Color(0x8a7385);
  const lean = (rnd() - 0.5) * 0.12, seed = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h, a = Math.atan2(z, x);
    const bump = 1 + 0.18 * Math.sin(a * 3 + seed + y * 0.9) + 0.1 * Math.sin(a * 7 - y * 2.1);
    const top = t > 0.92 ? 1 - (Math.sin(a * 5 + seed) * 0.5 + 0.5) * 0.12 : 1;
    p.setXYZ(i, x * bump + lean * y, y * top, z * bump);
    const band = Math.sin(y * 2.2 + Math.sin(a * 2) * 0.6) * 0.5 + 0.5;
    c.copy(sand).lerp(ochre, band).lerp(clay, (Math.sin(y * 5.3) * 0.5 + 0.5) * 0.35).lerp(mauve, (1 - t) * 0.35);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/** A feather: a long thin vane with a quill, about 0.5 m, lying flat in its local XZ plane. */
function featherGeometry(): BufferGeometry {
  const pos: number[] = [], n = 6, len = 0.5;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, w0 = Math.sin(Math.PI * Math.min(1, t0 * 1.15)) * 0.06, w1 = Math.sin(Math.PI * Math.min(1, t1 * 1.15)) * 0.06;
    pos.push(-w0, 0, t0 * len, w0, 0, t0 * len, w1, 0, t1 * len, -w0, 0, t0 * len, w1, 0, t1 * len, -w1, 0, t1 * len);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

export interface Roost { readonly group: Group; readonly colliders: ColliderDesc[] }

/** The nest and the spires, in world space at the Roost's deck height. */
export function roost(): Roost {
  const rnd = seeded(6219), group = new Group(); group.name = 'far.roost.nest';
  const y = ROOST.y, m = new Matrix4(), q = new Quaternion(), s = new Vector3(), v = new Vector3(), e = new Vector3();
  // the sticks: laid round the ring, each tangent with a random tilt, three loose courses high
  const sticks = new InstancedMesh(new CylinderGeometry(0.06, 0.08, 1, 5), new MeshStandardMaterial({ vertexColors: false, color: 0xc9b597, roughness: 1, metalness: 0 }), NEST.sticks);
  const tone = new Color();
  for (let i = 0; i < NEST.sticks; i++) {
    const a = (i / NEST.sticks) * Math.PI * 2 * 3 + rnd() * 0.4, course = Math.floor((i / NEST.sticks) * 3), r = NEST.r - course * 0.35 + (rnd() - 0.5) * 0.4;
    const len = 1.5 + rnd() * 1.2, h = 0.15 + course * 0.28 + rnd() * 0.12;
    // tangent direction, tilted up or down a little and inward
    e.set(-Math.sin(a), (rnd() - 0.5) * 0.35, Math.cos(a)).normalize();
    q.setFromUnitVectors(new Vector3(0, 1, 0), e);
    m.compose(v.set(NEST.x + Math.cos(a) * r, y + h, NEST.z + Math.sin(a) * r), q, s.set(1 + rnd() * 0.4, len, 1 + rnd() * 0.4));
    sticks.setMatrixAt(i, m); sticks.setColorAt(i, tone.setHex(0xc9b597).lerp(new Color(0x7a6650), rnd() * 0.6));
  }
  sticks.computeBoundingSphere(); group.add(sticks);
  // the bowl: a shallow dish of straw
  const bowl = new Mesh(new SphereGeometry(NEST.r - 0.3, 18, 6, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), new MeshStandardMaterial({ color: 0xa88a52, roughness: 1, metalness: 0, side: DoubleSide }));
  bowl.scale.set(1, 0.32, 1); bowl.position.set(NEST.x, y + 0.75, NEST.z); group.add(bowl);
  // three pale eggs
  const eggMat = new MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.6, metalness: 0, emissive: 0x1a2a30 });
  for (let i = 0; i < 3; i++) {
    const egg = new Mesh(new SphereGeometry(0.28, 12, 9), eggMat); egg.scale.set(1, 1.3, 1);
    egg.position.set(NEST.x + Math.cos(i * 2.1) * 0.45, y + 0.42, NEST.z + Math.sin(i * 2.1) * 0.45); egg.rotation.z = (i - 1) * 0.4; group.add(egg);
  }
  // loose feathers, white and slate blue, tucked in the rim and lying in the grass
  const feathers = new InstancedMesh(featherGeometry(), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: DoubleSide }), NEST.feathers);
  for (let i = 0; i < NEST.feathers; i++) {
    const a = rnd() * Math.PI * 2, r = NEST.r * (0.7 + rnd() * 0.9), lift = r < NEST.r + 0.2 ? 0.5 + rnd() * 0.4 : 0.05;
    q.setFromAxisAngle(new Vector3(0, 1, 0), rnd() * Math.PI * 2).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (rnd() - 0.5) * 0.9));
    m.compose(v.set(NEST.x + Math.cos(a) * r, y + lift, NEST.z + Math.sin(a) * r), q, s.set(1.2, 1, 1.2));
    feathers.setMatrixAt(i, m); feathers.setColorAt(i, tone.setHex(i % 3 === 0 ? 0x7f93ad : 0xf4efe6));
  }
  feathers.computeBoundingSphere(); group.add(feathers);
  // the spires
  const colliders: ColliderDesc[] = [];
  for (const sp of SPIRES) {
    const at = spireAt(sp), mesh = new Mesh(spireGeometry(sp.h, sp.r, rnd), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));
    mesh.position.set(at.x, y - 0.4, at.z); group.add(mesh);
    colliders.push(boxDesc({ x: at.x, z: at.z, hw: sp.r * 0.75, hd: sp.r * 0.75, rot: 0, yBottom: y, yTop: y + sp.h }, 'stone'));
  }
  // the nest is a low wall of sticks: a ring of boxes you cannot step over
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    colliders.push(boxDesc({ x: NEST.x + Math.cos(a) * (NEST.r - 0.2), z: NEST.z + Math.sin(a) * (NEST.r - 0.2), hw: 0.95, hd: 0.3, rot: -(a + Math.PI / 2), yBottom: y, yTop: y + 0.9 }, 'wood'));
  }
  return { group, colliders };
}

/** The Roost's bake: its kinds and colliders, and the tinted kinds' per-instance colours (the GLB carries none). */
export interface RoostBake extends PieceBake { tints: Record<string, number[]> }

/**
 * The nest and spires folded into instanced kinds (world space: the Roost bakes where it stands). The sticks and feathers
 * are instanced already and keep their instances; their per-instance colours go in the rows (`tints`, the exact floats
 * `setColorAt` left), which the client puts back. Every other mesh folds by shape and look.
 */
export function bakeSkyRoost(): RoostBake {
  const built = roost(), plain = new Group(), kinds: (readonly [string, InstancedMesh])[] = [], tints: Record<string, number[]> = {};
  const names = ['sticks', 'feathers'];
  // a copy: a plain mesh moves to its own group as it is read
  for (const child of built.group.children.slice()) {
    if (!(child instanceof InstancedMesh)) { plain.add(child); continue; }
    const name = names[kinds.length] ?? `instanced-${String(kinds.length)}`;
    if (child.instanceColor !== null) tints[name] = Array.from(child.instanceColor.array);
    child.instanceColor = null; kinds.push([name, child]);
  }
  return { ...bakeKinds('far.roost', [...kinds, ...foldKinds(plain)], built.colliders), tints };
}

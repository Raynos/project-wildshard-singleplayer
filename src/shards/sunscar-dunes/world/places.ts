import { AdditiveBlending, BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '#engine';
import { CARAVAN, WELL } from '../layout';

const WOOD = 0x4a2e1e, WOOD_DARK = 0x2c1b14, IRON = 0x231c1c, CANVAS = 0x8a6448, STONE = 0x6a4a3a, LEATHER = 0x3a1e12, CLAY = 0x7a3a22;
const mat = (color: number, extra: Partial<{ metalness: number; side: typeof DoubleSide }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);
const at = (mesh: Mesh, x: number, y: number, z: number, parent: Group): Mesh => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; logbook: Mesh }

/**
 * The half-buried caravan: a covered wagon sunk to its axles and tipped by the drift, its canvas torn off the front
 * hoops, one wheel showing, crates and a barrel spilled on the lee side, the logbook on the tailboard.
 */
export function buildCaravan(groundAt: (x: number, z: number) => number): CaravanParts {
  const root = new Group(), wagon = new Group(), colliders: ColliderDesc[] = [];
  const wood = mat(WOOD), dark = mat(WOOD_DARK), iron = mat(IRON, { metalness: 0.4 }), canvas = mat(CANVAS, { side: DoubleSide });
  const y = groundAt(CARAVAN.x, CARAVAN.z);
  root.position.set(CARAVAN.x, y, CARAVAN.z); root.rotation.y = CARAVAN.yaw;
  // The wagon in its own frame (+Z is the front), tipped and sunk.
  wagon.position.set(0, -0.55, 0); wagon.rotation.set(-0.1, 0, 0.13); root.add(wagon);
  at(box(2.0, 0.35, 4.4, wood), 0, 0.9, 0, wagon);
  for (const side of [-1, 1]) at(box(0.08, 0.62, 4.4, dark), side, 1.36, 0, wagon);
  at(box(2.0, 0.62, 0.08, dark), 0, 1.36, -2.2, wagon);
  for (let i = 0; i < 5; i++) {
    const hoop = new Mesh(new TorusGeometry(1.0, 0.045, 4, 12, Math.PI), dark); at(hoop, 0, 1.62, -1.8 + i * 0.9, wagon);
  }
  const cover = new Mesh(new CylinderGeometry(1.03, 1.03, 2.5, 12, 1, true, -Math.PI / 2, Math.PI), canvas);
  cover.geometry.rotateX(-Math.PI / 2); at(cover, 0, 1.62, -0.95, wagon);
  // A torn flap hanging off the last covered hoop.
  const flap = box(1.2, 0.9, 0.02, canvas); flap.rotation.set(0.5, 0.2, 0.35); at(flap, 0.55, 2.0, 0.45, wagon);
  for (const [x, z] of [[1.12, 1.5], [1.12, -1.5]] as const) {
    const wheel = new Mesh(new CylinderGeometry(0.78, 0.78, 0.1, 14), wood); wheel.rotation.z = Math.PI / 2; at(wheel, x, 0.72, z, wagon);
    const rim = new Mesh(new TorusGeometry(0.78, 0.05, 4, 14), iron); rim.rotation.y = Math.PI / 2; at(rim, x + 0.02, 0.72, z, wagon);
  }
  for (const side of [-1, 1]) { const shaft = box(0.09, 0.09, 2.6, wood); shaft.rotation.x = 0.22; at(shaft, side * 0.45, 0.55, 3.3, wagon); }
  // Spilled cargo on the lee (−X) side, on the sand itself.
  const cargo: [number, number, number, number][] = [[-2.3, 0.7, 0.35, 0.3], [-2.8, -0.8, 0.3, -0.4], [-1.9, -2.4, 0.4, 0.9]];
  for (const [x, z, half, yaw] of cargo) {
    const crate = box(half * 2, half * 2, half * 2, wood); crate.rotation.y = yaw; at(crate, x, half * 0.8, z, root);
  }
  const barrel = new Mesh(new CylinderGeometry(0.34, 0.34, 0.9, 10), dark); barrel.rotation.set(0, 0.6, Math.PI / 2); at(barrel, -2.4, 0.25, 2.3, root);
  // The logbook: on the tailboard, the wagon's back (−Z).
  const logbook = box(0.32, 0.07, 0.42, mat(LEATHER)); logbook.rotation.y = 0.3; at(logbook, 0.35, 1.12, -2.55, root);
  const logbookAt = new Vector3(0.35, 1.12, -2.55).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  // Colliders: the wagon body and the cargo (world space).
  const world = (x: number, z: number): Vector3 => new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  const body = world(0, 0);
  colliders.push(boxDesc({ x: body.x, z: body.z, hw: 1.1, hd: 2.3, rot: -CARAVAN.yaw, yBottom: y - 1, yTop: y + 1.9 }, 'wood'));
  for (const [x, z, half] of cargo) { const c = world(x, z); colliders.push(boxDesc({ x: c.x, z: c.z, hw: half, hd: half, rot: -CARAVAN.yaw, yBottom: y - 0.5, yTop: y + half * 1.8 }, 'wood')); }
  return { root, colliders, logbookAt, logbook };
}

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; jar: Mesh; crank: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

/**
 * The dry well: a ring of 12 dressed stones, two posts and a windlass with a crank (the whip's pull target), the rope
 * down to a bucket that holds a sealed clay oil jar. `drop` is how far below the rim the bucket hangs.
 */
export function buildWell(groundAt: (x: number, z: number) => number): WellParts {
  const root = new Group(), colliders: ColliderDesc[] = [], y = groundAt(WELL.x, WELL.z), wood = mat(WOOD), dark = mat(WOOD_DARK);
  root.position.set(WELL.x, y, WELL.z);
  const R = 1.35, n = 12, ring = new InstancedMesh(new BoxGeometry(0.72, 0.85, 0.42), mat(STONE), n), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    q.setFromAxisAngle(up, a); m.compose(new Vector3(Math.sin(a) * R, 0.35, Math.cos(a) * R), q, new Vector3(1, 1, 1)); ring.setMatrixAt(i, m);
    colliders.push(boxDesc({ x: WELL.x + Math.sin(a) * R, z: WELL.z + Math.cos(a) * R, hw: 0.38, hd: 0.24, rot: -a, yBottom: y - 0.5, yTop: y + 0.78 }, 'stone'));
  }
  ring.instanceMatrix.needsUpdate = true; ring.computeBoundingSphere(); root.add(ring);
  // The shaft: a dark disc inside the ring.
  const hole = new Mesh(new CylinderGeometry(R - 0.25, R - 0.25, 0.05, 16), new MeshBasicMaterial({ color: 0x0a0605 })); at(hole, 0, 0.62, 0, root);
  for (const side of [-1, 1]) {
    at(box(0.16, 2.3, 0.16, wood), side * (R + 0.15), 1.15, 0, root);
    colliders.push(boxDesc({ x: WELL.x + side * (R + 0.15), z: WELL.z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y, yTop: y + 2.3 }, 'wood'));
  }
  const axle = new Mesh(new CylinderGeometry(0.12, 0.12, R * 2 + 0.3, 8), dark); axle.rotation.z = Math.PI / 2; at(axle, 0, 2.05, 0, root);
  const crank = box(0.07, 0.6, 0.07, mat(IRON, { metalness: 0.4 })); at(crank, R + 0.32, 1.85, 0, root);
  const drop = 2.6, bucket = new Group(); bucket.position.set(0, 1.85 - drop, 0); root.add(bucket);
  const rope = new Mesh(new CylinderGeometry(0.02, 0.02, drop, 4), mat(0x6b5236)); rope.position.y = drop / 2; bucket.add(rope);
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.material.side = DoubleSide; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), mat(CLAY)); jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  return { root, colliders, bucket, jar, crank, crankAt: new Vector3(WELL.x + R + 0.32, y + 1.85, WELL.z), jarAt: new Vector3(WELL.x, y + 1.0, WELL.z), drop };
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; glow: Mesh; bowlAt: Vector3; oil: Mesh }

/** A waymark brazier: a stone plinth, an iron post and bowl, a hidden fire and a soft additive glow (no light). */
export function buildBrazier(x: number, z: number, groundAt: (x: number, z: number) => number): BrazierParts {
  const root = new Group(), colliders: ColliderDesc[] = [], iron = mat(IRON, { metalness: 0.4 });
  // Sit on the lowest corner so the plinth never floats on a slope.
  const y = Math.min(groundAt(x, z), groundAt(x + 0.5, z + 0.5), groundAt(x - 0.5, z - 0.5), groundAt(x + 0.5, z - 0.5), groundAt(x - 0.5, z + 0.5));
  root.position.set(x, y, z);
  at(box(0.9, 0.7, 0.9, mat(STONE)), 0, 0.2, 0, root);
  at(new Mesh(new CylinderGeometry(0.07, 0.1, 1.0, 6), iron), 0, 1.05, 0, root);
  at(new Mesh(new CylinderGeometry(0.42, 0.18, 0.32, 8, 1, true), iron), 0, 1.6, 0, root);
  const oil = at(new Mesh(new CylinderGeometry(0.36, 0.36, 0.04, 8), new MeshStandardMaterial({ color: 0x1a120c, roughness: 0.2 })), 0, 1.62, 0, root);
  oil.visible = false;
  colliders.push(boxDesc({ x, z, hw: 0.45, hd: 0.45, rot: 0, yBottom: y - 0.3, yTop: y + 1.75 }, 'stone'));
  const fire = new Group(); fire.position.set(0, 1.62, 0); fire.visible = false; root.add(fire);
  const flame = (r: number, h: number, color: number, dx: number, dz: number): void => {
    const cone = new Mesh(new ConeGeometry(r, h, 6), new MeshBasicMaterial({ color })); cone.position.set(dx, h / 2, dz); fire.add(cone);
  };
  flame(0.28, 0.9, 0xff7a1e, 0, 0); flame(0.16, 1.2, 0xffb347, 0.04, -0.03); flame(0.08, 0.7, 0xffe6a0, -0.05, 0.04);
  const glow = new Mesh(new SphereGeometry(1.3, 10, 6), new MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.5; fire.add(glow);
  return { root, colliders, fire, glow, bowlAt: new Vector3(x, y + 1.6, z), oil };
}

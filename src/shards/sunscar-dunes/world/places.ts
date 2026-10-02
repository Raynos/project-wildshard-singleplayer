import { addFire, WAYMARK_FIRE } from './fireFx';
import { BoxGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '#engine';
import { CARAVAN, WELL } from '../layout';
import { duneMaterial, duneMesh, fit, without } from './meshes';

const WOOD = 0x4a2e1e, WOOD_DARK = 0x2c1b14, IRON = 0x231c1c, CANVAS = 0x8a6448, CANVAS_BLEACHED = 0xc9ad86, CANVAS_GLOW = 0x2e2519, STONE = 0x6a4a3a, LEATHER = 0x3a1e12, CLAY = 0x7a3a22;
const mat = (color: number, extra: Partial<{ metalness: number; side: typeof DoubleSide; emissive: number }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);
const at = (mesh: Mesh, x: number, y: number, z: number, parent: Group): Mesh => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

/** Spilled cargo on the lee (−X) side, on the sand itself: x, z, half size, yaw. */
const CARGO: readonly [number, number, number, number][] = [[-2.3, 0.7, 0.35, 0.3], [-2.8, -0.8, 0.3, -0.4], [-1.9, -2.4, 0.4, 0.9]];

/** Sun-bleached crate planks (loop 3: the plain dark boxes read as black cubes against the afterglow). */
const CRATE = 0x9a7352, CRATE_GLOW = 0x150b05;
const crateMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ color: CRATE, vertexColors: true, roughness: 0.9, flatShading: true, emissive: CRATE_GLOW });
/** A crate of four planks a side: each plank band a shade of its own, the frame boards at top and bottom darker. */
function crateGeometry(half: number): BoxGeometry {
  const g = new BoxGeometry(half * 2, half * 2, half * 2, 1, 4, 1), p = g.getAttribute('position'), colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const band = Math.min(3, Math.floor((p.getY(i) / (half * 2) + 0.5) * 4 - 1e-4)), shade = [0.72, 0.95, 0.84, 0.7][Math.max(0, band)] ?? 0.8;
    colors[i * 3] = shade; colors[i * 3 + 1] = shade * 0.97; colors[i * 3 + 2] = shade * 0.92;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

export interface CaravanParts { root: Group; colliders: ColliderDesc[]; logbookAt: Vector3; logbook: Mesh }

/**
 * The half-buried caravan: a covered wagon sunk to its axles and tipped by the drift, its canvas torn off the front
 * hoops, one wheel showing, crates and a barrel spilled on the lee side, the logbook on the tailboard.
 */
export function buildCaravan(groundAt: (x: number, z: number) => number): CaravanParts {
  const root = new Group(), wagon = new Group(), colliders: ColliderDesc[] = [];
  const wood = mat(WOOD), dark = mat(WOOD_DARK);
  const y = groundAt(CARAVAN.x, CARAVAN.z);
  root.position.set(CARAVAN.x, y, CARAVAN.z); root.rotation.y = CARAVAN.yaw;
  // The wagon in its own frame (+Z is the front), tipped and sunk.
  wagon.position.set(0, -0.55, 0); wagon.rotation.set(-0.1, 0, 0.13); root.add(wagon);
  // C6: the generated wagon (Hunyuan3D-2 from `ref-caravan.jpg`; its shafts lie along −X, turned to +Z), else the code one.
  const generated = duneMesh('caravan');
  if (generated) { wagon.add(new Mesh(fit(generated, { size: 6.2, by: 'span', yaw: Math.PI / 2 }), duneMaterial())); coverHoops(wagon); }
  else buildCodeWagon(wagon, wood, dark);
  const crateWood = crateMaterial();
  CARGO.forEach(([x, z, half, yaw]) => { const crate = new Mesh(crateGeometry(half), crateWood); crate.rotation.y = yaw; at(crate, x, half * 0.8, z, root); });
  const barrel = new Mesh(new CylinderGeometry(0.34, 0.34, 0.9, 10), dark); barrel.rotation.set(0, 0.6, Math.PI / 2); at(barrel, -2.4, 0.25, 2.3, root);
  // The logbook: on the tailboard, the wagon's back (−Z).
  const logbook = box(0.32, 0.07, 0.42, mat(LEATHER)); logbook.rotation.y = 0.3; at(logbook, 0.35, 1.12, -2.55, root);
  const logbookAt = new Vector3(0.35, 1.12, -2.55).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  // Colliders: the wagon body and the cargo (world space).
  const world = (x: number, z: number): Vector3 => new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), CARAVAN.yaw).add(root.position);
  const body = world(0, 0);
  colliders.push(boxDesc({ x: body.x, z: body.z, hw: 1.1, hd: 2.3, rot: -CARAVAN.yaw, yBottom: y - 1, yTop: y + 1.9 }, 'wood'));
  for (const [x, z, half] of CARGO) { const c = world(x, z); colliders.push(boxDesc({ x: c.x, z: c.z, hw: half, hd: half, rot: -CARAVAN.yaw, yBottom: y - 0.5, yTop: y + half * 1.8 }, 'wood')); }
  return { root, colliders, logbookAt, logbook };
}

/**
 * The generated wagon's hoops carry no canvas of their own (they read as bare dark ribs against the afterglow), so a
 * sun-bleached cover sits just outside the back three: an arch over the hoops' tops (x ±0.81, top 3.55 m in the fitted
 * frame), straight sides down to 2.1 m, a torn flap off its front edge; a faint glow keeps it pale against the afterglow.
 * The front hoops stay bare, as in the ref.
 */
const HOOPS = { cx: 0.88, cy: 2.62, top: 1.0, side: 0.55, back: -2.65, front: -0.15 } as const;
function coverHoops(wagon: Group): void {
  const canvas = mat(CANVAS_BLEACHED, { side: DoubleSide, emissive: CANVAS_GLOW }), len = HOOPS.front - HOOPS.back, mid = (HOOPS.front + HOOPS.back) / 2;
  const arch = new Mesh(new CylinderGeometry(1, 1, len, 9, 1, true, -Math.PI / 2, Math.PI), canvas);
  arch.geometry.rotateX(-Math.PI / 2); arch.scale.set(HOOPS.cx, HOOPS.top, 1); at(arch, 0, HOOPS.cy, mid, wagon);
  for (const side of [-1, 1]) at(box(0.02, HOOPS.side, len, canvas), side * HOOPS.cx, HOOPS.cy - HOOPS.side / 2, mid, wagon);
  const flap = box(1.1, 0.8, 0.02, canvas); flap.rotation.set(0.45, 0.2, 0.3); at(flap, 0.45, HOOPS.cy + 0.55, HOOPS.front + 0.25, wagon);
}

/** The code wagon (the stand-in when the generated one did not load): bed, sides, hoops, the torn canvas, wheels, shafts. */
function buildCodeWagon(wagon: Group, wood: Material, dark: Material): void {
  const iron = mat(IRON, { metalness: 0.4 }), canvas = mat(CANVAS, { side: DoubleSide });
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
}

/** The generated well's span (metres, the crank end to the far post): its ring then sits on the stones' colliders. */
const WELL_FIT = 3.4;

export interface WellParts { root: Group; colliders: ColliderDesc[]; bucket: Group; rope: Mesh; jar: Mesh; crank: Mesh; crankAt: Vector3; jarAt: Vector3; drop: number }

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
  ring.instanceMatrix.needsUpdate = true; ring.computeBoundingSphere();
  // C6: the generated well (Hunyuan3D-2 from `ref-well.jpg`): its ring, posts and windlass; its bucket and crank are cut
  // away, the code ones (below) animate. Else the code ring, posts and axle.
  const generated = duneMesh('dry-well');
  if (generated) {
    const fitted = fit(generated, { size: WELL_FIT, by: 'span' }), maxX = fitted.boundingBox?.max.x ?? 2;
    root.add(new Mesh(without(fitted, (cx, cy, cz) => cx > maxX - 0.3 || (Math.hypot(cx, cz) < 0.5 && cy > 0.75 && cy < 1.95)), duneMaterial()));
  } else root.add(ring);
  // The shaft: a dark disc inside the ring.
  const hole = new Mesh(new CylinderGeometry(R - 0.3, R - 0.3, 0.05, 16), new MeshBasicMaterial({ color: 0x0a0605 })); at(hole, 0, 0.62, 0, root);
  for (const side of [-1, 1]) {
    if (!generated) at(box(0.16, 2.3, 0.16, wood), side * (R + 0.15), 1.15, 0, root);
    colliders.push(boxDesc({ x: WELL.x + side * (R + 0.15), z: WELL.z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y, yTop: y + 2.3 }, 'wood'));
  }
  if (!generated) { const axle = new Mesh(new CylinderGeometry(0.12, 0.12, R * 2 + 0.3, 8), dark); axle.rotation.z = Math.PI / 2; at(axle, 0, 2.05, 0, root); }
  const crank = box(0.07, 0.6, 0.07, mat(IRON, { metalness: 0.4 })); at(crank, R + 0.32, 1.85, 0, root);
  const drop = 2.6, bucket = new Group(); bucket.position.set(0, 1.85 - drop, 0); root.add(bucket);
  const ropeGeo = new CylinderGeometry(0.02, 0.02, drop, 4); ropeGeo.translate(0, drop / 2, 0);
  const rope = new Mesh(ropeGeo, mat(0x6b5236)); bucket.add(rope); // grows from the bucket up to the axle; scaled down as it winds
  const pail = new Mesh(new CylinderGeometry(0.26, 0.2, 0.36, 8, 1, true), wood); pail.material.side = DoubleSide; bucket.add(pail);
  const jar = new Mesh(new SphereGeometry(0.17, 8, 6), mat(CLAY)); jar.scale.set(1, 1.3, 1); jar.position.y = 0.14; bucket.add(jar);
  return { root, colliders, bucket, rope, jar, crank, crankAt: new Vector3(WELL.x + R + 0.32, y + 1.85, WELL.z), jarAt: new Vector3(WELL.x, y + 1.0, WELL.z), drop };
}

export interface BrazierParts { root: Group; colliders: ColliderDesc[]; fire: Group; bowlAt: Vector3; oil: Mesh }

/** A waymark brazier: a stone plinth, an iron post and bowl, and a hidden fire (`fireFx.ts`; no light). */
export function buildBrazier(x: number, z: number, groundAt: (x: number, z: number) => number): BrazierParts {
  const root = new Group(), colliders: ColliderDesc[] = [];
  // Sit on the lowest corner so the plinth never floats on a slope.
  const y = Math.min(groundAt(x, z), groundAt(x + 0.5, z + 0.5), groundAt(x - 0.5, z - 0.5), groundAt(x + 0.5, z - 0.5), groundAt(x - 0.5, z + 0.5));
  root.position.set(x, y, z);
  // C6: the generated brazier (Hunyuan3D-2 from `ref-brazier.jpg`, plinth to bowl rim 1.85 m), else the code one.
  const generated = duneMesh('waymark-brazier'), bowl = generated ? 1.74 : 1.62;
  if (generated) root.add(new Mesh(fit(generated, { size: 1.85, by: 'height', floor: -0.12 }), duneMaterial()));
  else {
    at(box(0.9, 0.7, 0.9, mat(STONE)), 0, 0.2, 0, root);
    at(new Mesh(new CylinderGeometry(0.07, 0.1, 1.0, 6), mat(IRON, { metalness: 0.4 })), 0, 1.05, 0, root);
    at(new Mesh(new CylinderGeometry(0.42, 0.18, 0.32, 8, 1, true), mat(IRON, { metalness: 0.4 })), 0, 1.6, 0, root);
  }
  const oil = at(new Mesh(new CylinderGeometry(0.33, 0.33, 0.04, 8), new MeshStandardMaterial({ color: 0x1a120c, roughness: 0.2 })), 0, bowl, 0, root);
  oil.visible = false;
  colliders.push(boxDesc({ x, z, hw: 0.45, hd: 0.45, rot: 0, yBottom: y - 0.3, yTop: y + 1.75 }, 'stone'));
  const fire = new Group(); fire.position.set(0, bowl, 0); fire.visible = false; root.add(fire);
  // The fire (P2 #8): layered flame, glow, embers downwind, a smoke column and a warm pool on the sand.
  addFire(fire, WAYMARK_FIRE, { at: new Vector3(x, y + bowl, z), groundAt });
  return { root, colliders, fire, bowlAt: new Vector3(x, y + 1.6, z), oil };
}

import { BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, TorusGeometry, Vector3, type Material } from 'three';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { BRAZIERS, CARAVAN, WELL } from '../data/layout';
import { COOK, CRATES, HORSE, LANTERN, WELL_RIG } from '../data/places';
import { WIND } from '../world/dunes';
import { signalDunesField } from './tiles';
import { bakeKinds, colliderRows, foldKinds, type PieceBake } from './kinds';

/**
 * Build-time only (SHARD-PLATFORM SF72, SF67 fix 3 "bake the code-built worlds"): the caravan's, the well's and the
 * waymarks' static code meshes and colliders, baked offline (`scripts/bake-signal-world.mjs` → `baked/caravan.glb` +
 * `data/caravan.json`, `baked/well.glb` + `data/well.json`, `data/braziers.json`). They are built as the world always
 * showed them, over the shipped generated models (the wagon, the crates, the sacks, the horse, the well and the brazier
 * are Hunyuan3D-2 models the client places, `world/places.ts`), then folded into instanced kinds. What moves or burns stays
 * live in the client: the lantern's glass and halo, the cookfire, the well's bucket, rope, jar and crank, the braziers'
 * oil, kindling and fire.
 */

type Ground = (x: number, z: number) => number;
const up = new Vector3(0, 1, 0);

// round 2 (R1C-2): sun-greyed wood and worn iron a step lighter; at dusk the old near-black values read as black cut-outs
const WOOD_DARK = 0x86603f, IRON = 0x6e5e56, STONE = 0x6a4a3a, LEATHER = 0x3a1e12, POLE = 0x86603f;
const RAG = 0x8a2a16, RAG_GLOW = 0x1a0603;
/** The places' marker poles (metres): as tall as the waymark poles' reach from above. */
const MARK = { h: 6.5 } as const;
/** The caravan's tent, dark canvas pitched off the wagon's right as you come up behind it (mockup B). */
// round 8 (the council: a big flat grey sheet at the frame's edge; the mockup's tent is small and dark behind the horse)
const TENT = { x: -8.2, z: 2.6, yaw: 0.35, w: 2.6, h: 1.9, d: 3.0 } as const;
const TENT_CANVAS = 0x3a2e28; // council round 2: 0x2c2220 read as a pure-black wedge
/** Sun-bleached barrel staves (loop 3: the plain dark shapes read as black against the afterglow). */
const CRATE_GLOW = 0x2c1a0c, BARREL = 0x7e5a3e; // round 9 (the seats since round 5: black slabs): a warmer self-light

const mat = (color: number, extra: Partial<{ metalness: number; side: typeof DoubleSide; emissive: number }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
const box = (w: number, h: number, d: number, material: Material): Mesh => new Mesh(new BoxGeometry(w, h, d), material);
const at = (mesh: Mesh, x: number, y: number, z: number, parent: Group): Mesh => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

/** A long banner hanging from its crossbar, streaming along +x and sagging, in two kinked panels. */
function bannerGeometry(): BufferGeometry {
  const pts = [[0, 0, 0], [0, -0.75, 0], [0.55, -0.12, 0.06], [0.5, -0.82, 0.05], [1.1, -0.3, -0.04], [1.0, -0.9, -0.03]];
  const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5], pos: number[] = [];
  for (const i of idx) pos.push(...(pts[i] ?? [0, 0, 0]));
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

/**
 * A tall marker pole with a long madder pennant downwind (after the check pass: the well could not be picked out from the
 * aerial overview; the tower's pennant is the same mark). In `parent`'s frame at (lx, lz), standing on `groundY`
 * (relative to the parent), `h` metres tall; its collider in world space at (wx, wz).
 */
function markerPole(parent: Group, lx: number, lz: number, groundY: number, h: number, wx: number, wz: number, worldY: number, colliders: ColliderDesc[]): void {
  const pole = box(0.11, h, 0.11, mat(POLE)); at(pole, lx, groundY + h / 2 - 0.3, lz, parent);
  const flag = new Mesh(bannerGeometry(), new MeshStandardMaterial({ color: RAG, roughness: 0.9, side: DoubleSide, emissive: RAG_GLOW }));
  flag.scale.set(1.6, 1.2, 1.2); flag.position.set(lx, groundY + h - 0.35, lz);
  flag.rotation.y = Math.atan2(-WIND.z, WIND.x) - parent.rotation.y; parent.add(flag);
  colliders.push(boxDesc({ x: wx, z: wz, hw: 0.07, hd: 0.07, rot: 0, yBottom: worldY - 0.3, yTop: worldY + h }, 'wood'));
}

/** Where the client hangs the caravan's live parts: its ground height, the logbook and the lantern (world metres). */
export interface CaravanAnchors { y: number; logbook: [number, number, number]; lamp: [number, number, number] }

/**
 * The half-buried caravan's code-built parts round the generated wagon, crates, sacks and horse: the spilled barrel
 * (staves and two iron hoops), the logbook on the tailboard, the lantern's iron cage, the dark A-frame tent and the
 * cookfire's ring of stones; and its colliders (the wagon body, the horse, the tent, the crate pair).
 */
export function buildCaravanFrame(groundAt: Ground): { root: Group; colliders: ColliderDesc[]; anchors: CaravanAnchors } {
  const root = new Group(), colliders: ColliderDesc[] = [], y = groundAt(CARAVAN.x, CARAVAN.z);
  root.position.set(CARAVAN.x, y, CARAVAN.z); root.rotation.y = CARAVAN.yaw;
  // The barrel (loop 4: it was a plain near-black cylinder): sun-bleached staves, a bulge, two iron hoops.
  const barrel = new Group(); barrel.rotation.set(0, 0.6, Math.PI / 2); barrel.position.set(-2.4, 0.25, 2.3); root.add(barrel);
  const staves = mat(BARREL, { emissive: CRATE_GLOW }); staves.userData['warm'] = true; // the lantern and the cookfire light it
  barrel.add(new Mesh(new CylinderGeometry(0.31, 0.31, 0.9, 12, 3), staves));
  barrel.add(new Mesh(new CylinderGeometry(0.345, 0.345, 0.5, 12, 1, true), staves));
  for (const yy of [-0.32, 0.32]) { const hoop = new Mesh(new TorusGeometry(0.33, 0.025, 4, 14), mat(IRON, { metalness: 0.4 })); hoop.rotation.x = Math.PI / 2; hoop.position.y = yy; barrel.add(hoop); }
  // The logbook: on the tailboard, the wagon's back (−Z).
  const logbook = box(0.32, 0.07, 0.42, mat(LEATHER)); logbook.rotation.y = 0.3; at(logbook, 0.35, 1.12, -2.55, root);
  // The lantern's iron (loop 4, mockup B): the hook rod up to the hoop, a cap and a base, four bars round the glass.
  const lamp = new Group(); lamp.position.set(LANTERN.x, LANTERN.y, LANTERN.z); root.add(lamp);
  const iron = mat(IRON, { metalness: 0.4 });
  at(box(0.025, 0.55, 0.025, iron), -0.22, 0.45, 0, lamp);
  at(box(0.2, 0.04, 0.2, iron), -0.22, 0.18, 0, lamp); at(box(0.2, 0.04, 0.2, iron), -0.22, -0.16, 0, lamp);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) at(box(0.02, 0.32, 0.02, iron), -0.22 + dx * 0.09, 0.01, dz * 0.09, lamp);
  // The tent (E399, mockup B): an A-frame of dark canvas on two poles, its ridge along the wagon.
  const tent = new Group(), canvasDark = mat(TENT_CANVAS, { side: DoubleSide }), dark = mat(WOOD_DARK), slope = Math.atan2(TENT.h, TENT.w / 2), side = Math.hypot(TENT.h, TENT.w / 2);
  tent.position.set(TENT.x, 0, TENT.z); tent.rotation.y = TENT.yaw; root.add(tent);
  for (const k of [-1, 1]) { const panel = box(0.04, side, TENT.d, canvasDark); panel.rotation.z = k * (Math.PI / 2 - slope); at(panel, k * TENT.w / 4, TENT.h / 2, 0, tent); }
  for (const k of [-1, 1]) at(box(0.07, TENT.h + 0.2, 0.07, dark), 0, TENT.h / 2, k * (TENT.d / 2 + 0.05), tent);
  // E399 (mockup B): the smouldering cookfire's ring of stones on the lee side (its fire is the client's)
  const cook = new Group(); cook.position.set(COOK.x, 0.15, COOK.z); root.add(cook);
  for (let i = 0; i < 6; i++) { const st = box(0.16, 0.12, 0.14, mat(STONE)); const a = (i / 6) * Math.PI * 2; st.position.set(Math.cos(a) * 0.38, -0.08, Math.sin(a) * 0.38); st.rotation.y = a; cook.add(st); }
  // Colliders (world space): the wagon body, the horse, the tent and the crate pair (the stacked crate rides on the pair's).
  const world = (x: number, z: number): Vector3 => new Vector3(x, 0, z).applyAxisAngle(up, CARAVAN.yaw).add(root.position);
  const body = world(0, 0);
  colliders.push(boxDesc({ x: body.x, z: body.z, hw: 1.1, hd: 2.3, rot: -CARAVAN.yaw, yBottom: y - 1, yTop: y + 1.9 }, 'wood'));
  const horse = world(HORSE.x, HORSE.z); colliders.push(boxDesc({ x: horse.x, z: horse.z, hw: 0.35, hd: 1.1, rot: -CARAVAN.yaw, yBottom: y - 0.3, yTop: y + HORSE.h }, 'flesh'));
  const tentAt = world(TENT.x, TENT.z); colliders.push(boxDesc({ x: tentAt.x, z: tentAt.z, hw: TENT.w / 2, hd: TENT.d / 2, rot: -(CARAVAN.yaw + TENT.yaw), yBottom: y - 0.5, yTop: y + TENT.h }, 'felt'));
  const crates = world(CRATES.x, CRATES.z); colliders.push(boxDesc({ x: crates.x, z: crates.z, hw: CRATES.half, hd: CRATES.half, rot: -CARAVAN.yaw, yBottom: y - 0.5, yTop: y + 0.84 + 0.52 }, 'wood'));
  const v = (local: Vector3): [number, number, number] => { const w = local.applyAxisAngle(up, CARAVAN.yaw).add(root.position); return [w.x, w.y, w.z]; };
  return { root, colliders, anchors: { y, logbook: v(new Vector3(0.35, 1.12, -2.55)), lamp: v(new Vector3(LANTERN.x, LANTERN.y, LANTERN.z)) } };
}

/**
 * The dry well's code-built parts round the generated well (its ring, posts and windlass): the marker pole and its
 * pennant; and its colliders (the ring's 12 dressed stones, the two posts, the pole). Anchors: its ground height.
 */
export function buildWellFrame(groundAt: Ground): { root: Group; colliders: ColliderDesc[]; anchors: { y: number } } {
  const root = new Group(), colliders: ColliderDesc[] = [], y = groundAt(WELL.x, WELL.z), R = WELL_RIG.r, n = 12;
  root.position.set(WELL.x, y, WELL.z);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    colliders.push(boxDesc({ x: WELL.x + Math.sin(a) * R, z: WELL.z + Math.cos(a) * R, hw: 0.38, hd: 0.24, rot: -a, yBottom: y - 0.5, yTop: y + 0.78 }, 'stone'));
  }
  for (const side of [-1, 1]) colliders.push(boxDesc({ x: WELL.x + side * (R + 0.15), z: WELL.z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y, yTop: y + 2.3 }, 'wood'));
  markerPole(root, -2.6, 1.4, groundAt(WELL.x - 2.6, WELL.z + 1.4) - y, MARK.h, WELL.x - 2.6, WELL.z + 1.4, groundAt(WELL.x - 2.6, WELL.z + 1.4), colliders);
  return { root, colliders, anchors: { y } };
}

/**
 * A waymark under its generated brazier: the brazier stands on the sand (its lowest corner, so it never floats on a
 * slope), its colliders a footing slab and the bowl's column. Nothing of it is code-drawn.
 */
export function waymarkFrame(x: number, z: number, groundAt: Ground): { y: number; colliders: ColliderDesc[] } {
  const y = Math.min(groundAt(x, z), groundAt(x + 0.5, z + 0.5), groundAt(x - 0.5, z - 0.5), groundAt(x + 0.5, z - 0.5), groundAt(x - 0.5, z + 0.5));
  return { y, colliders: [
    boxDesc({ x, z, hw: 0.85, hd: 0.85, rot: -0.12, yBottom: y - 0.3, yTop: y }, 'stone'),
    boxDesc({ x, z, hw: 0.45, hd: 0.45, rot: 0, yBottom: y, yTop: y + 1.75 }, 'stone'),
  ] };
}

/** The caravan baked on the manifest's own dune field: its kinds, colliders and live-part anchors. */
export function bakeSignalCaravan(): PieceBake & { anchors: CaravanAnchors } {
  const field = signalDunesField(), frame = buildCaravanFrame(field.heightAt);
  return { ...bakeKinds('caravan', foldKinds(frame.root), frame.colliders), anchors: frame.anchors };
}
/** The well baked on the manifest's own dune field. */
export function bakeSignalWell(): PieceBake & { anchors: { y: number } } {
  const field = signalDunesField(), frame = buildWellFrame(field.heightAt);
  return { ...bakeKinds('well', foldKinds(frame.root), frame.colliders), anchors: frame.anchors };
}
/** The three waymarks' footings and colliders (no GLB: nothing of them is code-drawn). */
export function bakeSignalBraziers(): { braziers: { y: number; colliders: ColliderDesc[] }[] } {
  const field = signalDunesField();
  return { braziers: BRAZIERS.map((b) => { const w = waymarkFrame(b.x, b.z, field.heightAt); return { y: w.y, colliders: colliderRows(w.colliders) }; }) };
}

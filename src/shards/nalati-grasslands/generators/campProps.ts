/**
 * The camps' props, painted (generators only; SHARD-PLATFORM M3, the places bake): the painters that used to run on the
 * page (moved verbatim from models/campProps.ts, whose header describes every prop). generators/places.ts paints the
 * camps and the props' Explorer specimens with them; the page draws the bake (world/placeBake.ts).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelDef } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { M, v3, logPainter, woodPole } from '../world/paint';
import { pole, lathe, blob } from '@wildshard/engine/world/geometryKit';
import { PC, GRAIN, WOOD, rugGeometry, rugPainter } from '../world/props';
import { painted, type Kit, type Paint } from '../world/painted';
import {
  EAGLE_PERCH_H, ribbonPole, eaglePerch, stove, campBench, rugRack, feltRug, cart, barrel, hitchingRail, waterTrough, saddleRack, corral, hayPile,
  feedTrough, rugLine, choppingBlock, milkCans, tetherLine, kurtBoard, ribbonPost,
  type BarrelParams, type CorralParams, type HitchingRailParams, type PalsParams, type RugLineParams, type RugParams, type SpanParams,
} from '../models/campProps';
import type { Box } from '../world/solid';

type Ground = (x: number, z: number) => number;

/** a rug lying flat on the ground (long axis along yaw) */
function addGroundRug(kit: Kit, ground: Ground, x: number, z: number, yaw: number, w: number, h: number, pal: number): void {
  let y = -Infinity;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]] as const) y = Math.max(y, ground(x + dx * w * 0.5, z + dz * h * 0.5));
  const g = rugGeometry(w, h);
  kit.add(g, rugPainter(w, h, pal), { matrix: M(x, y + 0.02, z, yaw, 1, 1, 1, -Math.PI / 2), brush: 0.05, jitter: 0.02 });
}

/** an A-frame drying rack with rugs thrown over the bar (bar along local x, rack width 3.4 m) */
function addRugRack(kit: Kit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[], pals: number[]): void {
  const y = ground(x, z), cs = Math.cos(yaw), sn = Math.sin(yaw);
  const W = 3.6, H = 1.9;
  const at = (lx: number, ly: number, lz: number) => v3(x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs);
  for (const sx of [-1, 1]) {
    kit.add(woodPole(at(sx * W / 2, -0.2, -0.55), at(sx * W / 2, H + 0.1, 0), 0.05, 0.045, 7, 3), GRAIN, { ...WOOD, brush: 0.14 });
    kit.add(woodPole(at(sx * W / 2, -0.2, 0.55), at(sx * W / 2, H + 0.1, 0), 0.05, 0.045, 7, 3), GRAIN, { ...WOOD, brush: 0.14 });
  }
  kit.add(woodPole(at(-W / 2 - 0.2, H, 0), at(W / 2 + 0.2, H, 0), 0.045, 0.045, 7, 3), GRAIN, { ...WOOD, brush: 0.14 });
  // rugs over the bar: a long drop on the front, a short one behind, each leaning off the bar a little
  pals.forEach((pal, i) => {
    const rw = 1.05, n = pals.length, cx = -W / 2 + (W / n) * (i + 0.5) + kit.rng.range(-0.05, 0.05);
    for (const side of [-1, 1]) {
      const drop = side < 0 ? 1.45 : 1.0;
      const c = at(cx, H - drop / 2 - 0.03, side * 0.07);
      kit.add(rugGeometry(rw, drop), rugPainter(rw, drop, pal + (side < 0 ? 0 : 1)), { matrix: M(c.x, c.y, c.z, yaw, 1, 1, 1, side * 0.1), brush: 0.04, jitter: 0.02 });
    }
  });
  colliders.push({ x, z, hw: W / 2 + 0.2, hd: 0.6, rot: -yaw, yBottom: y - 1, yTop: y + H });
}

/** a coopered barrel (1 m) */
function addBarrel(kit: Kit, ground: Ground, x: number, z: number, colliders: Collider[], s = 1): void {
  const y = ground(x, z) - 0.03;
  kit.add(lathe([[0.001, 0], [0.27, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.27, 0.9], [0.24, 0.9], [0.001, 0.88]], 14), PC.wood, { matrix: M(x, y, z, 0, s) });
  for (const hy of [0.14, 0.76]) kit.add(new THREE.TorusGeometry(0.3, 0.018, 4, 16).rotateX(Math.PI / 2).translate(0, hy, 0), PC.iron, { matrix: M(x, y, z, 0, s) });
  colliders.push({ x, z, hw: 0.3 * s, hd: 0.3 * s, rot: 0, yBottom: y - 1, yTop: y + 0.9 * s });
}

/**
 * the camp stove: an iron box stove on legs with a pipe and a kettle; returns the pipe's mouth. Painted iron, not a flat
 * black box (E302, NALATI-FINISH B9): warm rust-brown plates with heat-worn lighter edges and rust strokes, riveted
 * seams, a glowing firebox door, the pipe in jointed lengths (pale collars) sooted toward the cap.
 */
function addStove(kit: Kit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): THREE.Vector3 {
  const y = ground(x, z), m = M(x, y, z, yaw);
  const iron = new THREE.Color('#4d3b30'), rust = new THREE.Color('#86502d'), worn = new THREE.Color('#8d7a66'), soot = new THREE.Color('#2a2521');
  // painted per row, never per triangle (a per-face hash split every quad into a harlequin): the hot plate worn pale,
  // a heat-worn band under the lip, rust creeping up from the foot; the brush noise does the rest
  const plate = (p: THREE.Vector3, n: THREE.Vector3): THREE.Color => {
    if (n.y > 0.5) return iron.clone().lerp(worn, 0.5);
    if (p.y > 0.66) return iron.clone().lerp(worn, 0.22);
    if (p.y < 0.34) return iron.clone().lerp(rust, 0.45);
    return Math.abs(n.x) > 0.5 ? iron.clone().lerp(rust, 0.18) : iron;
  };
  kit.add(new THREE.BoxGeometry(0.75, 0.48, 0.5, 1, 3, 1).translate(0, 0.5, 0), plate, { matrix: m, flat: true, brush: 0.16 });
  for (const [lx, lz] of [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]] as const) kit.add(new THREE.CylinderGeometry(0.03, 0.022, 0.28, 6).translate(lx, 0.14, lz), iron, { matrix: m, foot: 0.7 });
  // the trim as ONE part (the kit's rng is drawn once per part, so the camp keeps its old part count and every later
  // placement stays put): a lip round the top plate, riveted seams, the firebox door frame and the glow through its grate
  const trimParts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.8, 0.035, 0.55).translate(0, 0.745, 0).toNonIndexed(), new THREE.BoxGeometry(0.32, 0.24, 0.02).translate(-0.12, 0.48, -0.258).toNonIndexed(),
    new THREE.BoxGeometry(0.26, 0.17, 0.02, 6, 1, 1).translate(-0.12, 0.48, -0.266).toNonIndexed()];
  for (const sx of [-0.34, 0.34]) for (const sy of [0.33, 0.5, 0.67]) trimParts.push(new THREE.SphereGeometry(0.012, 5, 3).translate(sx, sy, -0.255).toNonIndexed());
  for (const g of trimParts) g.deleteAttribute('uv');
  const trim = mergeGeometries(trimParts, false);
  for (const g of trimParts) g.dispose();
  const frame = worn.clone().lerp(iron, 0.5);
  kit.add(trim, (p) => (p.z < -0.262 && Math.abs(p.x + 0.12) < 0.13 && Math.abs(p.y - 0.48) < 0.085 ? (Math.round((p.x + 0.12) * 46) % 2 === 0 ? '#ffb24a' : '#e2561c') : p.y > 0.72 ? worn.clone().lerp(iron, 0.4) : frame), { matrix: m, flat: true, brush: 0.05 });
  // the pipe: jointed lengths, sooted toward the cap
  kit.add(new THREE.CylinderGeometry(0.075, 0.075, 1.7, 10, 8).translate(0.24, 1.58, 0.1), (p) => {
    const t = (p.y - 0.73) / 1.7, joint = Math.abs(((t * 3) % 1) - 0.5) > 0.44;
    return joint ? worn : iron.clone().lerp(rust, 0.15).lerp(soot, Math.max(0, t - 0.55) * 1.6);
  }, { matrix: m, brush: 0.12 });
  kit.add(new THREE.CylinderGeometry(0.13, 0.08, 0.08, 10).translate(0.24, 2.46, 0.1), soot, { matrix: m });
  // kettle
  kit.add(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 0.8, 1).translate(-0.12, 0.84, 0.02), new THREE.Color('#9a6a2a'), { matrix: m, brush: 0.1 });
  kit.add(pole(v3(-0.02, 0.86, 0.02), v3(0.09, 0.95, 0.02), 0.022, 0.012, 5), new THREE.Color('#9a6a2a'), { matrix: m });
  colliders.push({ x, z, hw: 0.42, hd: 0.3, rot: -yaw, yBottom: y - 1, yTop: y + 0.8 });
  return v3(0.24, 2.55, 0.1).applyMatrix4(m);
}

/** a two-wheeled cart (arba), shafts resting on the ground */
function addCart(kit: Kit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z), m = M(x, y, z, yaw), wr = 0.72;
  for (const sx of [-1, 1]) {
    const wm = M(0, 0, 0);
    kit.add(new THREE.TorusGeometry(wr, 0.055, 5, 18).rotateY(Math.PI / 2).translate(sx * 0.82, wr, 0).applyMatrix4(wm), PC.woodDark, { matrix: m });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      kit.add(pole(v3(sx * 0.82, wr - Math.cos(a) * wr, -Math.sin(a) * wr), v3(sx * 0.82, wr + Math.cos(a) * wr, Math.sin(a) * wr), 0.025, 0.025, 4), PC.wood, { matrix: m });
    }
    kit.add(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8).rotateZ(Math.PI / 2).translate(sx * 0.82, wr, 0), PC.woodDark, { matrix: m });
  }
  kit.add(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6).rotateZ(Math.PI / 2).translate(0, wr, 0), PC.woodDark, { matrix: m });
  // bed (tilted forward: the shafts rest on the ground ahead)
  const bed = M(0, wr + 0.12, 0.2, 0, 1, 1, 1, -0.2);
  const bm = m.clone().multiply(bed);
  kit.add(new THREE.BoxGeometry(1.4, 0.08, 2.2), PC.woodLight, { matrix: bm, flat: true });
  for (const sx of [-1, 1]) kit.add(new THREE.BoxGeometry(0.06, 0.35, 2.2).translate(sx * 0.7, 0.2, 0), PC.wood, { matrix: bm, flat: true });
  kit.add(new THREE.BoxGeometry(1.4, 0.35, 0.06).translate(0, 0.2, 1.1), PC.wood, { matrix: bm, flat: true });
  for (const sx of [-1, 1]) kit.add(pole(v3(sx * 0.55, 0.0, -1.0), v3(sx * 0.5, -0.55, -3.0), 0.05, 0.04, 6), PC.wood, { matrix: bm });
  // a load of hay
  kit.add(new THREE.SphereGeometry(0.75, 12, 8).scale(0.95, 0.45, 1.3).translate(0, 0.25, 0.1), PC.hay, { matrix: bm });
  colliders.push({ x, z, hw: 1.0, hd: 1.3, rot: -yaw, yBottom: y - 1, yTop: y + 1.6 });
}

/** a saddle rack: a trestle with a saddle (red felt saddle cloth, dark leather, wooden high cantle) */
function addSaddleRack(kit: Kit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z), m = M(x, y, z, yaw);
  for (const sx of [-0.45, 0.45]) {
    kit.add(woodPole(v3(sx, 0, -0.3), v3(sx, 0.95, 0), 0.04, 0.035, 6, 2), GRAIN, { ...WOOD, matrix: m, brush: 0.14 });
    kit.add(woodPole(v3(sx, 0, 0.3), v3(sx, 0.95, 0), 0.04, 0.035, 6, 2), GRAIN, { ...WOOD, matrix: m, brush: 0.14 });
  }
  kit.add(woodPole(v3(-0.6, 0.95, 0), v3(0.6, 0.95, 0), 0.05, 0.05, 7, 3), GRAIN, { ...WOOD, matrix: m, brush: 0.14 });
  kit.add(new THREE.BoxGeometry(0.9, 0.03, 0.8).translate(0, 0.98, 0), PC.red, { matrix: m, flat: true });
  kit.add(new THREE.BoxGeometry(0.92, 0.035, 0.1).translate(0, 0.985, -0.41), PC.gold, { matrix: m, flat: true });
  kit.add(new THREE.BoxGeometry(0.92, 0.035, 0.1).translate(0, 0.985, 0.41), PC.gold, { matrix: m, flat: true });
  kit.add(new THREE.SphereGeometry(0.3, 12, 8).scale(1.3, 0.45, 0.9).translate(0, 1.04, 0), PC.leather, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.08, 0.26, 0.36).translate(0.34, 1.16, 0), PC.woodDark, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.08, 0.2, 0.3).translate(-0.34, 1.13, 0), PC.woodDark, { matrix: m });
  colliders.push({ x, z, hw: 0.65, hd: 0.35, rot: -yaw, yBottom: y - 1, yTop: y + 1.1 });
}

/**
 * A carved hitching post: a turned larch post (rings and beads), a band of red and gold paint below a carved horse-head
 * finial, set in the ground at (x, z). Returns the rail height.
 */
function addCarvedPost(kit: Kit, ground: Ground, x: number, z: number, h: number, yaw: number): number {
  const y = ground(x, z);
  const m = M(x, y, z, yaw);
  const prof: [number, number][] = [[0.13, -0.4], [0.13, 0.0], [0.12, 0.15], [0.11, h * 0.55], [0.13, h * 0.57], [0.1, h * 0.6], [0.105, h * 0.85], [0.135, h * 0.87], [0.1, h * 0.9], [0.09, h + 0.05], [0.12, h + 0.08], [0.06, h + 0.14]];
  kit.add(lathe(prof, 12), (p) => {
    if (p.y > h * 0.86 && p.y < h * 0.92) return PC.red;
    if (p.y > h * 0.92 && p.y < h + 0.06) return PC.gold;
    if (p.y > h * 0.55 && p.y < h * 0.6) return PC.redDark;
    return PC.wood;
  }, { matrix: m, foot: 0.75, brush: 0.08 });
  // the horse-head finial: a stylised head and arched neck, carved and painted
  const hm = m.clone().multiply(M(0, h + 0.14, 0));
  kit.add(new THREE.CapsuleGeometry(0.055, 0.14, 3, 8).rotateX(-0.35).translate(0, 0.1, 0.02), PC.wood, { matrix: hm });
  kit.add(new THREE.CapsuleGeometry(0.045, 0.12, 3, 8).rotateX(-1.25).translate(0, 0.2, -0.09), PC.woodLight, { matrix: hm });
  for (const sx of [-1, 1]) {
    kit.add(new THREE.ConeGeometry(0.018, 0.06, 5).translate(sx * 0.025, 0.28, -0.02), PC.woodDark, { matrix: hm });
    kit.add(new THREE.SphereGeometry(0.012, 6, 4).translate(sx * 0.04, 0.23, -0.1), PC.woodDark, { matrix: hm });
  }
  kit.add(new THREE.BoxGeometry(0.02, 0.1, 0.08).translate(0, 0.16, 0.06), PC.redDark, { matrix: hm, flat: true });   // the carved mane
  return y + h;
}

/** a rope line between two forked posts with felt rugs thrown over it (from a to b) */
function addRugLine(kit: Kit, ground: Ground, ax: number, az: number, bx: number, bz: number, pals: number[], colliders: Collider[]): void {
  const H = 1.75, ya = ground(ax, az), yb = ground(bx, bz);
  for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]] as const) {
    kit.add(woodPole(v3(x, y - 0.35, z), v3(x, y + H + 0.1, z), 0.06, 0.05, 7, 3), GRAIN, { ...WOOD, foot: 0.75, brush: 0.14 });
    kit.add(woodPole(v3(x, y + H - 0.05, z), v3(x + 0.14, y + H + 0.25, z), 0.025, 0.02, 5, 2), GRAIN, { ...WOOD, brush: 0.14 });
    kit.add(woodPole(v3(x, y + H - 0.05, z), v3(x - 0.14, y + H + 0.25, z), 0.025, 0.02, 5, 2), GRAIN, { ...WOOD, brush: 0.14 });
    colliders.push({ x, z, hw: 0.12, hd: 0.12, rot: 0, yBottom: y - 1, yTop: y + H });
  }
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
  const sagAt = (t: number) => Math.sin(Math.PI * t) * 0.18;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    kit.add(pole(v3(ax + (bx - ax) * t0, ya + (yb - ya) * t0 + H - sagAt(t0), az + (bz - az) * t0), v3(ax + (bx - ax) * t1, ya + (yb - ya) * t1 + H - sagAt(t1), az + (bz - az) * t1), 0.012, 0.012, 3), PC.leather);
  }
  pals.forEach((pal, i) => {
    const t = (i + 0.5) / pals.length, rw = Math.min(1.3, (len / pals.length) * 0.85);
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t + H - sagAt(t);
    for (const side of [-1, 1]) {
      const drop = side < 0 ? 1.25 : 0.9;
      kit.add(rugGeometry(rw, drop), rugPainter(rw, drop, pal + (side < 0 ? 0 : 2)), { matrix: M(x - Math.sin(yaw + Math.PI / 2) * side * 0.04, y - drop / 2 - 0.02, z - Math.cos(yaw + Math.PI / 2) * side * 0.04, yaw, 1, 1, 1, side * 0.08), brush: 0.04, jitter: 0.02 });
    }
  });
  colliders.push({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: len / 2, hd: 0.25, rot: -yaw, yBottom: Math.min(ya, yb) + 0.4, yTop: Math.max(ya, yb) + H });
}

/** a chopping block with an axe in it and a scatter of split wood */
function addChoppingBlock(kit: Kit, ground: Ground, x: number, z: number, colliders: Collider[]): void {
  const y = ground(x, z), rng = kit.rng;
  const a = v3(x, y - 0.1, z), b = v3(x, y + 0.5, z);
  kit.add(pole(a, b, 0.3, 0.28, 12), logPainter(a, b, PC.woodDark, '#c9a878'), { foot: 0.75 });
  kit.add(new THREE.BoxGeometry(0.05, 0.62, 0.05).rotateZ(0.55).translate(x + 0.2, y + 0.72, z), PC.woodLight);
  kit.add(new THREE.BoxGeometry(0.16, 0.12, 0.03).rotateZ(0.55).translate(x + 0.02, y + 0.52, z), PC.iron, { flat: true });
  for (let i = 0; i < 7; i++) {
    const ang = rng.range(0, Math.PI * 2), d = rng.range(0.5, 1.2), px = x + Math.cos(ang) * d, pz = z + Math.sin(ang) * d, py = ground(px, pz) + 0.06;
    const r = rng.range(0, Math.PI);
    kit.add(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 5, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(r).translate(px, py, pz), rng.next() < 0.5 ? PC.woodLight : PC.wood, { flat: true, jitter: 0.1 });
  }
  colliders.push({ x, z, hw: 0.3, hd: 0.3, rot: 0, yBottom: y - 1, yTop: y + 0.5 });
}

/** a cluster of milk churns and a wooden bucket */
function addMilkCans(kit: Kit, ground: Ground, x: number, z: number, colliders: Collider[]): void {
  const rng = kit.rng;
  for (const [dx, dz, s] of [[0, 0, 1], [0.48, 0.15, 0.85], [0.2, -0.45, 0.95]] as const) {
    const px = x + dx, pz = z + dz, py = ground(px, pz);
    kit.add(lathe([[0.001, 0], [0.19, 0], [0.2, 0.32], [0.16, 0.44], [0.09, 0.5], [0.1, 0.58], [0.001, 0.58]], 12), (p) => (p.y > 0.3 && p.y < 0.34 ? PC.iron : new THREE.Color('#aeb0ae')), { matrix: M(px, py, pz, rng.range(0, 6), s), brush: 0.06 });
  }
  const bx = x - 0.5, bz = z + 0.35, by = ground(bx, bz);
  kit.add(lathe([[0.001, 0], [0.17, 0], [0.2, 0.3], [0.19, 0.3], [0.15, 0.03], [0.001, 0.03]], 12), (p) => (Math.abs(p.y - 0.08) < 0.02 || Math.abs(p.y - 0.24) < 0.02 ? PC.iron : PC.wood), { matrix: M(bx, by, bz), brush: 0.06 });
  colliders.push({ x: x + 0.2, z, hw: 0.55, hd: 0.5, rot: 0, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.6 });
}

// ── the camp builders' blocks (NomadCamp / SummerCamp), verbatim at their placement ─────────────────────────────────

/** khadag / camp ribbon colours of the yard's ribbon pole */
const RIBBONS = ['#c8321e', '#2f5fae', '#e8b632', '#3f8f4a', '#f4efe4', '#e0772c', '#7a3f8c'];

/** the yard's ribbon pole: a striped pole, a trident finial, a ring of stones, seven streamers */
const ribbonPolePaint: Paint<object> = (kit, at, _p, c) => {
  const rng = kit.rng;
  const x = at.x, z = at.z, y = c.ground(x, z), H = 6.6;
  kit.add(new THREE.CylinderGeometry(0.075, 0.1, H, 10, 12).translate(0, H / 2, 0), (p) => (Math.floor((p.y * 3 + Math.atan2(p.x, p.z) / Math.PI) % 2) === 0 ? PC.red : PC.cream), { matrix: M(x, y - 0.2, z) });
  kit.add(new THREE.SphereGeometry(0.12, 10, 8).translate(0, H - 0.15, 0), PC.gold, { matrix: M(x, y - 0.2, z) });
  for (const sx of [-1, 0, 1]) {
    kit.add(new THREE.ConeGeometry(0.045, 0.5, 6).translate(sx * 0.16, H + 0.25 + (sx === 0 ? 0.12 : 0), 0), PC.gold, { matrix: M(x, y - 0.2, z) });
  }
  kit.add(new THREE.BoxGeometry(0.4, 0.05, 0.05).translate(0, H + 0.02, 0), PC.gold, { matrix: M(x, y - 0.2, z) });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; kit.add(blob(0.2, rng, 1, 0.6), PC.stone, { matrix: M(x + Math.cos(a) * 0.55, y, z + Math.sin(a) * 0.55, a) }); }
  RIBBONS.forEach((col, i) => {
    const a = (i / RIBBONS.length) * Math.PI * 2;
    c.flutter.streamer(v3(x + Math.cos(a) * 0.08, y - 0.2 + H - 0.25 - i * 0.06, z + Math.sin(a) * 0.08), rng.range(2.4, 3.6), 0.13, col, { droop: 0.5, taper: 0.3 });
  });
  return { boxes: [{ x, z, hw: 0.7, hd: 0.7, rot: 0, yBottom: y - 1, yTop: y + H }] };
};


/** the eagle's perch: a lashed tripod with a T-bar, a leather wrap where the eagle stands, its jesses to the bar end
 *  (the golden eagle on it is the generated `perchedEagle`, placed by the camp) */
const eaglePerchPaint: Paint<object> = (kit, at, _p, c) => {
  const x = at.x, z = at.z, y = c.ground(x, z), H = EAGLE_PERCH_H;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    kit.add(woodPole(v3(x + Math.cos(a) * 0.95, y - 0.2, z + Math.sin(a) * 0.95), v3(x - Math.cos(a) * 0.1, y + H + 0.1, z - Math.sin(a) * 0.1), 0.055, 0.04, 7, 3), GRAIN, { ...WOOD, brush: 0.14 });
  }
  kit.add(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8).translate(x, y + H - 0.25, z), PC.leather);          // lashing
  kit.add(pole(v3(x - 0.5, y + H + 0.08, z), v3(x + 0.5, y + H + 0.08, z), 0.045, 0.045, 7), PC.wood);             // T-bar
  kit.add(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2).translate(x + 0.05, y + H + 0.08, z), PC.red); // leather wrap
  // jesses: a cord from the leg to the bar end
  kit.add(pole(v3(x + 0.1, y + H + 0.14, z), v3(x + 0.48, y + H + 0.02, z), 0.01, 0.01, 3), PC.leather);
  kit.add(pole(v3(x + 0.48, y + H + 0.08, z), v3(x + 0.52, y + H - 0.6, z + 0.02), 0.01, 0.01, 3), PC.leather);
  return { boxes: [{ x, z, hw: 0.9, hd: 0.9, rot: 0, yBottom: y - 1, yTop: y + H + 0.5 }] };
};

/** the iron stove, smoking */
const stovePaint: Paint<object> = (kit, at, _p, c) => {
  const boxes: Box[] = [];
  c.smoke.emitter(addStove(kit, c.ground, at.x, at.z, at.yaw, boxes), { puffs: 36, rise: 6.5, size: [0.55, 3.8], life: 8 });
  return { boxes };
};

/** a low wooden bench (by the kazan) */
const benchPaint: Paint<object> = (kit, at, _p, c) => {
  const x = at.x, z = at.z, y = c.ground(x, z), m = M(x, y, z, at.yaw);
  kit.add(new THREE.BoxGeometry(1.8, 0.07, 0.36).translate(0, 0.42, 0), PC.woodLight, { matrix: m, flat: true });
  for (const bx of [-0.75, 0.75]) kit.add(new THREE.BoxGeometry(0.08, 0.42, 0.3).translate(bx, 0.21, 0), PC.wood, { matrix: m, flat: true });
  return { boxes: [{ x, z, hw: 0.9, hd: 0.2, rot: -at.yaw, yBottom: y - 1, yTop: y + 0.46 }] };
};


/** the hitching rail: three carved posts, the rail, two tie rings with a rein hanging from each (it runs north–south,
 *  along z: its placement's yaw is not used) */
const hitchingRailPaint: Paint<HitchingRailParams> = (kit, at, p, c) => {
  const ground = c.ground;
  const x = at.x, z = at.z, L = p.length, H = p.height;
  for (const t of [-0.5, 0, 0.5]) addCarvedPost(kit, ground, x, z + t * L, H, Math.PI / 2);
  const y0 = ground(x, z - L / 2), y1 = ground(x, z + L / 2);
  kit.add(pole(v3(x, y0 + H, z - L / 2 - 0.25), v3(x, y1 + H, z + L / 2 + 0.25), 0.075, 0.07, 8), PC.woodLight);
  for (const t of [-0.3, 0.28]) {
    const pz = z + t * L, py = ground(x, pz) + H;
    kit.add(new THREE.TorusGeometry(0.09, 0.018, 4, 10).rotateY(Math.PI / 2).translate(x, py - 0.02, pz), PC.leather);
    kit.add(pole(v3(x - 0.02, py - 0.08, pz), v3(x - 0.12, py - 0.55, pz + 0.05), 0.012, 0.012, 3), PC.leather);
  }
  return { boxes: [{ x, z, hw: 0.15, hd: L / 2 + 0.3, rot: 0, yBottom: Math.min(y0, y1) - 1, yTop: Math.max(y0, y1) + H + 0.1 }] };
};

/** a water trough: a hollowed half-log on two chocks, runs along z */
const waterTroughPaint: Paint<object> = (kit, at, _p, c) => {
  const tx = at.x, tz = at.z, ty = c.ground(tx, tz);
  kit.add(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 12, 1, false, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.42, 0), PC.wood, { matrix: M(tx, ty, tz) });
  kit.add(new THREE.BoxGeometry(0.5, 0.02, 2.3).translate(0, 0.36, 0), new THREE.Color('#6f9fb8'), { matrix: M(tx, ty, tz), flat: true });
  for (const s of [-0.8, 0.8]) kit.add(new THREE.BoxGeometry(0.7, 0.2, 0.2).translate(0, 0.1, s), PC.wood, { matrix: M(tx, ty, tz), flat: true });
  return { boxes: [{ x: tx, z: tz, hw: 0.35, hd: 1.2, rot: 0, yBottom: ty - 1, yTop: ty + 0.45 }] };
};


/** the round pole corral: posts round a ring (the two by the gate taller), two rails, the gate gap facing −x (east), the
 *  gate panel swung open against the fence outside; a box per rail span */
const corralPaint: Paint<CorralParams> = (kit, at, p, c) => {
  const ground = c.ground, rng = kit.rng;
  const colliders: Box[] = [];
  const x = at.x, z = at.z, r = p.r;
  const n = p.posts, gate = Math.PI;                        // gate direction: −x
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    posts.push(v3(px, ground(px, pz), pz));
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, q0 = posts[i];
    if (!q0) continue;
    const da = Math.abs(((a - gate + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    const big = da < 0.3;
    kit.add(woodPole(v3(q0.x, q0.y - 0.4, q0.z), v3(q0.x + rng.range(-0.04, 0.04), q0.y + (big ? 1.75 : 1.45), q0.z + rng.range(-0.04, 0.04)), big ? 0.12 : 0.085, big ? 0.1 : 0.07, 7, 3), GRAIN, { ...WOOD, foot: 0.7, jitter: 0.1, brush: 0.14 });
    const q = posts[(i + 1) % n];
    const am = ((i + 0.5) / n) * Math.PI * 2;
    const dm = Math.abs(((am - gate + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    if (!q || dm < 0.2) continue;                     // the gate gap
    for (const ry of [0.62, 1.2]) kit.add(woodPole(v3(q0.x, q0.y + ry, q0.z), v3(q.x, q.y + ry - 0.03, q.z), 0.055, 0.055, 7, 4), GRAIN, { ...WOOD, jitter: 0.12, brush: 0.14 });
    const mx = (q0.x + q.x) / 2, mz = (q0.z + q.z) / 2, len = Math.hypot(q.x - q0.x, q.z - q0.z);
    const yaw = Math.atan2(q.x - q0.x, q.z - q0.z), gy = Math.min(q0.y, q.y);
    colliders.push({ x: mx, z: mz, hw: 0.1, hd: len / 2 + 0.05, rot: -yaw, yBottom: gy - 1, yTop: gy + 1.3 });
  }
  // the gate panel swung open against the fence outside
  {
    const gx = x + Math.cos(gate + 0.12) * r, gz = z + Math.sin(gate + 0.12) * r, gy = ground(gx, gz);
    const m = M(gx - 1.1, gy, gz + 0.9, 0.5);
    // split rails and posts (they were sharp flat boxes that read as untextured purple-grey — E302 B9)
    for (const ry of [0.4, 0.8, 1.2]) kit.add(woodPole(v3(0, ry, -1.1), v3(0, ry, 1.1), 0.045, 0.04, 6, 4), GRAIN, { ...WOOD, matrix: m, brush: 0.14 });
    for (const s of [-1.05, 1.05]) kit.add(woodPole(v3(0, 0, s), v3(0, 1.36, s), 0.055, 0.05, 7, 3), GRAIN, { ...WOOD, matrix: m, brush: 0.14, foot: 0.75 });
    kit.add(woodPole(v3(0, 0.38, -1.02), v3(0, 1.22, 1.02), 0.035, 0.035, 6, 4), GRAIN, { ...WOOD, matrix: m, brush: 0.14 });
  }
  return { boxes: colliders };
};

/** a hay pile (a squashed dome of hay; you sink into it: its box is grass underfoot) */
const hayPilePaint: Paint<object> = (kit, at, _p, c) => {
  const hx = at.x, hz = at.z, hy = c.ground(hx, hz);
  kit.add(new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1.3), PC.hay, { matrix: M(hx, hy - 0.05, hz, at.yaw), brush: 0.14 });
  return { boxes: [{ x: hx, z: hz, hw: 1.1, hd: 1.5, rot: -at.yaw, yBottom: hy - 1, yTop: hy + 0.7, surface: 'grass' }] };
};

/** a plank feed trough full of hay (walk-through: it's knee-high) */
const feedTroughPaint: Paint<object> = (kit, at, _p, c) => {
  const fx = at.x, fz = at.z, fy = c.ground(fx, fz);
  kit.add(new THREE.BoxGeometry(0.6, 0.35, 1.8).translate(0, 0.35, 0), PC.woodDark, { matrix: M(fx, fy, fz, at.yaw), flat: true });
  kit.add(new THREE.BoxGeometry(0.5, 0.05, 1.7).translate(0, 0.51, 0), PC.hay, { matrix: M(fx, fy, fz, at.yaw), flat: true });
  return {};
};


/** the summer camp's tether line: two posts, a sagging rope between them (the horses are tied here) */
const tetherLinePaint: Paint<SpanParams> = (kit, at, p, c) => {
  const ground = c.ground;
  const ax = at.x, az = at.z, bx = at.x + p.dx, bz = at.z + p.dz;
  const ay = ground(ax, az), by = ground(bx, bz);
  kit.add(woodPole(v3(ax, ay - 0.4, az), v3(ax, ay + 1.3, az), 0.09, 0.08, 7, 3), GRAIN, { ...WOOD, foot: 0.7, brush: 0.14 });
  kit.add(woodPole(v3(bx, by - 0.4, bz), v3(bx, by + 1.3, bz), 0.09, 0.08, 7, 3), GRAIN, { ...WOOD, foot: 0.7, brush: 0.14 });
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const q0 = v3(ax, ay + 1.2, az).lerp(v3(bx, by + 1.2, bz), t0); q0.y -= Math.sin(Math.PI * t0) * 0.25;
    const q1 = v3(ax, ay + 1.2, az).lerp(v3(bx, by + 1.2, bz), t1); q1.y -= Math.sin(Math.PI * t1) * 0.25;
    kit.add(pole(q0, q1, 0.02, 0.02, 4), PC.leather);
  }
  return { boxes: [{ x: ax, z: az, hw: 0.12, hd: 0.12, rot: 0, yBottom: ay - 1, yTop: ay + 1.3 }, { x: bx, z: bz, hw: 0.12, hd: 0.12, rot: 0, yBottom: by - 1, yTop: by + 1.3 }] };
};

/** a kurt drying board on trestles: rows of white curd balls */
const kurtBoardPaint: Paint<object> = (kit, at, _p, c) => {
  const x = at.x, z = at.z, y = c.ground(x, z), m = M(x, y, z, at.yaw);
  kit.add(new THREE.BoxGeometry(2.0, 0.05, 0.8).translate(0, 0.85, 0), PC.woodLight, { matrix: m, flat: true });
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.3, 0.3]) kit.add(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5).translate(sx, 0.42, sz), PC.woodGrey, { matrix: m });
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) kit.add(new THREE.SphereGeometry(0.055, 6, 5).translate(-0.8 + i * 0.2, 0.9, -0.25 + j * 0.25), new THREE.Color('#f3efe2'), { matrix: m, brush: 0.03 });
  return { boxes: [{ x, z, hw: 1.0, hd: 0.4, rot: -at.yaw, yBottom: y - 1, yTop: y + 0.95 }] };
};

/** a ribbon post by the summer hearth: a larch post, three streamers */
const ribbonPostPaint: Paint<object> = (kit, at, _p, c) => {
  const rng = kit.rng;
  const x = at.x, z = at.z, y = c.ground(x, z);
  kit.add(woodPole(v3(x, y - 0.3, z), v3(x, y + 3.6, z), 0.06, 0.045, 7, 3), GRAIN, { ...WOOD, brush: 0.14 });
  for (const [i, col] of ['#c8321e', '#f4efe4', '#2f5fae'].entries()) c.flutter.streamer(v3(x, y + 3.5 - i * 0.12, z), rng.range(1.6, 2.3), 0.1, col);
  return { boxes: [{ x, z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y - 1, yTop: y + 3.6 }] };
};

// ── the helpers' models ───────────────────────────────────────────────────────────────────────────────────────────

const feltRugPaint: Paint<RugParams> = (kit, at, p, c) => { addGroundRug(kit, c.ground, at.x, at.z, at.yaw, p.w, p.h, p.pal); return {}; };

const rugRackPaint: Paint<PalsParams> = (kit, at, p, c) => { const boxes: Box[] = []; addRugRack(kit, c.ground, at.x, at.z, at.yaw, boxes, [...p.pals]); return { boxes }; };

const barrelPaint: Paint<BarrelParams> = (kit, at, p, c) => { const boxes: Box[] = []; addBarrel(kit, c.ground, at.x, at.z, boxes, p.s); return { boxes }; };

const cartPaint: Paint<object> = (kit, at, _p, c) => { const boxes: Box[] = []; addCart(kit, c.ground, at.x, at.z, at.yaw, boxes); return { boxes }; };
const saddleRackPaint: Paint<object> = (kit, at, _p, c) => { const boxes: Box[] = []; addSaddleRack(kit, c.ground, at.x, at.z, at.yaw, boxes); return { boxes }; };

const rugLinePaint: Paint<RugLineParams> = (kit, at, p, c) => { const boxes: Box[] = []; addRugLine(kit, c.ground, at.x, at.z, at.x + p.dx, at.z + p.dz, [...p.pals], boxes); return { boxes }; };

const choppingBlockPaint: Paint<object> = (kit, at, _p, c) => { const boxes: Box[] = []; addChoppingBlock(kit, c.ground, at.x, at.z, boxes); return { boxes }; };
const milkCansPaint: Paint<object> = (kit, at, _p, c) => { const boxes: Box[] = []; addMilkCans(kit, c.ground, at.x, at.z, boxes); return { boxes }; };

// ── the models' painters (their defs: ../models/campProps.ts) ─────────────────────────────────────────────────────

const TIMBER = { layers: ['rock'] } as const;
/** a camp prop's def with its painter: what the places bake paints (generators/places.ts) */
const withPaint = <P extends object>(def: ModelDef<P>, paint: Paint<P>, spec: Parameters<typeof painted>[1]): ModelDef<P> => ({ ...def, build: painted(paint, spec) });

export const ribbonPolePainted = withPaint(ribbonPole, ribbonPolePaint, { seed: 0xa101 });

export const eaglePerchPainted = withPaint(eaglePerch, eaglePerchPaint, { seed: 0xa102, ...TIMBER });

export const stovePainted = withPaint(stove, stovePaint, { seed: 0xa103 });

export const campBenchPainted = withPaint(campBench, benchPaint, { seed: 0xa104 });

export const rugRackPainted = withPaint(rugRack, rugRackPaint, { seed: 0xa105, ...TIMBER });

export const feltRugPainted = withPaint(feltRug, feltRugPaint, { seed: 0xa106 });

export const cartPainted = withPaint(cart, cartPaint, { seed: 0xa107 });

export const barrelPainted = withPaint(barrel, barrelPaint, { seed: 0xa108 });

export const hitchingRailPainted = withPaint(hitchingRail, hitchingRailPaint, { seed: 0xa109 });

export const waterTroughPainted = withPaint(waterTrough, waterTroughPaint, { seed: 0xa10a });

export const saddleRackPainted = withPaint(saddleRack, saddleRackPaint, { seed: 0xa10b, ...TIMBER });

export const corralPainted = withPaint(corral, corralPaint, { seed: 0xa10c, ...TIMBER });

export const hayPilePainted = withPaint(hayPile, hayPilePaint, { seed: 0xa10d });

export const feedTroughPainted = withPaint(feedTrough, feedTroughPaint, { seed: 0xa10e });

export const rugLinePainted = withPaint(rugLine, rugLinePaint, { seed: 0xa10f, ...TIMBER });

export const choppingBlockPainted = withPaint(choppingBlock, choppingBlockPaint, { seed: 0xa110 });

export const milkCansPainted = withPaint(milkCans, milkCansPaint, { seed: 0xa111 });

export const tetherLinePainted = withPaint(tetherLine, tetherLinePaint, { seed: 0xa112, ...TIMBER });

export const kurtBoardPainted = withPaint(kurtBoard, kurtBoardPaint, { seed: 0xa113 });

export const ribbonPostPainted = withPaint(ribbonPost, ribbonPostPaint, { seed: 0xa114, ...TIMBER });

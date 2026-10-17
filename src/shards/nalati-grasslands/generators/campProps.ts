import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModelDef } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { M, v3, logPainter, woodPole, type PaintOpts } from '../world/paint';
import { pole, lathe, blob } from '@wildshard/engine/world/geometryKit';
import { PC, GRAIN, WOOD, rugGeometry, rugPainter } from '../world/props';
import { painted, type Kit, type Paint, boardSpots, type SignpostParams } from '../world/painted';
import { EAGLE_PERCH_H, ribbonPole, eaglePerch, stove, campBench, rugRack, feltRug, cart, barrel, hitchingRail, waterTrough, saddleRack, corral, hayPile, feedTrough, rugLine, choppingBlock, milkCans, tetherLine, kurtBoard, ribbonPost, type BarrelParams, type CorralParams, type HitchingRailParams, type PalsParams, type RugLineParams, type RugParams, type SpanParams, fallenLog, stump, ovoo, viewpointPole, skyGateway, campClutter, fence, graniteOutcrop, roundedBoulder, kokparGoal, kokparPost, stoneStep, signpostBaked as signpost } from '../models/campProps';
import { type Box, prism, supportHull } from '../world/solid';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { graniteBlock } from './granite';

/**
 * The camps' props, painted (generators only; SHARD-PLATFORM M3, the places bake): the painters that used to run on the
 * page (moved verbatim from models/campProps.ts, whose header describes every prop). generators/places.ts paints the
 * camps and the props' Explorer specimens with them; the page draws the bake (world/placeBake.ts).
 */

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

/**
 * The Nalati dressing's one-off props (E306 / E315 second pass; were blocks of src/shards/nalati-grasslands/world/dressing/statics.ts,
 * verbatim): fallen spruce logs and bleached driftwood, stumps, ovoo cairns (a stone heap with a lashed pole bundle and
 * khadag ribbons), lone ribbon poles at the viewpoints, the timber gateway where the sky road tops out, and the camps'
 * loose clutter (firewood tipis, dung-cake stacks, chopping blocks with rounds, pots and a bucket, sacks, folded felts,
 * a kumis churn). The sky road's guard fences are the split-rail fence (./fence.ts).
 *
 * Each copy is painted into a kit of its own (a prop's own AO bake) and merged into the dressing's region meshes
 * (src/shards/nalati-grasslands/world/dressing/statics.ts: placed `drawnInto` them); the camps' clutter is one kit, one mesh. A copy
 * draws from its builder's shared rng stream (`rng`, in the old order: so the dressing is bit-identical; the Explorer's
 * specimen draws from its own kit's). The ribbons are the dressing's cloth. Collides: a log as the capsule it draws, an
 * ovoo's heap as a stone prism, a stump / a pole / a gatepost / the bigger clutter as a box (wood).
 */

const DRESS_COLORS = {
  bark: new THREE.Color('#5c4430'), barkGrey: new THREE.Color('#6f6353'), wood: new THREE.Color('#c9a878'),
  drift: new THREE.Color('#b9b1a4'), driftDark: new THREE.Color('#8f877a'),
  moss: new THREE.Color('#62772f'), lichen: new THREE.Color('#bfb06a'),
  stone: new THREE.Color('#99938a'), stoneLight: new THREE.Color('#b5ae9f'), stoneDark: new THREE.Color('#79756e'),
  pole: new THREE.Color('#8f836f'), dung: new THREE.Color('#6e573b'), dungLight: new THREE.Color('#8c7250'),
  clay: new THREE.Color('#a45a3a'), iron: new THREE.Color('#3a3634'), sack: new THREE.Color('#c8b48b'), rope: new THREE.Color('#6a5438'),
  feltRed: new THREE.Color('#b1301d'), feltCream: new THREE.Color('#efe2c2'), feltBlue: new THREE.Color('#2f4f86'), feltOrange: new THREE.Color('#d8782c'),
};
/** khadag / prayer-ribbon colours: sky blue and white first, then the five */
const DRESS_RIBBONS = ['#6fb0e6', '#f3efe4', '#3f7fcf', '#f3efe4', '#d8402b', '#e8c23a', '#4f9a52', '#8cc2ea'];



/** a prop's params carry the stream its builder shared across props (absent: the kit's own, for the specimen) */
interface Streamed { readonly rng?: Rng }

const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), qLog = new THREE.Quaternion();

export interface LogParams extends Streamed {
  /** its ends, relative to the placement (normally the near end: 0, 0; see `logEnds`) */
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly r: number;
  /** bleached driftwood on a gravel bar (else a fallen spruce, mossed) */
  readonly drift: boolean;
}

/**
 * A log's ends relative to its placement: it stands at its near end — unless the far end would not come back exactly
 * (a + (b − a) ≠ b in floating point), then at the world origin, its ends as they are: drawn bit-identically either way.
 */
export function logEnds(ax: number, az: number, bx: number, bz: number): { at: { x: number; z: number }; ends: { ax: number; az: number; bx: number; bz: number } } {
  if (ax + (bx - ax) === bx && az + (bz - az) === bz) return { at: { x: ax, z: az }, ends: { ax: 0, az: 0, bx: bx - ax, bz: bz - az } };
  return { at: { x: 0, z: 0 }, ends: { ax, az, bx, bz } };
}

/** a fallen log between its two ends, lying on the ground, broken branch stubs (driftwood: one forked limb) */
const logPaint: Paint<LogParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const descs: ColliderDesc[] = [];
  const l = { ax: at.x + p.ax, az: at.z + p.az, bx: at.x + p.bx, bz: at.z + p.bz, r: p.r, drift: p.drift };
  const ya = ground(l.ax, l.az), yb = ground(l.bx, l.bz);
  const sink = l.drift ? 0.35 : 0.3;
  const a = v3(l.ax, ya + l.r * (1 - sink), l.az), b = v3(l.bx, yb + l.r * (1 - sink) * 0.85, l.bz);
  const bark = l.drift ? DRESS_COLORS.drift : rng.next() < 0.4 ? DRESS_COLORS.barkGrey : DRESS_COLORS.bark;
  kit.add(pole(a, b, l.r, l.r * 0.82, l.drift ? 6 : 9), logPainter(a, b, bark, l.drift ? DRESS_COLORS.driftDark : DRESS_COLORS.wood), { top: l.drift ? undefined : { color: DRESS_COLORS.moss, threshold: 0.72, amount: 0.55 }, brush: 0.12 });
  // P1: the log collides as the capsule it draws (it was a box to the ground)
  { const len = a.distanceTo(b); axis.subVectors(b, a).divideScalar(Math.max(1e-6, len)); qLog.setFromUnitVectors(up, axis);
    descs.push({ kind: 'capsule', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, halfHeight: Math.max(0.05, len / 2 - l.r), radius: l.r * 0.92, rot: { x: qLog.x, y: qLog.y, z: qLog.z, w: qLog.w }, surface: 'wood' }); }
  // broken branch stubs (driftwood: one forked limb)
  const n = l.drift ? 1 : rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const t = rng.range(0.2, 0.85), q = a.clone().lerp(b, t);
    const ang = rng.range(0, Math.PI * 2), len = l.drift ? rng.range(0.4, 0.9) : rng.range(0.25, 0.6);
    const dir = v3(Math.cos(ang), rng.range(0.1, 0.8), Math.sin(ang)).normalize();
    kit.add(pole(q, q.clone().addScaledVector(dir, len), l.r * 0.28, l.r * 0.12, 5), bark, { brush: 0.1 });
  }
  return { descs };
};

export interface StumpParams extends Streamed { readonly s: number }

/** a spruce stump with its roots spreading into the turf */
const stumpPaint: Paint<StumpParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng;
  const s = { x: at.x, z: at.z, s: p.s };
  const y = c.ground(s.x, s.z) - 0.08, r = s.s, h = rng.range(0.35, 0.8);
  const g = lathe([[0.001, 0], [r * 1.45, 0], [r * 1.2, 0.1], [r * 1.02, 0.28], [r, h - 0.04], [r * 0.96, h], [r * 0.5, h + rng.range(0, 0.04)], [0.001, h]], 11);
  kit.add(g, (q, n) => (n.y > 0.75 && q.y > h - 0.1 ? (Math.hypot(q.x, q.z) < r * 0.35 ? DRESS_COLORS.bark : DRESS_COLORS.wood) : DRESS_COLORS.bark), { matrix: M(s.x, y, s.z, rng.range(0, 6)), top: { color: DRESS_COLORS.moss, threshold: 0.95, amount: 0.3 }, brush: 0.12 });
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2), p0 = v3(s.x + Math.cos(a) * r * 0.8, y + 0.2, s.z + Math.sin(a) * r * 0.8);
    kit.add(pole(p0, v3(s.x + Math.cos(a) * r * 2.3, y - 0.05, s.z + Math.sin(a) * r * 2.3), r * 0.28, r * 0.08, 5), DRESS_COLORS.bark);
  }
  return { boxes: [{ x: s.x, z: s.z, hw: r * 1.1, hd: r * 1.1, rot: 0, yBottom: y - 1, yTop: y + h }] };
};

export interface OvooParams extends Streamed { readonly s: number }

/** an ovoo cairn: a stone heap in rings, a lashed pole bundle, ribbons along the poles and on ropes to stakes round it */
const ovooPaint: Paint<OvooParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground, flutter = c.flutter;
  const o = { x: at.x, z: at.z, s: p.s };
  const gy = ground(o.x, o.z), R = 1.35 * o.s, H = 1.15 * o.s;
  const stone = { top: { color: DRESS_COLORS.lichen, threshold: 0.55, amount: 0.4 }, brush: 0.12 };
  for (let ring = 0; ring < 5; ring++) {
    const t = ring / 4, rr = R * (1 - t * 0.85), yy = gy + H * t * 0.9;
    const n = Math.max(3, Math.round(rr * 6.5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.7 + rng.range(-0.2, 0.2), s = rng.range(0.2, 0.34) * o.s * (1 - t * 0.3);
      const x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr;
      const cc = rng.next() < 0.3 ? DRESS_COLORS.stoneLight : rng.next() < 0.5 ? DRESS_COLORS.stoneDark : DRESS_COLORS.stone;
      kit.add(blob(s, rng, 1, rng.range(0.6, 0.85), 0.25), cc, { ...stone, matrix: M(x, Math.max(yy, ground(x, z)) + s * 0.2, z, rng.range(0, 6)) });
    }
  }
  kit.add(blob(R * 0.8, rng, 2, (H / R) * 0.9, 0.2), DRESS_COLORS.stone, { matrix: M(o.x, gy - 0.1, o.z) });
  const descs = [prism(o.x, o.z, gy - 1, gy + H * 0.95, R * 0.95, 10, 0, 'stone', R * 0.3)];   // P1: the heap
  // the pole bundle
  const top = v3(o.x, gy + H + 1.9 * o.s, o.z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const b0 = v3(o.x + Math.cos(a) * 0.12, gy + H * 0.6, o.z + Math.sin(a) * 0.12);
    const t0 = top.clone().add(v3(Math.cos(a) * 0.35, rng.range(-0.3, 0.2), Math.sin(a) * 0.35));
    kit.add(pole(b0, t0, 0.045, 0.025, 5), DRESS_COLORS.pole, { brush: 0.1 });
    // ribbons tied along each pole and streaming from its head
    for (let k = 0; k < 3; k++) {
      const q = b0.clone().lerp(t0, 0.45 + k * 0.22);
      flutter.streamer(q, rng.range(0.9, 1.8), 0.14, DRESS_RIBBONS[rng.int(0, DRESS_RIBBONS.length - 1)] ?? '#f3efe4', { droop: 0.35 });
    }
  }
  // ropes of ribbons from the bundle down to stakes round the heap
  const a0 = rng.range(0, Math.PI * 2);
  for (let q = 0; q < 3; q++) {
    const sa = a0 + (q / 3) * Math.PI * 2 + rng.range(-0.3, 0.3), sx = o.x + Math.cos(sa) * (R + 1.8), sz = o.z + Math.sin(sa) * (R + 1.8), sy = ground(sx, sz);
    kit.add(pole(v3(sx, sy - 0.2, sz), v3(sx, sy + 0.55, sz), 0.035, 0.03, 5), DRESS_COLORS.pole);
    const from = top.clone().add(v3(Math.cos(sa) * 0.2, -0.3, Math.sin(sa) * 0.2)), to = v3(sx, sy + 0.5, sz);
    kit.add(pole(from, to, 0.008, 0.008, 3), DRESS_COLORS.rope);
    for (let k = 1; k < 10; k++) flutter.strip(from.clone().lerp(to, k / 10), rng.range(0.35, 0.6), 0.11, DRESS_RIBBONS[(k + q * 3) % DRESS_RIBBONS.length] ?? '#6fb0e6');
  }
  return { descs };
};

/** a lone ribbon pole at a viewpoint: a pole in a ring of stones, five streamers */
const viewpointPolePaint: Paint<Streamed> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const q = { x: at.x, z: at.z };
  const gy = ground(q.x, q.z), H = rng.range(3.0, 3.8);
  const top = v3(q.x + rng.range(-0.1, 0.1), gy + H, q.z + rng.range(-0.1, 0.1));
  kit.add(pole(v3(q.x, gy - 0.3, q.z), top, 0.06, 0.04, 6), DRESS_COLORS.pole, { brush: 0.1, foot: 0.7 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, s = rng.range(0.14, 0.24), x = q.x + Math.cos(a) * 0.35, z = q.z + Math.sin(a) * 0.35;
    kit.add(blob(s, rng, 1, 0.7, 0.25), rng.next() < 0.5 ? DRESS_COLORS.stone : DRESS_COLORS.stoneLight, { matrix: M(x, ground(x, z) + s * 0.2, z, rng.range(0, 6)), top: { color: DRESS_COLORS.lichen, threshold: 0.6, amount: 0.4 } });
  }
  for (let k = 0; k < 5; k++) c.flutter.streamer(top.clone().add(v3(0, -0.08 - k * 0.1, 0)), rng.range(1.0, 1.9), 0.08, DRESS_RIBBONS[(k + rng.int(0, 7)) % DRESS_RIBBONS.length] ?? '#f3efe4', { droop: 0.3 });
  return { boxes: [{ x: q.x, z: q.z, hw: 0.45, hd: 0.45, rot: 0, yBottom: gy - 1, yTop: gy + H }] };
};

/** the gateway where the sky road tops out: two stout posts either side of the road (`at.yaw` = the road's), a lintel,
 *  a rail under it, ribbons tied along it, stones round the feet */
const gatewayPaint: Paint<Streamed> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const g = { x: at.x, z: at.z, yaw: at.yaw };
  const boxes: Box[] = [];
  const cx = Math.cos(g.yaw), sx = -Math.sin(g.yaw);   // across the road
  const half = 4.2, H = 3.6;
  const pa = v3(g.x + cx * half, 0, g.z + sx * half), pb = v3(g.x - cx * half, 0, g.z - sx * half);
  pa.y = ground(pa.x, pa.z); pb.y = ground(pb.x, pb.z);
  const top = Math.max(pa.y, pb.y) + H;
  for (const q of [pa, pb]) {
    kit.add(pole(v3(q.x, q.y - 0.4, q.z), v3(q.x, top + 0.25, q.z), 0.16, 0.13, 8), DRESS_COLORS.pole, { brush: 0.12, foot: 0.7 });
    boxes.push({ x: q.x, z: q.z, hw: 0.25, hd: 0.25, rot: 0, yBottom: q.y - 1, yTop: top });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, r = rng.range(0.16, 0.24); const x = q.x + Math.cos(a) * 0.4, z = q.z + Math.sin(a) * 0.4; kit.add(blob(r, rng, 1, 0.7, 0.25), DRESS_COLORS.stone, { matrix: M(x, ground(x, z) + r * 0.2, z, rng.range(0, 6)), top: { color: DRESS_COLORS.lichen, threshold: 0.6, amount: 0.4 } }); }
  }
  const la = v3(pa.x + cx * 0.5, top, pa.z + sx * 0.5), lb = v3(pb.x - cx * 0.5, top, pb.z - sx * 0.5);
  kit.add(pole(la, lb, 0.13, 0.13, 8), logPainter(la, lb, DRESS_COLORS.pole, DRESS_COLORS.wood), { brush: 0.12 });
  kit.add(pole(v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.08), v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.92), 0.06, 0.06, 6), DRESS_COLORS.pole);
  for (let k = 1; k < 14; k++) c.flutter.strip(la.clone().lerp(lb, k / 14).add(v3(0, -0.1, 0)), rng.range(0.5, 0.9), 0.11, DRESS_RIBBONS[k % DRESS_RIBBONS.length] ?? '#6fb0e6');
  return { boxes };
};

/** the camps' loose clutter: 0 firewood tipi · 1 dung-cake stack · 2 chopping block + rounds · 3 pots + bucket · 4 sacks · 5 folded felts · 6 kumis churn */
export const CLUTTER_KINDS = ['Firewood tipi', 'Dung-cake stack', 'Chopping block', 'Pots and a bucket', 'Sacks', 'Folded felts', 'Kumis churn'] as const;

export interface ClutterParams extends Streamed { readonly kind: number }

const clutterPaint: Paint<ClutterParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng;
  const gy = c.ground(at.x, at.z);
  clutter(kit, rng, c.ground, p.kind, at.x, gy, at.z, at.yaw);
  return p.kind === 0 || p.kind === 1 || p.kind === 6 ? { boxes: [{ x: at.x, z: at.z, hw: 0.55, hd: 0.55, rot: 0, yBottom: gy - 1, yTop: gy + 1.2 }] } : {};
};

/** one loose-clutter group at (x, y, z): 0 firewood tipi · 1 dung-cake stack · 2 chopping block + rounds · 3 pots + bucket · 4 sacks · 5 folded felts · 6 kumis churn */
function clutter(kit: Kit, rng: Rng, ground: Ground, kind: number, x: number, y: number, z: number, yaw: number): void {
  const at = (dx: number, dz: number) => { const c = Math.cos(yaw), s = Math.sin(yaw); const wx = x + dx * c + dz * s, wz = z - dx * s + dz * c; return { x: wx, z: wz, y: ground(wx, wz) }; };
  switch (kind) {
    case 0: { // firewood leaned into a tipi, a few splits on the ground
      const top = v3(x, y + 1.25, z);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rng.range(-0.15, 0.15), r = rng.range(0.45, 0.62);
        const b = v3(x + Math.cos(a) * r, y - 0.05, z + Math.sin(a) * r);
        kit.add(pole(b, top.clone().add(v3(rng.range(-0.08, 0.08), rng.range(-0.15, 0.1), rng.range(-0.08, 0.08))), rng.range(0.03, 0.05), 0.025, 5), rng.next() < 0.5 ? DRESS_COLORS.bark : DRESS_COLORS.barkGrey, { brush: 0.12 });
      }
      for (let i = 0; i < 3; i++) { const p = at(rng.range(0.9, 1.5), rng.range(-0.6, 0.6)); const a = rng.range(0, 6); const b0 = v3(p.x - Math.cos(a) * 0.35, p.y + 0.05, p.z - Math.sin(a) * 0.35), b1 = v3(p.x + Math.cos(a) * 0.35, p.y + 0.05, p.z + Math.sin(a) * 0.35); kit.add(pole(b0, b1, 0.06, 0.06, 5), logPainter(b0, b1, DRESS_COLORS.bark, DRESS_COLORS.wood)); }
      break;
    }
    case 1: { // tezek: dried dung cakes stacked into a round pile
      for (let i = 0; i < 9; i++) {
        const rr = 0.42 - i * 0.03;
        kit.add(new THREE.CylinderGeometry(rr, rr + 0.02, 0.1, 10, 1), i % 2 === 0 ? DRESS_COLORS.dung : DRESS_COLORS.dungLight, { matrix: M(x + rng.range(-0.03, 0.03), y + i * 0.095, z + rng.range(-0.03, 0.03), rng.range(0, 6), 1, 1, 1, rng.range(-0.06, 0.06), rng.range(-0.06, 0.06)), brush: 0.18 });
      }
      break;
    }
    case 2: { // chopping block, an axe in it, rounds lying about
      kit.add(new THREE.CylinderGeometry(0.28, 0.3, 0.5, 10, 1), (_p, n) => (n.y > 0.7 ? DRESS_COLORS.wood : DRESS_COLORS.bark), { matrix: M(x, y, z, yaw).multiply(M(0, 0.25, 0)) });
      const hb = v3(x + 0.05, y + 0.52, z), ht = v3(x + 0.25, y + 1.05, z + 0.1);
      kit.add(pole(hb, ht, 0.022, 0.02, 5), DRESS_COLORS.wood);
      kit.add(new THREE.BoxGeometry(0.2, 0.08, 0.03), DRESS_COLORS.iron, { matrix: M(x, y + 0.53, z, 0.4), flat: true });
      for (let i = 0; i < 4; i++) { const p = at(rng.range(-1.2, 1.2), rng.range(0.6, 1.3)); kit.add(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 9, 1), (_q, n) => (Math.abs(n.y) > 0.7 ? DRESS_COLORS.wood : DRESS_COLORS.bark), { matrix: M(p.x, p.y + 0.12, p.z, rng.range(0, 6), 1, 1, 1, rng.next() < 0.5 ? Math.PI / 2 : 0) }); }
      break;
    }
    case 3: { // clay pots + a banded wooden bucket
      for (let i = 0; i < 3; i++) {
        const p = at(rng.range(-0.7, 0.7), rng.range(-0.5, 0.5));
        kit.add(lathe([[0.001, 0], [0.14, 0], [0.22, 0.14], [0.2, 0.3], [0.12, 0.38], [0.14, 0.42], [0.12, 0.43], [0.001, 0.36]], 12), DRESS_COLORS.clay, { matrix: M(p.x, p.y - 0.02, p.z, 0, rng.range(0.8, 1.2)), brush: 0.1 });
      }
      const b = at(0.9, 0.3);
      kit.add(lathe([[0.001, 0], [0.19, 0], [0.23, 0.42], [0.21, 0.42], [0.001, 0.36]], 12), (p) => (Math.abs(p.y - 0.08) < 0.03 || Math.abs(p.y - 0.34) < 0.03 ? DRESS_COLORS.iron : DRESS_COLORS.bark), { matrix: M(b.x, b.y - 0.02, b.z) });
      break;
    }
    case 4: { // grain / wool sacks slumped together
      for (let i = 0; i < 3; i++) {
        const p = at(i * 0.36 - 0.36, rng.range(-0.12, 0.12));
        kit.add(blob(0.22, rng, 2, 1.3, 0.12), DRESS_COLORS.sack, { matrix: M(p.x, p.y + 0.2, p.z, rng.range(0, 6), 1, 1, 0.85, rng.range(-0.2, 0.2), rng.range(-0.25, 0.25)), brush: 0.12 });
        kit.add(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 6), DRESS_COLORS.rope, { matrix: M(p.x, p.y + 0.48, p.z) });
      }
      break;
    }
    case 6: { // a kumis churn: a tall staved tub with iron hoops, a dasher standing in it, a leather lid
      kit.add(lathe([[0.001, 0], [0.24, 0], [0.26, 0.05], [0.24, 0.62], [0.2, 0.86], [0.21, 0.9], [0.001, 0.88]], 14), (p) => (Math.abs(p.y - 0.12) < 0.03 || Math.abs(p.y - 0.72) < 0.03 ? DRESS_COLORS.iron : p.y > 0.86 ? DRESS_COLORS.sack : DRESS_COLORS.bark), { matrix: M(x, y - 0.03, z, yaw), brush: 0.12 });
      const top = v3(x + 0.04, y + 1.45, z), base = v3(x, y + 0.6, z);
      kit.add(pole(base, top, 0.022, 0.02, 5), DRESS_COLORS.wood);
      kit.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), DRESS_COLORS.wood, { matrix: M(x + 0.04, y + 1.4, z) });
      const b = at(0.55, 0.2);
      kit.add(lathe([[0.001, 0], [0.13, 0], [0.16, 0.26], [0.001, 0.22]], 10), DRESS_COLORS.bark, { matrix: M(b.x, b.y - 0.02, b.z) });
      break;
    }
    default: { // folded felts stacked on a low stand
      const cols = [DRESS_COLORS.feltRed, DRESS_COLORS.feltCream, DRESS_COLORS.feltBlue, DRESS_COLORS.feltOrange];
      kit.add(new THREE.BoxGeometry(1.2, 0.18, 0.8), DRESS_COLORS.bark, { matrix: M(x, y + 0.09, z, yaw), flat: true });
      for (let i = 0; i < 4; i++) kit.add(new THREE.BoxGeometry(1.05 - i * 0.05, 0.13, 0.7 - i * 0.03), cols[i % cols.length] ?? DRESS_COLORS.feltRed, { matrix: M(x + rng.range(-0.04, 0.04), y + 0.25 + i * 0.13, z, yaw + rng.range(-0.08, 0.08)), flat: true, brush: 0.1 });
      break;
    }
  }
}

// ── the models ────────────────────────────────────────────────────────────────────────────────────────────────────



export const fallenLogPainted: ModelDef<LogParams> = { ...fallenLog, build: painted(logPaint, { seed: 0xd701, finish: { aoH: 0.3, aoMin: 0.6, ao: false } }) };
export const stumpPainted: ModelDef<StumpParams> = { ...stump, build: painted(stumpPaint, { seed: 0xd702, finish: { aoH: 0.35, ao: false } }) };
export const ovooPainted: ModelDef<OvooParams> = { ...ovoo, build: painted(ovooPaint, { seed: 0xd703, finish: { aoH: 0.4, ao: { strength: 0.5 } } }) };
export const viewpointPolePainted: ModelDef<Streamed> = { ...viewpointPole, build: painted(viewpointPolePaint, { seed: 0xd704, finish: { aoH: 0.3, ao: false } }) };
export const skyGatewayPainted: ModelDef<Streamed> = { ...skyGateway, build: painted(gatewayPaint, { seed: 0xd705, finish: { aoH: 0.4, ao: false } }) };
export const campClutterPainted: ModelDef<ClutterParams> = { ...campClutter, build: painted(clutterPaint, { seed: 0xc1a8, finish: { aoH: 0.35, ao: { strength: 0.45 } } }) };

/**
 * The split-rail fence (E306 / E315 second pass; was src/shards/nalati-grasslands/world/props.ts `addFence`): a run of weathered larch
 * posts every ~2.4 m along a polyline, two sagging rails between them, the posts following the ground and leaning a
 * little. The valley roads' fences (src/shards/nalati-grasslands/world/RoadFurniture.ts) and the sky road's guard fences (the dressing,
 * src/shards/nalati-grasslands/world/dressing/statics.ts) are runs of it. Painted into its place's mesh on the timber layer (props.ts
 * GRAIN); one box per straight segment of the run.
 *
 * A copy is a run: `at` is its first point on the ground, `pts` the run's points relative to it (x, z), the first (0, 0).
 */



/**
 * A split-rail fence along a polyline (posts every ~2.4 m, two rails, the rails sag slightly). One collider per
 * straight segment. Posts follow the ground.
 */
export function addFence(kit: Kit, ground: Ground, pts: [number, number][], colliders: Collider[], o: { h?: number; spacing?: number } = {}): void {
  const h = o.h ?? 1.15, sp = o.spacing ?? 2.4, rng = kit.rng;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (!p || !q) continue;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(len / sp));
    const posts: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0) { const last = posts[posts.length - 1]; if (last) posts.push(last); continue; }
      const t = k / n, x = p[0] + (q[0] - p[0]) * t + rng.range(-0.05, 0.05), z = p[1] + (q[1] - p[1]) * t + rng.range(-0.05, 0.05);
      const y = ground(x, z);
      const lean = rng.range(-0.05, 0.05);
      kit.add(woodPole(v3(x, y - 0.3, z), v3(x + lean, y + h + rng.range(-0.05, 0.08), z + lean * 0.5), 0.075, 0.06, 7, 3), GRAIN, { ...WOOD, jitter: 0.1, foot: 0.7, brush: 0.14 });
      posts.push(v3(x, y, z));
    }
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k], b = posts[k + 1];
      if (!a || !b) continue;
      for (const ry of [h * 0.45, h * 0.88]) {
        const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2 + ry - 0.05, (a.z + b.z) / 2);
        kit.add(woodPole(v3(a.x, a.y + ry, a.z), mid, 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
        kit.add(woodPole(mid, v3(b.x, b.y + ry, b.z), 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
      }
    }
    const cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2, yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    const gy = ground(cx, cz);
    colliders.push({ x: cx, z: cz, hw: 0.12, hd: len / 2, rot: -yaw, yBottom: gy - 1.5, yTop: gy + h });
  }
}

export interface FenceParams {
  /** the run's points, relative to the placement: (x, z), the first (0, 0) */
  readonly pts: readonly (readonly [number, number])[];
  /** post height (m) and spacing along the run */
  readonly h: number;
  readonly spacing: number;
}

const paintFence: Paint<FenceParams> = (kit, at, p, c) => {
  const boxes: Box[] = [];
  addFence(kit, c.ground, p.pts.map(([x, z]): [number, number] => [at.x + x, at.z + z]), boxes, { h: p.h, spacing: p.spacing });
  return { boxes };
};

/**
 * A run's params from its world points: the run stands at its first point, its points relative to it — unless a point
 * would not come back exactly (first + (p − first) ≠ p in floating point: far-apart or opposite-signed coordinates),
 * then it stands at the world origin with its points as they are, so it is drawn and collides bit-identically.
 */
export function fenceRun(pts: readonly (readonly [number, number])[], o: { h?: number; spacing?: number } = {}): { at: { x: number; z: number }; params: FenceParams } {
  const [x0, z0] = pts[0] ?? [0, 0];
  const exact = pts.every(([x, z]) => x0 + (x - x0) === x && z0 + (z - z0) === z);
  const [ax, az] = exact ? [x0, z0] : [0, 0];
  return { at: { x: ax, z: az }, params: { pts: pts.map(([x, z]) => [x - ax, z - az] as const), h: o.h ?? 1.15, spacing: o.spacing ?? 2.4 } };
}


export const fencePainted: ModelDef<FenceParams> = { ...fence, build: painted(paintFence, { seed: 0xfe9c, layers: ['rock'] }) };

/**
 * The escarpment's rock (E306 / E315 second pass; the per-rock drawing of src/shards/nalati-grasslands/outcrops.ts, verbatim):
 *
 *   granite outcrop   a weathered granite block (./../../../world/nalati/granite.ts `graniteBlock`: a rounded box pushed
 *                     about by noise) lying along the contour, tipped into the slope, lichen on its tops, a darker foot —
 *                     the escarpment's ravines and rock bands, the rim's broken band, the edge berm's crest
 *   rounded boulder   a smooth lumpy stone (`blob`): leaning on a block downhill, standing in the river's current, lying
 *                     on its banks and bars, in the meltwater stream's bed and heaped along it
 *
 * Painted into the escarpment's ONE mesh (src/shards/nalati-grasslands/outcrops.ts: a NalatiSet over its kit, in the old order: so the
 * mesh is bit-identical) and placed `drawnInto` it. A copy draws its shape from that kit's rng stream; where the old
 * builder drew a tint between the shape and its turn, the params say so (`draw`). Collides as the hull of what it
 * draws when it is big (`solid`: a block over 1.1 m, a stream boulder over 1 m).
 */

const OUTCROP_COLORS = {
  granite: new THREE.Color('#948d82'),
  warm: new THREE.Color('#a39179'),
  cool: new THREE.Color('#7f8189'),
  lichen: new THREE.Color('#b3a35a'),
  moss: new THREE.Color('#5f7433'),
  snow: new THREE.Color('#eef2f7'),
};

export type RockTint = 'granite' | 'warm' | 'cool';

export interface GraniteOutcropParams {
  /** the block: width (along the contour), height, depth; how rough its surface */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly rough: number;
  /** its tip into the slope (radians about its own x / z) */
  readonly pitch: number;
  readonly roll: number;
  /** its tint; absent: drawn from the stream after the block's shape (`draw`: of two, granite / warm, or of three) */
  readonly tint?: RockTint;
  readonly draw?: 2 | 3;
  /** how much lichen on its tops */
  readonly lichen: number;
  /** it collides (as the hull of what it draws) */
  readonly solid: boolean;
}

/** `at`: its centre (sunk a third into the ground), `at.yaw` along the contour */
const outcropPaint: Paint<GraniteOutcropParams> = (kit, at, p) => {
  const rng = kit.rng;
  const block = graniteBlock(p.w, p.h, p.d, rng.int(1, 1e6), p.rough), bm = M(at.x, at.y, at.z, at.yaw, 1, 1, 1, p.pitch, p.roll);
  const descs = p.solid ? [supportHull(block, bm, 'rock')] : [];
  const tint = p.tint !== undefined ? OUTCROP_COLORS[p.tint] : p.draw === 2 ? (rng.next() < 0.5 ? OUTCROP_COLORS.granite : OUTCROP_COLORS.warm) : rng.next() < 0.5 ? OUTCROP_COLORS.granite : rng.next() < 0.5 ? OUTCROP_COLORS.warm : OUTCROP_COLORS.cool;
  kit.add(block, tint, { matrix: bm, top: { color: OUTCROP_COLORS.lichen, threshold: 0.55, amount: p.lichen }, brush: 0.14, foot: 0.72 });
  return { descs };
};

/** where a rounded boulder lies, and how it is painted there */
export type BoulderLook = 'lean' | 'channel' | 'bank' | 'bed' | 'streambank';

const BOULDER_LOOK: Readonly<Record<BoulderLook, { squash: number; rough: number; opts: PaintOpts }>> = {
  lean: { squash: 0.72, rough: 0.2, opts: { top: { color: OUTCROP_COLORS.moss, threshold: 0.7, amount: 0.4 }, brush: 0.12, foot: 0.75 } },
  channel: { squash: 0.65, rough: 0.16, opts: { brush: 0.1, foot: 0.6 } },
  bank: { squash: 0.7, rough: 0.18, opts: { top: { color: OUTCROP_COLORS.moss, threshold: 0.75, amount: 0.3 }, brush: 0.1, foot: 0.7 } },
  bed: { squash: 0.62, rough: 0.2, opts: { brush: 0.1, foot: 0.55 } },
  streambank: { squash: 0.7, rough: 0.22, opts: { top: { color: OUTCROP_COLORS.snow, threshold: 0.75, amount: 0.25 }, brush: 0.12, foot: 0.65 } },
};

export interface RoundedBoulderParams {
  /** radius, metres */
  readonly r: number;
  readonly look: BoulderLook;
  /** its tint; absent: drawn from the stream after its shape, cool with these odds, else granite */
  readonly tint?: RockTint;
  readonly coolOdds?: number;
  readonly solid: boolean;
}

/** `at`: its centre (the placer sinks it), it takes its own turn */
const boulderPaint: Paint<RoundedBoulderParams> = (kit, at, p) => {
  const rng = kit.rng, look = BOULDER_LOOK[p.look];
  const stone = blob(p.r, rng, 1, look.squash, look.rough);
  const tint = p.tint !== undefined ? OUTCROP_COLORS[p.tint] : rng.next() < (p.coolOdds ?? 0.5) ? OUTCROP_COLORS.cool : OUTCROP_COLORS.granite;
  const sm = M(at.x, at.y, at.z, rng.range(0, 6.28));
  const descs = p.solid ? [supportHull(stone, sm, 'rock')] : [];
  kit.add(stone, tint, { ...look.opts, matrix: sm });
  return { descs };
};



export const graniteOutcropPainted: ModelDef<GraniteOutcropParams> = { ...graniteOutcrop, build: painted(outcropPaint, { seed: 0x0c7, finish: { ao: false, aoH: 0.8, aoMin: 0.6 } }) };
export const roundedBoulderPainted: ModelDef<RoundedBoulderParams> = { ...roundedBoulder, build: painted(boulderPaint, { seed: 0x0c8, finish: { ao: false, aoH: 0.8, aoMin: 0.6 } }) };

/**
 * The kokpar goal (E306 / E315 M3; the tai-kazan): a raised ring of trodden turf with a stone rim, where a rider throws
 * the goat. One at each end of the kokpar field's oval (src/shards/nalati-grasslands/world/Bowl.ts). Placed on the ground (`at.y`).
 * Painted into its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the mound as an 18-sided prism.
 */

const EARTH = new THREE.Color('#6f5a3a');

const paintKokparGoal: Paint<object> = (kit, at) => {
  const gy = at.y;
  kit.add(new THREE.CylinderGeometry(2.2, 2.6, 0.9, 18, 1), EARTH, { matrix: M(at.x, gy + 0.2, at.z), brush: 0.1 });
  kit.add(new THREE.TorusGeometry(2.25, 0.28, 6, 18).rotateX(Math.PI / 2), PC.stone, { matrix: M(at.x, gy + 0.68, at.z), brush: 0.1 });
  return { descs: [prism(at.x, at.z, gy - 1, gy + 0.72, 2.6, 18, 0, 'earth', 2.3)] };
};


export const kokparGoalPainted: ModelDef<object> = { ...kokparGoal, build: painted(paintKokparGoal, { seed: 0x60ba }) };

/**
 * The kokpar marker post (E306 / E315 M3): a weathered larch post 1.25 m tall ringing the kokpar field's trodden oval
 * (src/shards/nalati-grasslands/world/Bowl.ts sets 34; every fourth carries a pennant — the shard's cloth, not the model). Placed on the
 * ground (`at.y`), sunk 0.3 m. Painted into its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Walk-through.
 */

const paintKokparPost: Paint<object> = (kit, at) => {
  kit.add(pole(v3(at.x, at.y - 0.3, at.z), v3(at.x, at.y + 1.25, at.z), 0.06, 0.05, 6), PC.woodGrey, { foot: 0.7 });
  return {};
};


export const kokparPostPainted: ModelDef<object> = { ...kokparPost, build: painted(paintKokparPost, { seed: 0x60ba }) };

/**
 * The stone step (E306 / E315 M3): one flat granite block of a stone stair — a rough block a touch wider than its tread,
 * its top flat at the tread, lichen on it, from under the turf up to the step. A stair (src/shards/nalati-grasslands/world/Stair.ts: a
 * route up a slope the motor cannot climb, its rise and tread held by construction) lays them; the watchtower's west
 * shoulder is the one on the shard. Placed at its foot (`at.y`: the block's bottom), `yaw` along the flight. Painted into
 * its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the block as the box it draws (the tread 1 cm deeper).
 */

export interface StoneStepParams {
  /** the tread's width across the flight and its depth along it, the block's height (m) */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** its shape's seed (the stair's step number) */
  readonly seed: number;
}

const STEP_COLORS = { top: new THREE.Color('#b3a58e'), side: new THREE.Color('#7d7264'), lichen: new THREE.Color('#b4a860') };

const paintStoneStep: Paint<StoneStepParams> = (kit, at, p) => {
  const h = p.height;
  kit.add(graniteBlock(p.width + 0.3, h, p.depth + 0.12, p.seed, 0.06, 1), (_q, n) => (n.y > 0.6 ? STEP_COLORS.top : STEP_COLORS.side), { matrix: M(at.x, at.y + h / 2, at.z, at.yaw), top: { color: STEP_COLORS.lichen, threshold: 0.75, amount: 0.2 }, brush: 0.1 });
  return { descs: [{ kind: 'box', x: at.x, y: at.y + h / 2, z: at.z, hx: p.width / 2, hy: h / 2, hz: p.depth / 2 + 0.01, yaw: at.yaw, surface: 'stone' }] };
};


export const stoneStepPainted: ModelDef<StoneStepParams> = { ...stoneStep, build: painted(paintStoneStep, { seed: 0x70e7 }) };

/** The signpost's physical geometry; the canvas lettering stays view code. */
const paintSignpost: Paint<SignpostParams> = (kit, at, p, c) => {
  const s = { x: at.x, z: at.z };
  const gy = c.ground(s.x, s.z), H = 1.9 + p.boards.length * 0.36;
  kit.add(woodPole(v3(s.x, gy - 0.4, s.z), v3(s.x, gy + H, s.z), 0.09, 0.075, 8, 3), GRAIN, { ...WOOD, foot: 0.7, brush: 0.14 });
  kit.add(new THREE.ConeGeometry(0.11, 0.2, 8).translate(s.x, gy + H + 0.1, s.z), PC.woodDark);
  for (const b of boardSpots(s.x, s.z, gy, p.boards)) {
    const m = M(b.p.x, b.p.y, b.p.z, b.yaw);
    kit.add(new THREE.BoxGeometry(b.w, 0.27, 0.045), PC.woodDark, { matrix: m, flat: true });
    const tip = new THREE.CylinderGeometry(0.19, 0.19, 0.045, 3).rotateX(Math.PI / 2).scale(0.75, 1, 1).translate(b.w / 2 + 0.06, 0, 0);
    kit.add(tip, PC.woodDark, { matrix: m, flat: true });
  }
  return { boxes: [{ x: s.x, z: s.z, hw: 0.14, hd: 0.14, rot: 0, yBottom: gy - 1, yTop: gy + H }] };
};


export const signpostPainted: ModelDef<SignpostParams> = { ...signpost, build: painted(paintSignpost, { seed: 0x5197, layers: ['rock'] }) };

/**
 * Camp props for the Nalati POIs (B5), each painted into a PaintKit at a world position: felt rugs (syrmak pattern),
 * a rug drying frame, barrels, painted chests, an iron stove with its pipe, a kazan on a tripod over a stone ring,
 * a two-wheeled cart (arba), a firewood stack, a saddle on a rack, a static golden eagle, a split-rail fence run.
 * Every function returns what the caller needs (a smoke mouth, a collider) and pushes nothing global.
 */
import * as THREE from 'three';
import { type PaintKit, M, pole, v3, lathe, blob } from './paint';
import type { Collider } from '../../player/Player';

export const PC = {
  wood: new THREE.Color('#8b5e36'),
  woodLight: new THREE.Color('#a8784a'),
  woodDark: new THREE.Color('#553821'),
  woodGrey: new THREE.Color('#8a7d6c'),
  iron: new THREE.Color('#34312f'),
  red: new THREE.Color('#b1301d'),
  redDark: new THREE.Color('#5a1d13'),
  orange: new THREE.Color('#d8782c'),
  gold: new THREE.Color('#dca744'),
  cream: new THREE.Color('#f1e3c2'),
  blue: new THREE.Color('#2f4f86'),
  teal: new THREE.Color('#2f7d7a'),
  leather: new THREE.Color('#6a4024'),
  stone: new THREE.Color('#8f8c86'),
  stoneDark: new THREE.Color('#6c6a66'),
  hay: new THREE.Color('#cfae5c'),
  eagle: new THREE.Color('#5a3b1f'),
  eagleDark: new THREE.Color('#3b2513'),
  eagleGold: new THREE.Color('#c4964a'),
  beak: new THREE.Color('#e2b83e'),
  talon: new THREE.Color('#2b2724'),
};

type Ground = (x: number, z: number) => number;

// ── felt rugs ────────────────────────────────────────────────────────────────────────────────────────

const RUG_PALETTES: { field: THREE.Color; band: THREE.Color; edge: THREE.Color; motif: THREE.Color }[] = [
  { field: PC.red, band: PC.cream, edge: PC.redDark, motif: PC.gold },
  { field: PC.blue, band: PC.orange, edge: PC.redDark, motif: PC.cream },
  { field: PC.orange, band: PC.redDark, edge: PC.redDark, motif: PC.cream },
  { field: PC.teal, band: PC.cream, edge: PC.redDark, motif: PC.red },
];

/** a syrmak felt rug w × h (local x across, local y along, in the XY plane, 2 cm thick) — painted per face */
export function rugGeometry(w: number, h: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, 0.02, Math.round(w * 8), Math.round(h * 8), 1);
}
export function rugPainter(w: number, h: number, pal: number): (p: THREE.Vector3) => THREE.Color {
  const P = RUG_PALETTES[pal % RUG_PALETTES.length] ?? { field: PC.red, band: PC.cream, edge: PC.redDark, motif: PC.gold };
  return (p) => {
    const bu = w / 2 - Math.abs(p.x), bv = h / 2 - Math.abs(p.y), b = Math.min(bu, bv);      // metres in from the edge
    if (b < 0.05) return P.edge;
    if (b < 0.2) {
      // zig-zag band: the running-hook along the border
      const along = bu < bv ? p.y : p.x;
      const zz = Math.abs(((along * 6) % 2 + 2) % 2 - 1);                                     // 0..1 triangle wave
      return (b - 0.05) / 0.15 < zz * 0.8 + 0.1 ? P.band : P.field;
    }
    if (b < 0.25) return P.edge;
    // field: a stepped diamond medallion with ram-horn hooks, repeated along the long axis
    const cell = Math.min(w, h) - 0.5;
    const yy = ((p.y / cell) % 1 + 1.5) % 1 - 0.5, xx = p.x / cell;
    const d = Math.abs(xx) + Math.abs(yy);
    if (d < 0.1) return P.band;
    if (d < 0.22) return P.motif;
    if (d > 0.3 && d < 0.36 && Math.abs(xx) > 0.08 && Math.abs(yy) > 0.08) return P.motif;
    return P.field;
  };
}

/** a rug lying flat on the ground (long axis along yaw) */
export function addGroundRug(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, w: number, h: number, pal: number): void {
  let y = -Infinity;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]] as const) y = Math.max(y, ground(x + dx * w * 0.5, z + dz * h * 0.5));
  const g = rugGeometry(w, h);
  kit.add(g, rugPainter(w, h, pal), { matrix: M(x, y + 0.02, z, yaw, 1, 1, 1, -Math.PI / 2), brush: 0.05, jitter: 0.02 });
}

/** an A-frame drying rack with rugs thrown over the bar (bar along local x, rack width 3.4 m) */
export function addRugRack(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[], pals: number[]): void {
  const y = ground(x, z), cs = Math.cos(yaw), sn = Math.sin(yaw);
  const W = 3.6, H = 1.9;
  const at = (lx: number, ly: number, lz: number) => v3(x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs);
  for (const sx of [-1, 1]) {
    kit.add(pole(at(sx * W / 2, -0.2, -0.55), at(sx * W / 2, H + 0.1, 0), 0.05, 0.045), PC.woodGrey);
    kit.add(pole(at(sx * W / 2, -0.2, 0.55), at(sx * W / 2, H + 0.1, 0), 0.05, 0.045), PC.woodGrey);
  }
  kit.add(pole(at(-W / 2 - 0.2, H, 0), at(W / 2 + 0.2, H, 0), 0.045), PC.woodGrey);
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

// ── small props ──────────────────────────────────────────────────────────────────────────────────────

/** a coopered barrel (1 m) */
export function addBarrel(kit: PaintKit, ground: Ground, x: number, z: number, colliders: Collider[], s = 1): void {
  const y = ground(x, z) - 0.03;
  kit.add(lathe([[0.001, 0], [0.27, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.27, 0.9], [0.24, 0.9], [0.001, 0.88]], 14), PC.wood, { matrix: M(x, y, z, 0, s) });
  for (const hy of [0.14, 0.76]) kit.add(new THREE.TorusGeometry(0.3, 0.018, 4, 16).rotateX(Math.PI / 2).translate(0, hy, 0), PC.iron, { matrix: M(x, y, z, 0, s) });
  colliders.push({ x, z, hw: 0.3 * s, hd: 0.3 * s, rot: 0, yBottom: y - 1, yTop: y + 0.9 * s });
}

/** a painted wooden chest (sandyk): orange-red with gold bands */
export function addChest(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z);
  const m = M(x, y, z, yaw);
  kit.add(new THREE.BoxGeometry(1.1, 0.55, 0.6).translate(0, 0.3, 0), PC.orange, { matrix: m, flat: true });
  kit.add(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.35, 0.98).translate(0, 0.575, 0), PC.orange, { matrix: m });
  for (const bx of [-0.4, 0, 0.4]) kit.add(new THREE.BoxGeometry(0.07, 0.58, 0.62).translate(bx, 0.3, 0), PC.gold, { matrix: m, flat: true });
  kit.add(new THREE.BoxGeometry(0.16, 0.14, 0.03).translate(0, 0.42, -0.31), PC.gold, { matrix: m, flat: true });
  colliders.push({ x, z, hw: 0.55, hd: 0.3, rot: -yaw, yBottom: y - 1, yTop: y + 0.75 });
}

/** a firewood stack (split logs, ~1.6 m long) */
export function addWoodpile(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z), rng = kit.rng, cs = Math.cos(yaw), sn = Math.sin(yaw);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - row; i++) {
    const lx = (i - (5 - row) / 2) * 0.24 + rng.range(-0.02, 0.02), ly = 0.12 + row * 0.2;
    const a = v3(x + lx * cs - 0.8 * sn, y + ly, z - lx * sn - 0.8 * cs), b = v3(x + lx * cs + 0.8 * sn, y + ly + rng.range(-0.03, 0.03), z - lx * sn + 0.8 * cs);
    kit.add(pole(a, b, 0.11, 0.1, 6), rng.next() < 0.5 ? PC.woodLight : PC.wood, { jitter: 0.1 });
  }
  colliders.push({ x, z, hw: 0.8, hd: 0.85, rot: -yaw, yBottom: y - 1, yTop: y + 0.85 });
}

/** the camp stove: an iron box stove on legs with a pipe and a kettle; returns the pipe's mouth */
export function addStove(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): THREE.Vector3 {
  const y = ground(x, z), m = M(x, y, z, yaw);
  kit.add(new THREE.BoxGeometry(0.75, 0.48, 0.5).translate(0, 0.5, 0), PC.iron, { matrix: m, flat: true });
  for (const [lx, lz] of [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]] as const) kit.add(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 5).translate(lx, 0.14, lz), PC.iron, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.28, 0.2, 0.02).translate(-0.12, 0.48, -0.26), new THREE.Color('#7a2a10'), { matrix: m, flat: true });
  kit.add(new THREE.CylinderGeometry(0.075, 0.075, 1.7, 8).translate(0.24, 1.58, 0.1), PC.iron, { matrix: m });
  kit.add(new THREE.CylinderGeometry(0.13, 0.08, 0.08, 8).translate(0.24, 2.46, 0.1), PC.iron, { matrix: m });
  // kettle
  kit.add(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 0.8, 1).translate(-0.12, 0.84, 0.02), new THREE.Color('#9a6a2a'), { matrix: m });
  kit.add(pole(v3(-0.02, 0.86, 0.02), v3(0.09, 0.95, 0.02), 0.022, 0.012, 5), new THREE.Color('#9a6a2a'), { matrix: m });
  colliders.push({ x, z, hw: 0.42, hd: 0.3, rot: -yaw, yBottom: y - 1, yTop: y + 0.8 });
  return v3(0.24, 2.55, 0.1).applyMatrix4(m);
}

/** a kazan (cauldron) on a pole tripod over a ring of fire stones; returns the fire's centre (for a smoke plume) */
export function addKazan(kit: PaintKit, ground: Ground, x: number, z: number, colliders: Collider[]): THREE.Vector3 {
  const y = ground(x, z), rng = kit.rng;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 0.62;
    kit.add(blob(0.16, rng, 1, 0.65), PC.stoneDark, { matrix: M(x + Math.cos(a) * r, y + 0.03, z + Math.sin(a) * r, rng.range(0, 6)) });
  }
  kit.add(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12).translate(0, 0.02, 0), new THREE.Color('#2b2522'), { matrix: M(x, y, z) });
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, Math.PI * 2);
    kit.add(pole(v3(x + Math.cos(a) * 0.35, y + 0.05, z + Math.sin(a) * 0.35), v3(x - Math.cos(a) * 0.15, y + 0.18, z - Math.sin(a) * 0.15), 0.045, 0.035, 5), PC.woodDark);
  }
  // cauldron + tripod
  kit.add(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.62, 0), PC.iron, { matrix: M(x, y, z) });
  kit.add(new THREE.TorusGeometry(0.36, 0.03, 5, 16).rotateX(Math.PI / 2).translate(0, 0.62, 0), PC.iron, { matrix: M(x, y, z) });
  kit.add(new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2).translate(0, 0.56, 0), new THREE.Color('#4a3522'), { matrix: M(x, y, z), brush: 0.02 });
  const top = v3(x, y + 1.85, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    kit.add(pole(v3(x + Math.cos(a), y - 0.1, z + Math.sin(a)), v3(top.x - Math.cos(a) * 0.12, top.y + 0.15, top.z - Math.sin(a) * 0.12), 0.045, 0.035, 6), PC.woodGrey);
  }
  kit.add(pole(top, v3(x, y + 0.98, z), 0.012, 0.012, 4), PC.iron);
  colliders.push({ x, z, hw: 0.7, hd: 0.7, rot: 0, yBottom: y - 1, yTop: y + 0.95 });
  return v3(x, y + 0.9, z);
}

/** a two-wheeled cart (arba), shafts resting on the ground */
export function addCart(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
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
export function addSaddleRack(kit: PaintKit, ground: Ground, x: number, z: number, yaw: number, colliders: Collider[]): void {
  const y = ground(x, z), m = M(x, y, z, yaw);
  for (const sx of [-0.45, 0.45]) {
    kit.add(pole(v3(sx, 0, -0.3), v3(sx, 0.95, 0), 0.04, 0.035, 5), PC.woodGrey, { matrix: m });
    kit.add(pole(v3(sx, 0, 0.3), v3(sx, 0.95, 0), 0.04, 0.035, 5), PC.woodGrey, { matrix: m });
  }
  kit.add(pole(v3(-0.6, 0.95, 0), v3(0.6, 0.95, 0), 0.05, 0.05, 6), PC.woodGrey, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.9, 0.03, 0.8).translate(0, 0.98, 0), PC.red, { matrix: m, flat: true });
  kit.add(new THREE.BoxGeometry(0.92, 0.035, 0.1).translate(0, 0.985, -0.41), PC.gold, { matrix: m, flat: true });
  kit.add(new THREE.BoxGeometry(0.92, 0.035, 0.1).translate(0, 0.985, 0.41), PC.gold, { matrix: m, flat: true });
  kit.add(new THREE.SphereGeometry(0.3, 12, 8).scale(1.3, 0.45, 0.9).translate(0, 1.04, 0), PC.leather, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.08, 0.26, 0.36).translate(0.34, 1.16, 0), PC.woodDark, { matrix: m });
  kit.add(new THREE.BoxGeometry(0.08, 0.2, 0.3).translate(-0.34, 1.13, 0), PC.woodDark, { matrix: m });
  colliders.push({ x, z, hw: 0.65, hd: 0.35, rot: -yaw, yBottom: y - 1, yTop: y + 1.1 });
}

// ── the eagle ────────────────────────────────────────────────────────────────────────────────────────

/** a perched golden eagle (static), ~0.85 m tall, feet at `feet`, facing yaw (0 = −z) */
export function addEagle(kit: PaintKit, feet: THREE.Vector3, yaw: number, scale = 1.35): void {
  const m = M(feet.x, feet.y, feet.z, yaw, scale);
  const add = (g: THREE.BufferGeometry, c: THREE.Color) => kit.add(g, c, { matrix: m, brush: 0.08 });
  // forward is −z
  add(new THREE.SphereGeometry(0.17, 14, 10).scale(0.78, 1.5, 0.9).rotateX(0.32).translate(0, 0.38, 0.03), PC.eagle);
  add(new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1.1, 1.05).translate(0, 0.6, -0.04), PC.eagleGold);    // nape / neck
  add(new THREE.SphereGeometry(0.085, 12, 8).scale(1, 0.95, 1.2).translate(0, 0.71, -0.07), PC.eagleGold);
  add(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1.02, 0.7, 1.1).translate(0, 0.745, -0.07), PC.eagleDark);  // crown
  // beak: yellow cere, dark hooked tip
  add(new THREE.ConeGeometry(0.04, 0.11, 8).rotateX(-Math.PI / 2 - 0.35).translate(0, 0.7, -0.175), PC.beak);
  add(new THREE.ConeGeometry(0.024, 0.06, 6).rotateX(-Math.PI / 2 - 1.2).translate(0, 0.665, -0.225), PC.talon);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.018, 6, 5).translate(sx * 0.055, 0.735, -0.135), PC.talon);
    // folded wings: long dark ellipsoids along the flanks, tips crossing past the tail
    add(new THREE.SphereGeometry(0.17, 12, 8).scale(0.3, 1.75, 0.8).rotateX(0.5).rotateZ(sx * 0.06).translate(sx * 0.12, 0.3, 0.1), PC.eagleDark);
    add(new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI - 0.4).translate(sx * 0.07, 0.06, 0.2), PC.eagleDark);
    // feathered legs + yellow feet gripping the bar
    add(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.3, 1).translate(sx * 0.07, 0.13, -0.02), PC.eagle);
    add(new THREE.CylinderGeometry(0.02, 0.022, 0.08, 5).translate(sx * 0.07, 0.04, -0.03), PC.beak);
    for (const tz of [-0.06, 0.0]) add(new THREE.ConeGeometry(0.012, 0.06, 4).rotateX(-Math.PI / 2 - 0.9).translate(sx * 0.07, 0.0, tz - 0.02), PC.talon);
  }
  add(new THREE.BoxGeometry(0.15, 0.38, 0.035).rotateX(0.4).translate(0, 0.06, 0.2), PC.eagleDark);                // tail
}

// ── fences ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A split-rail fence along a polyline (posts every ~2.4 m, two rails, the rails sag slightly). One collider per
 * straight segment. Posts follow the ground.
 */
export function addFence(kit: PaintKit, ground: Ground, pts: [number, number][], colliders: Collider[], o: { h?: number; spacing?: number } = {}): void {
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
      kit.add(pole(v3(x, y - 0.3, z), v3(x + lean, y + h + rng.range(-0.05, 0.08), z + lean * 0.5), 0.075, 0.06, 6), PC.woodGrey, { jitter: 0.1, foot: 0.7 });
      posts.push(v3(x, y, z));
    }
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k], b = posts[k + 1];
      if (!a || !b) continue;
      for (const ry of [h * 0.45, h * 0.88]) {
        const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2 + ry - 0.05, (a.z + b.z) / 2);
        kit.add(pole(v3(a.x, a.y + ry, a.z), mid, 0.05, 0.05, 5), PC.woodGrey, { jitter: 0.1 });
        kit.add(pole(mid, v3(b.x, b.y + ry, b.z), 0.05, 0.05, 5), PC.woodGrey, { jitter: 0.1 });
      }
    }
    const cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2, yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    const gy = ground(cx, cz);
    colliders.push({ x: cx, z: cz, hw: 0.12, hd: len / 2, rot: -yaw, yBottom: gy - 1.5, yTop: gy + h });
  }
}

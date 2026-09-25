/**
 * Camp props for the Nalati POIs (B5), each painted into a PaintKit at a world position: felt rugs (syrmak pattern),
 * a rug drying frame, barrels, an iron stove with its pipe, a two-wheeled cart (arba), a saddle on a rack, a carved
 * hitching post, a split-rail fence run and the yard set pieces. (The kazan, chests, woodpile, churns, ground saddles and
 * the eagle are the generated GLB models: modelProps.ts.) Every function returns what the caller needs (a smoke mouth, a
 * collider) and pushes nothing global.
 */
import * as THREE from 'three';
import { type PaintKit, M, pole, v3, lathe, logPainter } from './paint';
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

/**
 * A carved hitching post: a turned larch post (rings and beads), a band of red and gold paint below a carved horse-head
 * finial, set in the ground at (x, z). Returns the rail height.
 */
export function addCarvedPost(kit: PaintKit, ground: Ground, x: number, z: number, h: number, yaw: number): number {
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

// ── yard set pieces (the camp 9-angle round, gap #8) ─────────────────────────────────────────────────────────

/** a rope line between two forked posts with felt rugs thrown over it (from a to b) */
export function addRugLine(kit: PaintKit, ground: Ground, ax: number, az: number, bx: number, bz: number, pals: number[], colliders: Collider[]): void {
  const H = 1.75, ya = ground(ax, az), yb = ground(bx, bz);
  for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]] as const) {
    kit.add(pole(v3(x, y - 0.35, z), v3(x, y + H + 0.1, z), 0.06, 0.05, 6), PC.woodGrey, { foot: 0.75 });
    kit.add(pole(v3(x, y + H - 0.05, z), v3(x + 0.14, y + H + 0.25, z), 0.025, 0.02, 4), PC.woodGrey);
    kit.add(pole(v3(x, y + H - 0.05, z), v3(x - 0.14, y + H + 0.25, z), 0.025, 0.02, 4), PC.woodGrey);
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
export function addChoppingBlock(kit: PaintKit, ground: Ground, x: number, z: number, colliders: Collider[]): void {
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
export function addMilkCans(kit: PaintKit, ground: Ground, x: number, z: number, colliders: Collider[]): void {
  const rng = kit.rng;
  for (const [dx, dz, s] of [[0, 0, 1], [0.48, 0.15, 0.85], [0.2, -0.45, 0.95]] as const) {
    const px = x + dx, pz = z + dz, py = ground(px, pz);
    kit.add(lathe([[0.001, 0], [0.19, 0], [0.2, 0.32], [0.16, 0.44], [0.09, 0.5], [0.1, 0.58], [0.001, 0.58]], 12), (p) => (p.y > 0.3 && p.y < 0.34 ? PC.iron : new THREE.Color('#aeb0ae')), { matrix: M(px, py, pz, rng.range(0, 6), s), brush: 0.06 });
  }
  const bx = x - 0.5, bz = z + 0.35, by = ground(bx, bz);
  kit.add(lathe([[0.001, 0], [0.17, 0], [0.2, 0.3], [0.19, 0.3], [0.15, 0.03], [0.001, 0.03]], 12), (p) => (Math.abs(p.y - 0.08) < 0.02 || Math.abs(p.y - 0.24) < 0.02 ? PC.iron : PC.wood), { matrix: M(bx, by, bz), brush: 0.06 });
  colliders.push({ x: x + 0.2, z, hw: 0.55, hd: 0.5, rot: 0, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.6 });
}

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

/**
 * A perched golden eagle (static; the eagle hunter's bird on its perch), ~0.95 m tall at scale 1, feet at `feet`,
 * facing yaw (0 = −z). Sculpted from overlapping soft forms: a deep chest (streaked, lighter), the dark mantle, folded
 * wings built from layered feather slabs (coverts → secondaries → long primaries crossing over the tail), a fanned
 * tail, the golden nape in a ruff of pointed feathers, a heavy brow over an amber eye, the hooked beak with its yellow
 * cere, feathered "trousers" and yellow scaled feet with black talons gripping the bar.
 */
export function addEagle(kit: PaintKit, feet: THREE.Vector3, yaw: number, scale = 1.25): void {
  const m = M(feet.x, feet.y, feet.z, yaw, scale);
  const add = (g: THREE.BufferGeometry, c: THREE.Color | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color), brush = 0.06) => kit.add(g, c, { matrix: m, brush });
  const E = { mantle: new THREE.Color('#4a2f19'), chest: new THREE.Color('#6b4524'), streak: new THREE.Color('#8a5e33'), dark: new THREE.Color('#2e1d10'),
    gold: new THREE.Color('#d4a452'), goldDeep: new THREE.Color('#a8772f'), edge: new THREE.Color('#7a5836'), eye: new THREE.Color('#d98f1c') };
  // chest + belly: an egg leaning forward (forward is −z), streaked
  add(new THREE.SphereGeometry(0.16, 18, 14).scale(0.95, 1.45, 0.95).rotateX(0.3).translate(0, 0.4, -0.02), (p) => (Math.sin(p.x * 60) * Math.sin(p.y * 38) > 0.55 ? E.streak : E.chest));
  // mantle / back
  add(new THREE.SphereGeometry(0.155, 16, 12).scale(1.0, 1.3, 0.85).rotateX(0.42).translate(0, 0.44, 0.05), E.mantle);
  // neck + head: a golden nape with a ruff of pointed feathers
  add(new THREE.SphereGeometry(0.095, 14, 10).scale(1, 1.15, 1).translate(0, 0.63, -0.02), E.gold);
  add(new THREE.SphereGeometry(0.085, 14, 10).scale(0.95, 0.92, 1.15).translate(0, 0.72, -0.05), (p) => (p.z < -0.1 ? E.mantle : E.gold));
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.4;
    add(new THREE.ConeGeometry(0.026, 0.11, 5).rotateX(Math.PI / 2 - 0.5).rotateY(a).translate(Math.sin(a) * 0.07, 0.64 + (i % 2) * 0.02, Math.cos(a) * 0.06), E.goldDeep);
  }
  // brow ridge, eyes
  for (const sx of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.018, 0.05, 3, 6).rotateX(Math.PI / 2).rotateY(sx * 0.35).translate(sx * 0.045, 0.745, -0.1), E.dark);
    add(new THREE.SphereGeometry(0.014, 8, 6).translate(sx * 0.052, 0.73, -0.112), E.eye);
    add(new THREE.SphereGeometry(0.007, 6, 4).translate(sx * 0.054, 0.73, -0.124), E.dark);
  }
  // the hooked beak: cere, a tapering upper mandible bending down, the dark hook
  add(new THREE.CylinderGeometry(0.032, 0.036, 0.04, 8).rotateX(Math.PI / 2).translate(0, 0.715, -0.14), new THREE.Color('#e8c040'));
  add(pole(v3(0, 0.715, -0.155), v3(0, 0.705, -0.2), 0.03, 0.022, 8), new THREE.Color('#5a544c'));
  add(pole(v3(0, 0.705, -0.2), v3(0, 0.68, -0.222), 0.022, 0.012, 7), new THREE.Color('#2d2926'));
  add(pole(v3(0, 0.68, -0.222), v3(0, 0.655, -0.214), 0.012, 0.003, 6), new THREE.Color('#1c1a18'));
  add(pole(v3(0, 0.69, -0.15), v3(0, 0.682, -0.19), 0.02, 0.012, 6), new THREE.Color('#6b6258'));
  // folded wings: layered feather slabs down each flank, the primaries crossing over the tail
  for (const sx of [-1, 1]) {
    // coverts: a broad smooth shoulder
    add(new THREE.SphereGeometry(0.14, 12, 10).scale(0.42, 1.2, 0.95).rotateX(0.45).translate(sx * 0.13, 0.46, 0.05), (p) => (p.y > 0.5 ? E.goldDeep : E.mantle));
    for (let k = 0; k < 6; k++) {
      const len = 0.24 + k * 0.05, y0 = 0.47 - k * 0.018, z0 = 0.02 + k * 0.012;
      const g = new THREE.BoxGeometry(0.018, len, 0.075 - k * 0.004).translate(0, -len / 2, 0);
      g.rotateX(0.52 + k * 0.03).rotateZ(sx * (0.06 + k * 0.012)).translate(sx * (0.16 - k * 0.006), y0, z0);
      add(g, (p) => (p.y < 0.2 ? E.dark : E.mantle), 0.04);
    }
  }
  // tail: a narrow fan of feathers
  for (let k = -2; k <= 2; k++) {
    const g = new THREE.BoxGeometry(0.05, 0.34, 0.014).translate(0, -0.17, 0).rotateZ(k * 0.07).rotateX(0.42).translate(k * 0.018, 0.2, 0.17 + Math.abs(k) * 0.004);
    add(g, (p) => (p.y < 0.02 ? E.dark : E.edge), 0.04);
  }
  // feathered legs, yellow feet, talons round the bar (the bar runs along x at y ≈ −0.03)
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.35, 1.05).translate(sx * 0.06, 0.15, -0.03), E.streak);
    add(new THREE.CylinderGeometry(0.018, 0.02, 0.07, 6).translate(sx * 0.06, 0.05, -0.04), new THREE.Color('#e3bb3e'));
    for (const [tz, rz] of [[-0.05, -0.9], [-0.03, 0], [0.03, 0.9]] as const) {
      add(new THREE.CapsuleGeometry(0.011, 0.04, 2, 5).rotateX(Math.PI / 2 + rz * 0.6).translate(sx * 0.06, 0.012, -0.04 + tz), new THREE.Color('#e3bb3e'));
      add(new THREE.ConeGeometry(0.008, 0.035, 4).rotateX(Math.PI - rz).translate(sx * 0.06, -0.015, -0.04 + tz * 1.5), E.dark);
    }
  }
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

/**
 * The kumis corner: a tall wooden churn (pispek) with its plunger, and a leather saba (the mare's-milk bag) hanging on a
 * low tripod. (x, z) is the churn.
 */
export function addChurn(kit: PaintKit, ground: Ground, x: number, z: number, colliders: Collider[]): void {
  const y = ground(x, z);
  kit.add(lathe([[0.001, 0], [0.2, 0], [0.22, 0.1], [0.2, 0.6], [0.17, 0.95], [0.19, 1.0], [0.001, 1.0]], 14), (p) => (Math.abs(p.y - 0.2) < 0.03 || Math.abs(p.y - 0.75) < 0.03 ? PC.iron : PC.woodLight), { matrix: M(x, y, z), brush: 0.07 });
  kit.add(pole(v3(x, y + 0.9, z), v3(x + 0.03, y + 1.55, z), 0.018, 0.018, 5), PC.wood);
  kit.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10).translate(x + 0.03, y + 1.56, z), PC.wood);
  colliders.push({ x, z, hw: 0.24, hd: 0.24, rot: 0, yBottom: y - 1, yTop: y + 1.05 });
  // the saba on its tripod
  const sx = x + 1.1, sz = z + 0.2, sy = ground(sx, sz), top = v3(sx, sy + 1.25, sz);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.3; kit.add(pole(v3(sx + Math.cos(a) * 0.55, sy - 0.1, sz + Math.sin(a) * 0.55), top.clone().add(v3(-Math.cos(a) * 0.05, 0.12, -Math.sin(a) * 0.05)), 0.03, 0.025, 5), PC.woodGrey); }
  kit.add(pole(top, v3(sx, sy + 0.95, sz), 0.012, 0.012, 3), PC.leather);
  kit.add(new THREE.SphereGeometry(0.26, 14, 10).scale(1, 0.85, 0.8).translate(sx, sy + 0.66, sz), PC.leather, { brush: 0.12 });
  kit.add(new THREE.CylinderGeometry(0.05, 0.07, 0.14, 8).translate(sx, sy + 0.93, sz), new THREE.Color('#4d2e18'));
  colliders.push({ x: sx, z: sz, hw: 0.45, hd: 0.45, rot: 0, yBottom: sy - 1, yTop: sy + 1.2 });
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

/**
 * Yurt — a Kazakh felt yurt (kiiz üi) painted into a PaintKit: the white felt wall on its lattice with a red-orange
 * ornament band (a stepped ram's-horn repeat) under the eave, the domed felt roof with its own narrower band and
 * rope straps, the wooden crown ring (shangyrak) with its half-drawn felt cap, a painted wooden door with carved
 * panels and a rolled felt flap above it, a rope round the wall, and optionally a stove flue out of the crown.
 *
 *   const top = addYurt(kit, { x, y, z, rot, r: 3 }, colliders);   // rot: the way the door faces (0 = −z / south)
 *   smoke.emitter(top.flue) …                                      // when `flue: true`
 *
 * Built in local space (door at −z) then placed with one matrix. ~5 k triangles for r = 3 (the ornament band is
 * the dense part: 0.13 m columns so the motif reads at 20 m). Colliders: two crossed boxes (an octagon).
 */
import * as THREE from 'three';
import { type PaintKit, M, lathe, pole, v3 } from './paint';
import type { Collider } from '../../player/Player';

export interface YurtSpec {
  x: number; y: number; z: number;
  /** door facing (0 = −z / south) */
  rot: number;
  /** wall radius (m), 2.4–3.6 */
  r: number;
  /** a stove pipe out of the crown (smoke comes from it) */
  flue?: boolean;
  /** an older, greyer felt */
  old?: boolean;
  /** 0..2 — band colourway */
  palette?: number;
}

export interface YurtTop {
  /** the crown ring's centre (world) */
  crown: THREE.Vector3;
  /** the flue's mouth (world), when it has one */
  flue: THREE.Vector3 | null;
  /** total height above y */
  height: number;
}

export const YURT_C = {
  felt: new THREE.Color('#efe6d2'),
  feltOld: new THREE.Color('#dcd1bb'),
  feltRoof: new THREE.Color('#e6dcc6'),
  red: new THREE.Color('#b3301c'),
  redDark: new THREE.Color('#5c2014'),
  orange: new THREE.Color('#d9772a'),
  cream: new THREE.Color('#f3e6c4'),
  wood: new THREE.Color('#8a5a32'),
  woodDark: new THREE.Color('#4e331f'),
  door: new THREE.Color('#b9502a'),
  doorGold: new THREE.Color('#e3ad48'),
  rope: new THREE.Color('#6b4a2c'),
  iron: new THREE.Color('#3b3a3a'),
};

const PALETTES: { bg: THREE.Color; motif: THREE.Color; edge: THREE.Color }[] = [
  { bg: YURT_C.red, motif: YURT_C.cream, edge: YURT_C.redDark },
  { bg: YURT_C.orange, motif: YURT_C.redDark, edge: YURT_C.redDark },
  { bg: YURT_C.redDark, motif: YURT_C.orange, edge: YURT_C.red },
];

/** the band's repeat, 8 columns × 6 rows, row 0 at the bottom: E = edge line, # = motif, . = background */
const MOTIF = [
  'EEEEEEEE',
  '.##...#.',
  '.#.#.##.',
  '.##.#.#.',
  '.#...##.',
  'EEEEEEEE',
];
const COL_W = 0.13;

function bandPainter(radius: number, y0: number, h: number, pal: number): (p: THREE.Vector3) => THREE.Color {
  const P = PALETTES[pal % PALETTES.length] ?? PALETTES[0];
  const fallback = YURT_C.red;
  return (p) => {
    const ang = Math.atan2(p.x, p.z) + Math.PI;                 // 0..2π
    const col = Math.floor((ang * radius) / COL_W) % 8;
    const row = Math.min(5, Math.max(0, Math.floor(((p.y - y0) / h) * 6)));
    const ch = MOTIF[5 - row]?.charAt(col) ?? '.';
    return (ch === 'E' ? P?.edge : ch === '#' ? P?.motif : P?.bg) ?? fallback;
  };
}

export function addYurt(kit: PaintKit, s: YurtSpec, colliders: Collider[]): YurtTop {
  const R = s.r, wallH = 1.5 + (R - 3) * 0.12, rise = R * 0.55, eaveR = R + 0.2;
  const mat = M(s.x, s.y, s.z, s.rot);
  const felt = s.old === true ? YURT_C.feltOld : YURT_C.felt;
  const pal = s.palette ?? 0;
  const add = (g: THREE.BufferGeometry, c: THREE.Color | ((p: THREE.Vector3) => THREE.Color), o: { flat?: boolean; brush?: number; jitter?: number; foot?: number } = {}) => {
    kit.add(g, c, { ...o, matrix: mat });
  };

  // ── wall: felt on the lattice, a slight belly; a dark trodden skirt at the foot ──
  const segWall = Math.max(40, Math.round(R * 16));
  add(lathe([[R + 0.02, -0.25], [R + 0.03, 0.0], [R + 0.05, 0.45], [R + 0.06, 0.9], [R + 0.03, wallH]], segWall), felt, { foot: 0.72, brush: 0.05 });
  // the ornament band under the eave (its own dense lathe, 1 cm proud)
  const bandH = 0.42, bandY0 = wallH - bandH - 0.04;
  const seg = Math.round((Math.PI * 2 * (R + 0.05)) / COL_W / 8) * 8;
  const rows: [number, number][] = [];
  for (let i = 0; i <= 6; i++) rows.push([R + 0.045 + 0.01 * (i / 6), bandY0 + (bandH * i) / 6]);
  add(lathe(rows, seg), bandPainter(R + 0.05, bandY0, bandH, pal), { brush: 0.03, jitter: 0.02 });
  // a thin red stripe low on the wall, and the rope round the lattice
  add(lathe([[R + 0.05, 0.16], [R + 0.055, 0.28]], segWall), YURT_C.red, { brush: 0.04 });
  add(new THREE.TorusGeometry(R + 0.07, 0.025, 3, segWall).rotateX(Math.PI / 2).translate(0, 0.72, 0), YURT_C.rope);
  add(new THREE.TorusGeometry(R + 0.07, 0.022, 3, segWall).rotateX(Math.PI / 2).translate(0, bandY0 - 0.06, 0), YURT_C.rope);

  // ── roof: a convex felt dome from the eave to the crown ring ──
  const crownR = Math.max(0.5, R * 0.18), crownY = wallH + rise;
  const prof: [number, number][] = [];
  const NP = 7;
  for (let i = 0; i <= NP; i++) {
    const t = i / NP;
    prof.push([eaveR + (crownR - eaveR) * t, wallH - 0.08 + rise * (t + 0.22 * Math.sin(Math.PI * t) * (1 - t * 0.4))]);
  }
  const roofY = (t: number) => wallH - 0.08 + rise * (t + 0.22 * Math.sin(Math.PI * t) * (1 - t * 0.4));
  const roofR = (t: number) => eaveR + (crownR - eaveR) * t;
  add(lathe(prof, segWall), (p) => (p.y > wallH + rise * 0.8 ? YURT_C.feltRoof.clone().multiplyScalar(0.94) : YURT_C.feltRoof), { brush: 0.06 });
  // the eave's thickness: a short skirt under the roof edge
  add(lathe([[eaveR - 0.02, wallH - 0.2], [eaveR + 0.005, wallH - 0.07]], segWall), felt, {});
  // roof band: a narrower ornament ring low on the dome
  {
    const t0 = 0.07, t1 = 0.22, rr: [number, number][] = [];
    for (let i = 0; i <= 5; i++) { const t = t0 + ((t1 - t0) * i) / 5; rr.push([roofR(t) + 0.018, roofY(t) + 0.03]); }
    const y0 = roofY(t0) + 0.03, h = roofY(t1) - roofY(t0);
    const segB = Math.round((Math.PI * 2 * roofR((t0 + t1) / 2)) / COL_W / 8) * 8;
    add(lathe(rr, segB), bandPainter(roofR((t0 + t1) / 2), y0, h, pal + 1), { brush: 0.03, jitter: 0.02 });
  }
  // rope straps over the dome (8)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const sa = Math.sin(a), ca = Math.cos(a);
    for (let i = 0; i < 3; i++) {
      const t0 = 0.24 + (i / 3) * 0.72, t1 = 0.24 + ((i + 1) / 3) * 0.72;
      add(pole(v3(sa * (roofR(t0) + 0.03), roofY(t0) + 0.045, ca * (roofR(t0) + 0.03)), v3(sa * (roofR(t1) + 0.03), roofY(t1) + 0.045, ca * (roofR(t1) + 0.03)), 0.022, 0.022, 4), YURT_C.redDark);
    }
  }

  // ── crown: the shangyrak ring, its crossed arches, the felt cap half drawn over it ──
  add(new THREE.TorusGeometry(crownR, 0.08, 6, 20).rotateX(Math.PI / 2).translate(0, crownY + 0.02, 0), YURT_C.wood);
  for (const yaw of [0, Math.PI / 2]) {
    add(new THREE.TorusGeometry(crownR, 0.035, 4, 10, Math.PI).rotateY(yaw).scale(1, 0.45, 1).translate(0, crownY + 0.02, 0), YURT_C.woodDark);
  }
  // the cap (tündik): a shallow felt dome shifted back so the front half of the ring is open
  add(new THREE.SphereGeometry(crownR + 0.12, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, crownY + 0.03, crownR * 0.55), YURT_C.feltRoof, {});
  add(new THREE.CircleGeometry(crownR - 0.05, 16).rotateX(-Math.PI / 2).translate(0, crownY - 0.02, 0), YURT_C.woodDark.clone().multiplyScalar(0.35));

  // ── door (at −z): frame, painted leaf with carved panels, threshold, the rolled felt flap ──
  const dz = -(R + 0.07), dW = 0.92, dH = 1.3;
  add(new THREE.BoxGeometry(dW + 0.2, dH + 0.14, 0.14).translate(0, dH / 2 + 0.02, dz + 0.02), YURT_C.woodDark, { flat: true });
  add(new THREE.BoxGeometry(dW, dH, 0.08).translate(0, dH / 2 + 0.04, dz - 0.04), YURT_C.door, { flat: true, brush: 0.05 });
  for (const [px, py, pw, ph] of [[-0.21, 0.95, 0.3, 0.42], [0.21, 0.95, 0.3, 0.42], [-0.21, 0.4, 0.3, 0.42], [0.21, 0.4, 0.3, 0.42]] as const) {
    add(new THREE.BoxGeometry(pw, ph, 0.03).translate(px, py, dz - 0.09), YURT_C.doorGold, { flat: true });
    add(new THREE.BoxGeometry(pw - 0.1, ph - 0.1, 0.03).translate(px, py, dz - 0.1), YURT_C.red, { flat: true });
  }
  add(new THREE.BoxGeometry(dW + 0.3, 0.12, 0.34).translate(0, 0.02, dz - 0.1), YURT_C.woodDark, { flat: true });
  add(new THREE.CylinderGeometry(0.1, 0.1, dW + 0.2, 8).rotateZ(Math.PI / 2).translate(0, dH + 0.2, dz - 0.08), felt, {});
  add(new THREE.CylinderGeometry(0.105, 0.105, 0.14, 8).rotateZ(Math.PI / 2).translate(-0.3, dH + 0.2, dz - 0.08), YURT_C.red);
  add(new THREE.CylinderGeometry(0.105, 0.105, 0.14, 8).rotateZ(Math.PI / 2).translate(0.3, dH + 0.2, dz - 0.08), YURT_C.red);

  // ── flue ──
  let flue: THREE.Vector3 | null = null;
  if (s.flue === true) {
    const fx = crownR * 0.35, fz = -crownR * 0.3, top = crownY + 0.95;
    add(new THREE.CylinderGeometry(0.085, 0.085, top - (crownY - 0.6), 8).translate(fx, (top + crownY - 0.6) / 2, fz), YURT_C.iron);
    add(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 8).translate(fx, top + 0.1, fz), YURT_C.iron);
    flue = v3(fx, top + 0.2, fz).applyMatrix4(mat);
  }

  // colliders: an octagon of two crossed squares
  for (const extra of [0, Math.PI / 4]) {
    colliders.push({ x: s.x, z: s.z, hw: R * 0.93, hd: R * 0.93, rot: -(s.rot + extra), yBottom: s.y - 1, yTop: s.y + wallH + rise * 0.6 });
  }
  return { crown: v3(0, crownY, 0).applyMatrix4(mat), flue, height: crownY };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProjectileKind } from '@wildshard/engine/combat/view/projectile';
import { gloveFist, riderArm } from '@wildshard/engine/player/nalatiArms';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

import type { BowView, GripPose } from '@wildshard/kit/weapons/bow/profile';



const C = (hex: number) => new THREE.Color(hex);
const PAL = {
  lacquer: C(0x7a3a1c), lacquerDark: C(0x4a2412), ornament: C(0xe0c080), birch: C(0x9a7650), horn: C(0x2a1a10),
  bone: C(0xe6dcc2), boneDark: C(0x5a4a38), sinew: C(0xd8c8a0), leather: C(0x3c2414), leatherHi: C(0x5a3a22),
  string: C(0xd4c8a8), serving: C(0x4a3424), hornHoney: C(0x9a6a34), birchBark: C(0xd8bc92), lenticel: C(0x4a3424), gold: C(0xe0b864),
  shaft: C(0xc8a070), shaftDark: C(0x8a6440), head: C(0x3a3c40), feather: C(0xece6da), featherBar: C(0x4a3a30),
  crest: C(0xa82a1c),
};

// ───────────────────────────── geometry helpers ─────────────────────────────

/** keep only position / normal / colour (so different generators merge) */
function pnc(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}
/** paint a geometry one colour × a seeded per-vertex jitter */
function paint(g: THREE.BufferGeometry, c: THREE.Color, jitter = 0.06, seed = 7): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, out = new Float32Array(n * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = 1 - jitter + (s / 4294967296) * jitter * 2;
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return pnc(g);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The arrow: birch shaft with a red cresting band, iron leaf head, three barred feathers. TIP at the origin, shaft
 *  along +Z (`ARROW_LEN`), so a stuck one is placed at the hit point. Feathers are two-faced (no DoubleSide program). */
export const ARROW_LEN = 0.8;
export function buildArrowGeometry(): THREE.BufferGeometry {
  const L = ARROW_LEN, r = 0.0042;
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(r, r * 0.92, L - 0.07, 6, 1); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.065 + (L - 0.07) / 2);
  parts.push(paint(shaft, PAL.shaft, 0.08, 11));
  const crest = new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.05, 6, 1); crest.rotateX(Math.PI / 2); crest.translate(0, 0, L - 0.2);
  parts.push(paint(crest, PAL.crest, 0.05, 12));
  const nock = new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.014, 6, 1); nock.rotateX(Math.PI / 2); nock.translate(0, 0, L - 0.004);
  parts.push(paint(nock, PAL.shaftDark, 0.04, 13));
  // leaf head: a flattened 4-sided cone + its socket
  const head = new THREE.ConeGeometry(0.011, 0.058, 4, 1); head.rotateY(Math.PI / 4); head.scale(1, 1, 0.3); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.029);
  parts.push(paint(head, PAL.head, 0.08, 14));
  const socket = new THREE.CylinderGeometry(r * 1.05, r * 1.25, 0.018, 6, 1); socket.rotateX(Math.PI / 2); socket.translate(0, 0, 0.064);
  parts.push(paint(socket, PAL.head, 0.05, 15));
  // three feathers, each a two-faced swept blade with a dark bar
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 6, z0 = L - 0.035, len = 0.13;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = z0 - t * len;
      const h = 0.017 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.35 * t * t); // tall at the back, tapering forward
      const bar = t > 0.45 && t < 0.62 ? 1 : 0;
      const c = bar ? PAL.featherBar : PAL.feather;
      pos.push(0, r, z, 0, r + h, z - 0.012 * t);
      col.push(c.r * 0.92, c.g * 0.92, c.b * 0.92, c.r, c.g, c.b);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    g.rotateZ((k / 3) * Math.PI * 2);
    parts.push(g);
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

/** the arrows' one painterly material (the world pool's; E348: the Model Explorer's arrow card makes its own) */
export function arrowMaterial(sky: Sky): THREE.MeshLambertMaterial { return painterlyMaterial(sky, { rim: 0.45 }); }

/** the arrow as a `Projectiles` kind (the world pool) — combat.md §C numbers */
export function arrowKind(sky: Sky): ProjectileKind {
  return {
    geometry: buildArrowGeometry(), material: arrowMaterial(sky),
    length: ARROW_LEN, gravity: 5, drag: 0.015, windCoupling: 0.25, bury: 0.09, recover: 0.7, maxFlying: 8, maxStuck: 64,
  };
}

// ───────────────────────────── the bow's shape ─────────────────────────────

const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _b3 = new THREE.Vector3();

/* Bow-local frame: grip centre at the origin, +Y up the bow, −Z = where the arrow flies (the bow's back), +Z toward the
 * archer (the belly), +X the archer's right (the arrow rides on the right: a thumb draw). Each limb is the grip, a
 * working limb bending at curvature κ(p) toward the archer, then the stiff siyah (ear) kinked forward by SIYAH_KINK. */
const GRIP_H = 0.07, LIMB_W = 0.42, SIYAH = 0.15, SIYAH_KINK = 0.95;
const KAPPA_REST = 2.1, KAPPA_DRAW = 1.35;
const BRACE_Z = 0.163, DRAW_LEN = 0.58; // string at rest / pulled back at full draw (bow-local)
const ARROW_Y = 0.058; // the arrow's line past the grip: on top of the left thumb, right of the bow (a thumb draw)
const BOW_LEN = GRIP_H + LIMB_W + SIYAH;
const RADIAL = 16, STRING_RADIAL = 6, STRING_R = 0.0021;
/** each string leg: tip → the serving's start (two rings a hair apart: a crisp colour change) → the nock */
const STRING_RINGS = 4, SERVING = 0.085;

/** the limb centreline at arc length u (≥ 0) from the grip, for draw p; sign +1 upper, −1 lower. Writes pos + tangent. */
function limbAt(u: number, sign: number, p: number, pos: THREE.Vector3, tan: THREE.Vector3): void {
  const k = KAPPA_REST + KAPPA_DRAW * p;
  if (u <= GRIP_H) { pos.set(0, sign * u, 0); tan.set(0, sign, 0); return; }
  const w = Math.min(u - GRIP_H, LIMB_W);
  const th = k * w;
  let y = GRIP_H + Math.sin(th) / k, z = (1 - Math.cos(th)) / k;
  let a = th;
  if (u > GRIP_H + LIMB_W) {
    a = k * LIMB_W - SIYAH_KINK;
    const s = u - GRIP_H - LIMB_W;
    y += Math.cos(a) * s; z += Math.sin(a) * s;
  }
  pos.set(0, sign * y, z); tan.set(0, sign * Math.cos(a), Math.sin(a));
}
/** half width (x) and half thickness (belly-back) at u */
function limbSection(u: number): [number, number] {
  if (u <= GRIP_H) { const g = 1 - (u / GRIP_H) ** 2; return [0.016 + 0.002 * g, 0.018 + 0.006 * g]; }
  const w = u - GRIP_H;
  const bind = binding(w) ? 0.0013 : 0;                                         // sinew cord stands proud
  if (w <= LIMB_W) { const t = w / LIMB_W; return [0.019 - 0.006 * t + bind, 0.013 - 0.004 * t + bind]; }
  const t = (w - LIMB_W) / SIYAH;
  const bridge = 0.0045 * Math.exp(-(((t - 0.1) / 0.07) ** 2));               // the string bridge on the ear's belly
  return [0.011 - 0.003 * t, 0.015 - 0.004 * t + bridge];
}
/** the sinew bindings: where the grip meets the limb, and where the limb meets the bone ear */
function binding(w: number): boolean { return (w > 0 && w < 0.018) || Math.abs(w - LIMB_W) < 0.014; }
/** the leather grip's spiral wrap, as a radius multiplier */
function gripRidge(u: number, ph: number, sign: number): number { return u < GRIP_H ? 1 + 0.07 * Math.max(0, Math.sin(u * 280 * sign + ph * 2)) ** 3 : 1; }
/** build-time value noise for the painted grain */
function grain(x: number, y: number): number { const h = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }
/** the painted colour at arc length u, ring angle φ (sin φ > 0 = belly, toward the archer) */
/** the colours the limbs + string are painted from (`Bow.setStyle` swaps the set and repaints) */
interface LimbPalette { leather: THREE.Color; leatherHi: THREE.Color; sinew: THREE.Color; bone: THREE.Color; boneDark: THREE.Color; birchBark: THREE.Color; lenticel: THREE.Color; lacquer: THREE.Color; gold: THREE.Color; horn: THREE.Color; hornHoney: THREE.Color; ornament: THREE.Color; string: THREE.Color; serving: THREE.Color }
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
const LIMB_STYLES: Record<BowStyle, LimbPalette> = {
  recurve: { leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: PAL.sinew, bone: PAL.bone, boneDark: PAL.boneDark, birchBark: PAL.birchBark, lenticel: PAL.lenticel, lacquer: PAL.lacquer, gold: PAL.gold, horn: PAL.horn, hornHoney: PAL.hornHoney, ornament: PAL.ornament, string: PAL.string, serving: PAL.serving },
  // the Golden Bow (the Golden King's reward, src/shards/nalati-grasslands/weapons/GoldenBow.ts): gold-sheathed limbs, the scroll burnished bright
  // (a touch over 1: it catches the bloom), ivory ears, a string of light
  golden: {
    leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: C(0xf0c060), bone: C(0xf4e6c0), boneDark: C(0x8a6a30),
    birchBark: C(0xc8902a), lenticel: C(0x6a4410), lacquer: C(0xb87818), gold: new THREE.Color(1.6, 1.2, 0.5),
    horn: C(0x8a5210), hornHoney: C(0xe0a030), ornament: new THREE.Color(1.5, 1.15, 0.45),
    string: new THREE.Color(3.2, 2.6, 1.3), serving: C(0xd8a040),
  },
  // the SKY-WOLF skin (Kokbori's drop, B15 src/shards/nalati-grasslands/weapons/nalatiSkins.ts): blue-grey horn limbs, wolf-bone ears, a silver string
  'sky-wolf': {
    leather: C(0x2e3440), leatherHi: C(0x56606e), sinew: C(0xb8c4d0), bone: C(0xe6ecf2), boneDark: C(0x6a7684),
    birchBark: C(0x7c8a9a), lenticel: C(0x3a4452), lacquer: C(0x4a5a6e), gold: C(0xc8d4e0),
    horn: C(0x3c4a5c), hornHoney: C(0x8a9cb2), ornament: C(0xd8e4f0),
    string: new THREE.Color(1.6, 1.7, 1.9), serving: C(0x9aa6b4),
  },
};
let LIMB: LimbPalette = LIMB_STYLES.recurve;

function limbColor(out: number[], u: number, phi: number, sign: number): void {
  const belly = Math.sin(phi);
  const w = u - GRIP_H;
  if (u <= GRIP_H) { // leather grip, spiral-wrapped: the ridge catches light, the groove is dark
    const wrap = Math.max(0, Math.sin(u * 280 * sign + phi * 2)) ** 3;
    mix3(out, LIMB.leather, LIMB.leatherHi, 0.15 + wrap * 0.75, 0.85 + 0.15 * wrap); return;
  }
  if (binding(w)) { // sinew cord: tight turns, pale where they bulge
    const b = Math.max(0, Math.sin(u * 1500 * sign + phi)) ** 2;
    mix3(out, LIMB.sinew, LIMB.bone, b * 0.5, 0.78 + 0.22 * b); return;
  }
  if (w > LIMB_W) { // bone ear: warm cream with grain, the nock groove dark at the tip, the bridge a shade darker
    const t = (w - LIMB_W) / SIYAH, g = grain(u * 90, phi * 2);
    const tip = u > BOW_LEN - 0.018 ? 0.85 : 0;
    mix3(out, LIMB.bone, LIMB.boneDark, Math.max(tip, 0.12 * g + 0.25 * Math.exp(-(((t - 0.1) / 0.07) ** 2)) * Math.max(0, belly)));
    return;
  }
  const t = w / LIMB_W;
  if (belly < -0.38) { // the back: birch bark, pale, with dark lenticel dashes across the limb
    const len = grain(u * 170, phi * 1.5 + sign * 7);
    const dash = len > 0.78 ? 1 : 0;
    mix3(out, LIMB.birchBark, LIMB.lenticel, dash * 0.85 + 0.12 * grain(u * 30, phi), 0.92 + 0.08 * grain(u * 60, 3));
    return;
  }
  if (belly < 0.38) { // the sides: sinew under red-brown lacquer, a thin gold rule along the belly edge
    const rule = Math.abs(belly - 0.3) < 0.09 ? 1 : 0;
    mix3(out, LIMB.lacquer, LIMB.gold, rule * 0.85, 0.9 + 0.1 * grain(u * 40, phi * 3)); return;
  }
  // the belly: horn — honey and near-black streaks running along the limb — with the painted ram's-horn scroll near
  // the grip and a fine centre line out to the ear
  const streak = 0.5 + 0.5 * Math.sin(u * 60 + 3 * Math.sin(u * 9 + sign) + phi * 3);
  let orn = 0;
  if (t > 0.05 && t < 0.42) {
    const sAl = (t - 0.05) / 0.37;                       // 0..1 along the ornament
    const across = (Math.cos(phi) / 0.92) * 0.5 + 0.5;  // 0..1 across the belly
    const curl = 0.5 + 0.3 * Math.sin(sAl * Math.PI * 3.2);
    orn = Math.max(0, 1 - Math.abs(across - curl) * 5) * (sAl < 0.95 ? 1 : 0);
    const bay = Math.hypot((across - (curl > 0.5 ? 0.22 : 0.78)) * 1.4, ((sAl * 3.2 * 0.5) % 1) - 0.5);
    orn = Math.max(orn, bay < 0.16 ? 0.9 : 0);          // a dot in each bay of the scroll
    if (sAl < 0.04 || sAl > 0.92) orn = Math.max(orn, 0.95); // border bars
  } else if (t >= 0.42 && t < 0.97) orn = Math.max(0, 1 - Math.abs(Math.cos(phi)) * 5) * 0.75;
  const hornR = LIMB.horn.r + (LIMB.hornHoney.r - LIMB.horn.r) * streak, hornG = LIMB.horn.g + (LIMB.hornHoney.g - LIMB.horn.g) * streak, hornB = LIMB.horn.b + (LIMB.hornHoney.b - LIMB.horn.b) * streak;
  const o = Math.min(1, orn);
  out.push(hornR + (LIMB.ornament.r - hornR) * o, hornG + (LIMB.ornament.g - hornG) * o, hornB + (LIMB.ornament.b - hornB) * o);
}

/** The bow + the left fist: one geometry. The first `dynVerts` vertices (limbs + string) are rewritten by `shape(p)`. */
class BowMesh {
  readonly geometry = new THREE.BufferGeometry();
  readonly dynVerts: number;
  /** upper / lower string anchor (just inside the tips), the nock — bow-local, refreshed by `shape` */
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly ringU: number[] = [];
  private readonly ringSign: number[] = [];
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly limbVerts: number;
  private lastP = -1; private lastNock = -1;

  constructor(staticParts: THREE.BufferGeometry[]) {
    // rings from the lower tip to the upper tip (signed arc length); denser where the ornament is
    for (const sign of [-1, 1]) {
      const us: number[] = [];
      for (let u = 0; u <= BOW_LEN + 1e-6; u += u < GRIP_H ? 0.01 : u < GRIP_H + LIMB_W * 0.45 ? 0.0045 : u < GRIP_H + LIMB_W ? 0.008 : 0.01) us.push(Math.min(u, BOW_LEN));
      if ((us[us.length - 1] ?? 0) < BOW_LEN) us.push(BOW_LEN);
      if (sign < 0) { for (let i = us.length - 1; i >= 1; i--) { this.ringU.push(us[i] ?? 0); this.ringSign.push(-1); } }
      else for (const u of us) { this.ringU.push(u); this.ringSign.push(1); }
    }
    const rings = this.ringU.length;
    this.limbVerts = rings * (RADIAL + 1) + 2; // + the two tip caps
    const stringVerts = 2 * STRING_RINGS * STRING_RADIAL;
    this.dynVerts = this.limbVerts + stringVerts;
    // static parts appended after the dynamic range
    const stat = mergeGeometries(staticParts, false);
    const statVerts = stat.getAttribute('position').count;
    const total = this.dynVerts + statVerts;
    this.pos = new Float32Array(total * 3); this.nrm = new Float32Array(total * 3);
    const col: number[] = [];
    const idx: number[] = [];
    // limb colours + indices
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      for (let k = 0; k <= RADIAL; k++) limbColor(col, u, (k / RADIAL) * Math.PI * 2, sign);
    }
    mix3(col, LIMB.boneDark, LIMB.boneDark, 0); mix3(col, LIMB.boneDark, LIMB.boneDark, 0); // caps
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < RADIAL; k++) {
      const a = r * (RADIAL + 1) + k, b = a + RADIAL + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const capBot = rings * (RADIAL + 1), capTop = capBot + 1, lastRing = (rings - 1) * (RADIAL + 1);
    for (let k = 0; k < RADIAL; k++) { idx.push(capBot, k + 1, k); idx.push(capTop, lastRing + k, lastRing + k + 1); }
    // string: two legs × STRING_RINGS rings — linen from the tips, a dark serving over the last SERVING m to the nock
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
      const serv = ring >= 2;
      mix3(col, serv ? LIMB.serving : LIMB.string, serv ? LIMB.serving : LIMB.string, 0, 0.9 + 0.1 * (k % 2));
    }
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS - 1; ring++) {
      const o = this.limbVerts + (leg * STRING_RINGS + ring) * STRING_RADIAL;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const a = o + k, a1 = o + ((k + 1) % STRING_RADIAL), b = a + STRING_RADIAL, b1 = a1 + STRING_RADIAL;
        idx.push(a, a1, b, a1, b1, b);
      }
    }
    // static
    const sp = stat.getAttribute('position'), sn = stat.getAttribute('normal'), sc = stat.getAttribute('color');
    for (let i = 0; i < statVerts; i++) {
      const j = (this.dynVerts + i) * 3;
      this.pos[j] = sp.getX(i); this.pos[j + 1] = sp.getY(i); this.pos[j + 2] = sp.getZ(i);
      this.nrm[j] = sn.getX(i); this.nrm[j + 1] = sn.getY(i); this.nrm[j + 2] = sn.getZ(i);
      col.push(sc.getX(i), sc.getY(i), sc.getZ(i));
    }
    const si = stat.getIndex();
    if (si) for (let i = 0; i < si.count; i++) idx.push(si.getX(i) + this.dynVerts);
    else for (let i = 0; i < statVerts; i++) idx.push(i + this.dynVerts);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr = new THREE.BufferAttribute(this.nrm, 3); this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.nrmAttr);
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.geometry.setIndex(idx);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.shape(0, 0);
  }

  /** repaint the limbs + string from a style's palette (the fist, after them, keeps its colours) */
  repaint(style: BowStyle): void {
    LIMB = LIMB_STYLES[style];
    const col: number[] = [];
    for (let r = 0; r < this.ringU.length; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      for (let k = 0; k <= RADIAL; k++) limbColor(col, u, (k / RADIAL) * Math.PI * 2, sign);
    }
    mix3(col, LIMB.boneDark, LIMB.boneDark, 0); mix3(col, LIMB.boneDark, LIMB.boneDark, 0);
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
      const serv = ring >= 2;
      mix3(col, serv ? LIMB.serving : LIMB.string, serv ? LIMB.serving : LIMB.string, 0, 0.9 + 0.1 * (k % 2));
    }
    const attr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    (attr.array as Float32Array).set(col, 0);
    attr.clearUpdateRanges(); attr.addUpdateRange(0, col.length); attr.needsUpdate = true;
    LIMB = LIMB_STYLES.recurve;
  }

  /** bend the limbs for draw `p` (0..1) and pull the string to `nockDraw` (0 = braced, 1 = full, < 0 overshoot) */
  shape(p: number, nockDraw: number): void {
    const pc = Math.max(0, Math.min(1.08, p));
    if (Math.abs(pc - this.lastP) < 0.0015 && Math.abs(nockDraw - this.lastNock) < 0.0015) return;
    this.lastP = pc; this.lastNock = nockDraw;
    const P = this.pos, N = this.nrm;
    const c = _b1, t = _b2, n = _b3;
    const rings = this.ringU.length;
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      limbAt(u, sign, pc, c, t);
      // section frame: B = +X, Nb = belly direction (⊥ tangent in YZ, toward the archer for the upper limb)
      n.set(0, -t.z * sign, t.y * sign);
      const [hw, ht] = limbSection(u);
      for (let k = 0; k <= RADIAL; k++) {
        const ph = (k / RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const j = (r * (RADIAL + 1) + k) * 3;
        const rr = gripRidge(u, ph, sign);
        P[j] = cp * hw * rr; P[j + 1] = c.y + n.y * sp * ht * rr; P[j + 2] = c.z + n.z * sp * ht * rr;
        const ex = cp / hw, en = sp / ht, l = Math.hypot(ex, en) || 1;
        N[j] = ex / l; N[j + 1] = (n.y * en) / l; N[j + 2] = (n.z * en) / l;
      }
      if (r === 0 || r === rings - 1) { // caps
        const j = (rings * (RADIAL + 1) + (r === 0 ? 0 : 1)) * 3;
        P[j] = 0; P[j + 1] = c.y + t.y * 0.004; P[j + 2] = c.z + t.z * 0.004;
        N[j] = 0; N[j + 1] = t.y; N[j + 2] = t.z;
      }
    }
    // string anchors: 1.2 cm in from each tip, on the belly face
    limbAt(BOW_LEN - 0.012, 1, pc, this.tipTop, t); this.tipTop.z += 0.006;
    limbAt(BOW_LEN - 0.012, -1, pc, this.tipBot, t); this.tipBot.z += 0.006;
    const braceZ = (this.tipTop.z + this.tipBot.z) / 2;
    this.nock.set(0, ARROW_Y - 0.004, braceZ + (BRACE_Z + DRAW_LEN - braceZ) * Math.max(-0.12, nockDraw));
    this.nock.z = Math.max(this.nock.z, braceZ - 0.03);
    this.writeLeg(0, this.tipBot, this.nock);
    this.writeLeg(1, this.tipTop, this.nock);
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.dynVerts * 3); this.posAttr.needsUpdate = true;
    this.nrmAttr.clearUpdateRanges(); this.nrmAttr.addUpdateRange(0, this.dynVerts * 3); this.nrmAttr.needsUpdate = true;
  }

  private writeLeg(leg: number, a: THREE.Vector3, b: THREE.Vector3): void {
    const d = _b1.subVectors(b, a).normalize();
    const e1 = _b2.set(1, 0, 0); e1.addScaledVector(d, -e1.dot(d)).normalize();
    const e2 = _b3.crossVectors(d, e1);
    const o = this.limbVerts + leg * STRING_RINGS * STRING_RADIAL;
    const len = a.distanceTo(b), sv = Math.max(0, 1 - SERVING / Math.max(len, 1e-3));
    const at = [0, Math.max(0, sv - 0.004), sv, 1];
    for (let ring = 0; ring < STRING_RINGS; ring++) {
      const f = at[ring] ?? 1, rad = STRING_R * (ring >= 2 ? 1.3 : 1);
      const cx = a.x + (b.x - a.x) * f, cy = a.y + (b.y - a.y) * f, cz = a.z + (b.z - a.z) * f;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const ph = (k / STRING_RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const j = (o + ring * STRING_RADIAL + k) * 3;
        const nx = e1.x * cp + e2.x * sp, ny = e1.y * cp + e2.y * sp, nz = e1.z * cp + e2.z * sp;
        this.pos[j] = cx + nx * rad; this.pos[j + 1] = cy + ny * rad; this.pos[j + 2] = cz + nz * rad;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
      }
    }
  }
}

// ───────────────────────────── the drop arc ─────────────────────────────

/** a camera-space pose of the bow's grip: position + aim point (−Z of the bow points at it) + cant (roll, rad) */

/** the fists (nalatiArms.ts): the left closed on the grip, the right a tight thumb-draw fist hooked on the string */
const L_FIST = { R: 0.021, mirror: true, yaw: -0.32 };
const R_FIST = { R: 0.009, thumbRing: true, yaw: 0.55 };
/** the drawing hand is pronated (a thumb draw: the back of the hand and the knuckles up toward the eye), rolled this far
 *  about its forearm; its thumb hook (`Fist.hook`) sits on the string just under the arrow's nock */
const R_FIST_ROLL = 1.35;
/** the right forearm keeps this heading (rig space) wherever the hand is — the elbow follows the hand, so the arm never
 *  stretches forward to the string (the old "reaching" glitch); portrait turns it further down */
/** the re-nock: follow-through (the hand flies back off the string), down to the quiver at the hip, back up with an arrow */

/* Poses in rig space (camera space / VM_SCALE). REST = the bow lowered and canted (style-B mockup: the left fist lower
 * right, no arrow). DRAWN = the fist right of centre, the bow canted ~20°, the arrow converging on the crosshair a
 * couple of metres out so it reads as pointing at it (combat-C). Portrait phones get their own (narrower frame). */
/** the viewmodel's shade-side fill (painterly `shade`; 1 = the world's) */
export const VM_SHADE = 2.4;
export const POSE = {
  rest: { pos: V(0.34, -0.42, -0.86), aim: V(-0.1, 0.25, -4), cant: -0.62, pitch: -0.14 },
  drawn: { pos: V(0.22, -0.17, -1.12), aim: V(0, 0, -5.5), cant: -0.36, pitch: 0 },
  restPort: { pos: V(0.17, -0.5, -0.9), aim: V(-0.05, 0.12, -4), cant: -0.5, pitch: -0.12 },
  drawnPort: { pos: V(0.07, -0.1, -1.08), aim: V(0, 0, -5.5), cant: -0.3, pitch: 0 },
  /** AIM (N18): down the arrow — the bow comes in toward the centre line and more upright, the fist BELOW the crosshair
   *  (the mark stays clear over it), the arrow rising from the anchor to cross the crosshair ~7–8 m out (the aim point is
   *  offset by the arrow's rest, ARROW_X / ARROW_Y, so it is the SHAFT that points there). Picked from live variants
   *  (dev/nalati-bow.html's `__wildshard.world.pose`): nearer / higher put the fist over the mark */
  aim: { pos: V(0.12, -0.24, -1.15), aim: V(-0.02, -0.058, -7), cant: -0.32, pitch: 0 },
  aimPort: { pos: V(0.04, -0.2, -1.15), aim: V(-0.02, -0.058, -8), cant: -0.22, pitch: 0 },
} satisfies Record<string, GripPose>;

/** the viewmodel's painterly look (its one program): the rim, the bands, the cool fill on the shade side */
const VM_LOOK = { rim: 0.55, bands: 0.7, shade: VM_SHADE } as const;

/**
 * The Model Explorer's card (src/shards/nalati-grasslands/models/gear.ts): the braced bow and the left glove on it (the
 * bow's one mesh, `BowMesh`, as the viewmodel builds it) in a style's paint — the recurve, the Golden King's gold, the
 * Sky-Wolf skin — on its own painterly material, without a bow in your hands.
 */
export function bowSpecimen(sky: Sky, style: BowStyle): THREE.Group {
  const bow = new BowMesh([gloveFist(L_FIST).geometry]);
  bow.repaint(style);
  const m = new THREE.Mesh(bow.geometry, painterlyMaterial(sky, VM_LOOK));
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  return g;
}


export function buildRecurve(sky: Sky): BowView {
    // one painterly program for the whole viewmodel; drawn after the depth clear (renderOrder 999 / 1000, like Crossbow)
    // shade > 1: the painted sky tint is ADDED on the shade side (painterly.ts), so it doubles as the viewmodel's cool fill —
    // an arm turned away from the sun reads as a cool-shadowed sleeve, not a black hole
    const mat = painterlyMaterial(sky, { ...VM_LOOK, transparent: true, depthWrite: true });
    const lf = gloveFist(L_FIST), rf = gloveFist(R_FIST);

    const roll = new THREE.Quaternion().setFromAxisAngle(rf.wristDir, R_FIST_ROLL); // pronate about the forearm itself, so the forearm keeps its heading
    const mesh = new BowMesh([lf.geometry]);

    const nocked = new THREE.Mesh(buildArrowGeometry(), mat);
    const rHand = new THREE.Mesh(rf.geometry, mat);
    const lSleeve = new THREE.Mesh(riderArm(1.0, 1), mat);
    const rSleeve = new THREE.Mesh(riderArm(0.9, 2), mat);

    return { mat, mesh, nocked, rHand, lSleeve, rSleeve, lWrist: lf.wrist, rWrist: rf.wrist, rHook: rf.hook, rWristDir: rf.wristDir, roll };
}

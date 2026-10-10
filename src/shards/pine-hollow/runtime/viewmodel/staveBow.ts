import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BowView, GripPose } from '@wildshard/engine/combat/view/bowProfile';
import { gloveFist, riderArm, type FistOpts } from '@wildshard/engine/player/nalatiArms';
import { withArmPalette, type ArmPaletteRow } from './gloveHands';

/**
 * A stave bow in first person (SHARD-PLATFORM M3, the viewmodel system): one wooden stave that bends through its draw, its
 * string, a nocked arrow, two gloved fists and two sleeves, for the platform bow's view strategy (BowView). The shard's row
 * (StaveBowLook) holds the stave's proportions, its bend and its colours; the stave is painted as a self bow — a pale
 * sapwood back, a streaked heartwood belly with pin knots, a leather grip with an inlaid band, horn nocks.
 *
 *   arrowGeometry(look)            an arrow: a shaft, bindings, a nock, a bodkin head, three feathers (TIP at the origin, +Z)
 *   new StaveBowMesh(look, parts)  the stave + string (rewritten by `shape(draw, nock)`) merged with static parts (a fist)
 *   staveBowView(look, material)   the whole BowView: the stave with the left fist on it, the nocked arrow, the right fist
 *                                  and both sleeves, in the look's hand palette
 *   bowPoses(rows)                 a look's grip poses (triples) as the platform's GripPose
 */

/** A stave bow's colours (sRGB hex): the sapwood back, the heartwood belly, horn nocks, the leather grip and its inlay, the string. */
export interface StaveBowPalette {
  readonly sap: number; readonly sapDark: number; readonly heart: number; readonly heartDark: number; readonly heartHi: number;
  readonly horn: number; readonly hornHi: number; readonly leather: number; readonly leatherHi: number; readonly amber: number;
  readonly string: number; readonly serving: number;
}
/** An arrow as data: its length and its colours (sRGB hex). */
export interface ArrowLook {
  readonly length: number;
  readonly shaft: number; readonly shaftDark: number; readonly binding: number; readonly head: number;
  readonly feather: number; readonly featherBar: number;
}
/** A fist on the bow: nalatiArms.gloveFist's options. */
export type StaveFist = Readonly<FistOpts>;
/** A stave bow as data. Bow-local frame: the grip centre at the origin, +Y up the bow, −Z where the arrow flies (the back),
 *  +Z toward the archer (the belly), +X the archer's right; the arrow rests left of the grip. */
export interface StaveBowLook {
  /** the stiff grip's half length, the working limb's length and the horn nock's (m) */
  readonly gripH: number; readonly limbW: number; readonly nockL: number;
  /** the limbs' bend (1/m) at rest and its rise at full draw */
  readonly kappaRest: number; readonly kappaDraw: number;
  /** the braced string's distance from the grip and the draw length (m) */
  readonly braceZ: number; readonly drawLen: number;
  /** the arrow's rest beside the grip (m) */
  readonly arrowX: number; readonly arrowY: number;
  /** segments round the stave and round the string, the string's radius and its served length at the nock (m) */
  readonly radial: number; readonly stringRadial: number; readonly stringR: number; readonly serving: number;
  readonly palette: StaveBowPalette;
  /** the arrow nocked on the string */
  readonly arrow: ArrowLook;
  /** the gloves' and sleeves' palette over the arm builder's */
  readonly hands: ArmPaletteRow;
  /** the left fist round the grip, the right fist on the string, and the right fist's roll about its wrist (rad) */
  readonly leftFist: StaveFist; readonly rightFist: StaveFist; readonly rightRoll: number;
  /** each sleeve's length (m) and fold seed (nalatiArms.riderArm) */
  readonly leftSleeve: readonly [number, number]; readonly rightSleeve: readonly [number, number];
}
/** A grip pose as data: the bow's place and aim point in rig space, its cant and pitch. */
export interface GripPoseRow { readonly pos: readonly [number, number, number]; readonly aim: readonly [number, number, number]; readonly cant: number; readonly pitch: number }

const STRING_RINGS = 4;

// ───────────────────────────── geometry helpers ─────────────────────────────

function pnc(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}
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
/** A planar uv from the vertex positions (the shared program samples its 1×1 fillers; a uv keeps the TBN finite). */
export function planarUv(g: THREE.BufferGeometry, k = 8): THREE.BufferGeometry {
  const p = g.getAttribute('position'), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * k; uv[i * 2 + 1] = p.getY(i) * k; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** The arrow: a shaft, a sinew-bound bodkin head, three feathers (the first the cock feather, `featherBar`). TIP at the
 *  origin, shaft along +Z (`look.length`) — the projectile system's convention. Feathers two-faced (no DoubleSide program). */
export function arrowGeometry(look: ArrowLook): THREE.BufferGeometry {
  const L = look.length, r = 0.0045;
  const shaftC = new THREE.Color(look.shaft), shaftDark = new THREE.Color(look.shaftDark), binding = new THREE.Color(look.binding), headC = new THREE.Color(look.head);
  const feather = new THREE.Color(look.feather), featherBar = new THREE.Color(look.featherBar);
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(r, r * 0.92, L - 0.07, 6, 1); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.065 + (L - 0.07) / 2);
  parts.push(paint(shaft, shaftC, 0.08, 11));
  for (const z of [0.075, L - 0.19, L - 0.03]) { const b = new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.012, 6, 1); b.rotateX(Math.PI / 2); b.translate(0, 0, z); parts.push(paint(b, binding, 0.05, 12)); }
  const nock = new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.014, 6, 1); nock.rotateX(Math.PI / 2); nock.translate(0, 0, L - 0.004);
  parts.push(paint(nock, shaftDark, 0.04, 13));
  const head = new THREE.ConeGeometry(0.0085, 0.062, 4, 1); head.rotateY(Math.PI / 4); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.031);
  parts.push(paint(head, headC, 0.08, 14));
  const socket = new THREE.CylinderGeometry(r * 1.05, r * 1.3, 0.02, 6, 1); socket.rotateX(Math.PI / 2); socket.translate(0, 0, 0.066);
  parts.push(paint(socket, headC, 0.05, 15));
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 6, z0 = L - 0.04, len = 0.14;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = z0 - t * len;
      const h = 0.016 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.35 * t * t);
      const c = k === 0 ? featherBar : feather;
      pos.push(0, r, z, 0, r + h, z - 0.012 * t);
      col.push(c.r * 0.9, c.g * 0.9, c.b * 0.9, c.r, c.g, c.b);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    g.rotateZ((k / 3) * Math.PI * 2);
    parts.push(g);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────────── the stave's shape ─────────────────────────────

const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _b3 = new THREE.Vector3(), _c1 = new THREE.Color();

function grain(x: number, y: number): number { const h = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }
type Pal = Record<keyof StaveBowPalette, THREE.Color>;

/** The stave and its string with the static parts merged after them: one geometry. The first `dynVerts` vertices (limbs +
 *  string) are rewritten by `shape(draw, nock)`. Each limb: the stiff grip, then a working limb of near-constant bend κ(p)
 *  toward the archer, then the horn nock. */
export class StaveBowMesh {
  readonly geometry = new THREE.BufferGeometry();
  readonly dynVerts: number;
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly look: StaveBowLook;
  private readonly bowLen: number;
  private readonly ringU: number[] = [];
  private readonly ringSign: number[] = [];
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly limbVerts: number;
  private lastP = -1; private lastNock = -1;

  constructor(look: StaveBowLook, staticParts: THREE.BufferGeometry[]) {
    this.look = look;
    const { gripH: GRIP_H, limbW: LIMB_W, nockL: NOCK_L, radial: RADIAL, stringRadial: STRING_RADIAL } = look;
    const BOW_LEN = GRIP_H + LIMB_W + NOCK_L;
    this.bowLen = BOW_LEN;
    const L = look.palette, C = (hex: number): THREE.Color => new THREE.Color(hex);
    const PAL: Pal = {
      sap: C(L.sap), sapDark: C(L.sapDark), heart: C(L.heart), heartDark: C(L.heartDark), heartHi: C(L.heartHi), horn: C(L.horn), hornHi: C(L.hornHi),
      leather: C(L.leather), leatherHi: C(L.leatherHi), amber: C(L.amber), string: C(L.string), serving: C(L.serving),
    };
    for (const sign of [-1, 1]) {
      const us: number[] = [];
      for (let u = 0; u <= BOW_LEN + 1e-6; u += u < GRIP_H ? 0.006 : u < GRIP_H + LIMB_W ? 0.012 : 0.006) us.push(Math.min(u, BOW_LEN));
      if ((us[us.length - 1] ?? 0) < BOW_LEN) us.push(BOW_LEN);
      if (sign < 0) { for (let i = us.length - 1; i >= 1; i--) { this.ringU.push(us[i] ?? 0); this.ringSign.push(-1); } }
      else for (const u of us) { this.ringU.push(u); this.ringSign.push(1); }
    }
    const rings = this.ringU.length;
    this.limbVerts = rings * (RADIAL + 1) + 2;
    const stringVerts = 2 * STRING_RINGS * STRING_RADIAL;
    this.dynVerts = this.limbVerts + stringVerts;
    const stat = mergeGeometries(staticParts, false);
    const statVerts = stat.getAttribute('position').count;
    const total = this.dynVerts + statVerts;
    this.pos = new Float32Array(total * 3); this.nrm = new Float32Array(total * 3);
    const col: number[] = [], uv: number[] = [];
    const idx: number[] = [];
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      for (let k = 0; k <= RADIAL; k++) { this.limbColor(PAL, col, u, (k / RADIAL) * Math.PI * 2, sign); uv.push(k / RADIAL, u * sign * 6); }
    }
    mix3(col, PAL.horn, PAL.horn, 0); mix3(col, PAL.horn, PAL.horn, 0); uv.push(0, 0, 0, 1);
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < RADIAL; k++) {
      const a = r * (RADIAL + 1) + k, b = a + RADIAL + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const capBot = rings * (RADIAL + 1), capTop = capBot + 1, lastRing = (rings - 1) * (RADIAL + 1);
    for (let k = 0; k < RADIAL; k++) { idx.push(capBot, k + 1, k); idx.push(capTop, lastRing + k, lastRing + k + 1); }
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
      const serv = ring >= 2;
      mix3(col, serv ? PAL.serving : PAL.string, serv ? PAL.serving : PAL.string, 0, 0.9 + 0.1 * (k % 2));
      uv.push(k / STRING_RADIAL, ring * 3);
    }
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS - 1; ring++) {
      const o = this.limbVerts + (leg * STRING_RINGS + ring) * STRING_RADIAL;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const a = o + k, a1 = o + ((k + 1) % STRING_RADIAL), b = a + STRING_RADIAL, b1 = a1 + STRING_RADIAL;
        idx.push(a, a1, b, a1, b1, b);
      }
    }
    const sp = stat.getAttribute('position'), sn = stat.getAttribute('normal'), sc = stat.getAttribute('color');
    for (let i = 0; i < statVerts; i++) {
      const j = (this.dynVerts + i) * 3;
      this.pos[j] = sp.getX(i); this.pos[j + 1] = sp.getY(i); this.pos[j + 2] = sp.getZ(i);
      this.nrm[j] = sn.getX(i); this.nrm[j + 1] = sn.getY(i); this.nrm[j + 2] = sn.getZ(i);
      col.push(sc.getX(i), sc.getY(i), sc.getZ(i));
      uv.push((sp.getX(i) + sp.getZ(i)) * 8, sp.getY(i) * 8);
    }
    const si = stat.getIndex();
    if (si) for (let i = 0; i < si.count; i++) idx.push(si.getX(i) + this.dynVerts);
    else for (let i = 0; i < statVerts; i++) idx.push(i + this.dynVerts);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr = new THREE.BufferAttribute(this.nrm, 3); this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.nrmAttr);
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.geometry.setIndex(idx);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.shape(0, 0);
  }

  private limbAt(u: number, sign: number, p: number, pos: THREE.Vector3, tan: THREE.Vector3): void {
    const { gripH: GRIP_H, limbW: LIMB_W } = this.look;
    const k = this.look.kappaRest + this.look.kappaDraw * p;
    if (u <= GRIP_H) { pos.set(0, sign * u, 0); tan.set(0, sign, 0); return; }
    // the bend grows along the limb (a stave bends through the handle's ends and the mid-limb most, the tips least)
    const w = Math.min(u - GRIP_H, LIMB_W);
    const th = k * w;
    let y = GRIP_H + Math.sin(th) / k, z = (1 - Math.cos(th)) / k;
    let a = th;
    if (u > GRIP_H + LIMB_W) { a = k * LIMB_W; const s = u - GRIP_H - LIMB_W; y += Math.cos(a) * s; z += Math.sin(a) * s; }
    pos.set(0, sign * y, z); tan.set(0, sign * Math.cos(a), Math.sin(a));
  }
  /** half width (x) and half thickness (belly-back) at u — a D section: deep at the handle, tapering to the nocks */
  private limbSection(u: number): [number, number] {
    const { gripH: GRIP_H, limbW: LIMB_W, nockL: NOCK_L } = this.look;
    if (u <= GRIP_H) return [0.0145, 0.019];
    const w = u - GRIP_H;
    if (w <= LIMB_W) { const t = w / LIMB_W, fade = Math.exp(-((w / 0.035) ** 2)); return [0.0145 - 0.0065 * t + 0.001 * fade, 0.0155 - 0.008 * t + 0.0035 * fade]; }
    const t = (w - LIMB_W) / NOCK_L;
    return [0.0075 - 0.0025 * t + 0.0012 * Math.sin(t * Math.PI), 0.0072 - 0.002 * t + 0.0012 * Math.sin(t * Math.PI)];
  }
  private gripWrap(u: number, ph: number, sign: number): number { return u < this.look.gripH ? 1 + 0.06 * Math.max(0, Math.sin(u * 300 * sign + ph * 2)) ** 3 : 1; }

  /** the painted colour at arc length u, ring angle φ (sin φ > 0 = the belly, toward the archer): the pale sapwood back,
   *  the heartwood belly with its dark streaks and pin knots, the leather grip with its inlay, horn nocks */
  private limbColor(PAL: Pal, out: number[], u: number, phi: number, sign: number): void {
    const { gripH: GRIP_H, limbW: LIMB_W } = this.look;
    const belly = Math.sin(phi);
    if (u <= GRIP_H) {
      const wrap = Math.max(0, Math.sin(u * 300 * sign + phi * 2)) ** 3;
      const amber = Math.abs(u - GRIP_H * 0.5) < 0.006 && belly < -0.2 ? 1 : 0; // a band of inlay set into the back of the grip
      if (amber) { mix3(out, PAL.amber, PAL.amber, 0, 1.15); return; }
      mix3(out, PAL.leather, PAL.leatherHi, 0.15 + wrap * 0.7, 0.85 + 0.15 * wrap); return;
    }
    const w = u - GRIP_H;
    if (w > LIMB_W) { const g = grain(u * 200, phi * 3); mix3(out, PAL.horn, PAL.hornHi, 0.25 * g + (u > this.bowLen - 0.008 ? 0.5 : 0)); return; }
    const g1 = grain(u * 26 + sign * 3, phi * 1.7), g2 = grain(u * 140, phi * 5 + sign);
    // the sapwood / heartwood line wanders a little along the stave
    const line = -0.25 + 0.22 * (grain(u * 9 + sign * 11, 1.3) - 0.5);
    if (belly < line - 0.08) { // the back: sapwood, cream with a faint grain
      mix3(out, PAL.sap, PAL.sapDark, 0.25 * g2 + 0.2 * g1, 0.96 + 0.06 * g1); return;
    }
    if (belly < line + 0.08) { mix3(out, PAL.sapDark, PAL.heartHi, (belly - line + 0.08) / 0.16); return; } // the transition
    // the belly: heartwood, streaked along the stave, a pin knot here and there
    const streak = 0.5 + 0.5 * Math.sin(u * 55 + 4 * Math.sin(u * 7 + sign * 2) + phi * 2);
    const knot = grain(u * 40 + 5, phi * 4) > 0.9 ? 0.7 : 0;
    const c = _c1.copy(PAL.heart).lerp(PAL.heartHi, streak * 0.45 * (0.6 + 0.4 * g2)).lerp(PAL.heartDark, knot + 0.15 * g1);
    out.push(c.r, c.g, c.b);
  }

  /** bend the limbs for draw `p` (0..1) and pull the string to `nockDraw` (0 = braced, 1 = full, < 0 overshoot) */
  shape(p: number, nockDraw: number): void {
    const pc = Math.max(0, Math.min(1.08, p));
    if (Math.abs(pc - this.lastP) < 0.0015 && Math.abs(nockDraw - this.lastNock) < 0.0015) return;
    this.lastP = pc; this.lastNock = nockDraw;
    const RADIAL = this.look.radial, BOW_LEN = this.bowLen;
    const P = this.pos, N = this.nrm;
    const c = _b1, t = _b2, n = _b3;
    const rings = this.ringU.length;
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      this.limbAt(u, sign, pc, c, t);
      n.set(0, -t.z * sign, t.y * sign);
      const [hw, ht] = this.limbSection(u);
      for (let k = 0; k <= RADIAL; k++) {
        const ph = (k / RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        // a D section: the back (sp < 0) flat-ish, the belly rounded
        const flat = sp < 0 ? 0.55 : 1;
        const j = (r * (RADIAL + 1) + k) * 3;
        const rr = this.gripWrap(u, ph, sign);
        P[j] = cp * hw * rr; P[j + 1] = c.y + n.y * sp * ht * flat * rr; P[j + 2] = c.z + n.z * sp * ht * flat * rr;
        const ex = cp / hw, en = sp / (ht * flat), l = Math.hypot(ex, en) || 1;
        N[j] = ex / l; N[j + 1] = (n.y * en) / l; N[j + 2] = (n.z * en) / l;
      }
      if (r === 0 || r === rings - 1) {
        const j = (rings * (RADIAL + 1) + (r === 0 ? 0 : 1)) * 3;
        P[j] = 0; P[j + 1] = c.y + t.y * 0.004; P[j + 2] = c.z + t.z * 0.004;
        N[j] = 0; N[j + 1] = t.y; N[j + 2] = t.z;
      }
    }
    this.limbAt(BOW_LEN - 0.014, 1, pc, this.tipTop, t); this.tipTop.z += 0.004;
    this.limbAt(BOW_LEN - 0.014, -1, pc, this.tipBot, t); this.tipBot.z += 0.004;
    const braceZ = (this.tipTop.z + this.tipBot.z) / 2;
    this.nock.set(this.look.arrowX * 0.3, this.look.arrowY - 0.004, braceZ + (this.look.braceZ + this.look.drawLen - braceZ) * Math.max(-0.12, nockDraw));
    this.nock.z = Math.max(this.nock.z, braceZ - 0.03);
    this.writeLeg(0, this.tipBot, this.nock);
    this.writeLeg(1, this.tipTop, this.nock);
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.dynVerts * 3); this.posAttr.needsUpdate = true;
    this.nrmAttr.clearUpdateRanges(); this.nrmAttr.addUpdateRange(0, this.dynVerts * 3); this.nrmAttr.needsUpdate = true;
  }

  private writeLeg(leg: number, a: THREE.Vector3, b: THREE.Vector3): void {
    const STRING_RADIAL = this.look.stringRadial, STRING_R = this.look.stringR;
    const d = _b1.subVectors(b, a).normalize();
    const e1 = _b2.set(1, 0, 0); e1.addScaledVector(d, -e1.dot(d)).normalize();
    const e2 = _b3.crossVectors(d, e1);
    const o = this.limbVerts + leg * STRING_RINGS * STRING_RADIAL;
    const len = a.distanceTo(b), sv = Math.max(0, 1 - this.look.serving / Math.max(len, 1e-3));
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

/** The braced stave with the left glove on it (the bow's one mesh) in the look's hand palette: a display card's geometry. */
export function staveBowSpecimen(look: StaveBowLook): THREE.BufferGeometry {
  const lf = withArmPalette(look.hands, () => gloveFist(look.leftFist));
  return new StaveBowMesh(look, [lf.geometry]).geometry;
}

/** The platform bow's view strategy for a stave bow, every part on `mat` (the viewmodels' shared lit program, vertex
 *  colours × the 1×1 fillers): the stave with the left fist, the nocked arrow, the right fist and both sleeves. */
export function staveBowView(look: StaveBowLook, mat: THREE.Material): BowView {
  const { lf, rf, lArm, rArm } = withArmPalette(look.hands, () => ({ lf: gloveFist(look.leftFist), rf: gloveFist(look.rightFist), lArm: riderArm(...look.leftSleeve), rArm: riderArm(...look.rightSleeve) }));
  const roll = new THREE.Quaternion().setFromAxisAngle(rf.wristDir, look.rightRoll);
  const mesh = new StaveBowMesh(look, [lf.geometry]);
  const nocked = new THREE.Mesh(planarUv(arrowGeometry(look.arrow), 20), mat);
  const rHand = new THREE.Mesh(planarUv(rf.geometry), mat);
  const lSleeve = new THREE.Mesh(planarUv(lArm), mat);
  const rSleeve = new THREE.Mesh(planarUv(rArm), mat);
  return { mat, mesh, nocked, rHand, lSleeve, rSleeve, lWrist: lf.wrist, rWrist: rf.wrist, rHook: rf.hook, rWristDir: rf.wristDir, roll };
}

/** A look's grip poses (triples) as the platform bow's GripPose, keys kept. */
export function bowPoses<K extends string>(rows: Readonly<Record<K, GripPoseRow>>): Record<K, GripPose> {
  const out = {} as Record<K, GripPose>;
  for (const k of Object.keys(rows) as K[]) { const r = rows[k]; out[k] = { pos: new THREE.Vector3(...r.pos), aim: new THREE.Vector3(...r.aim), cant: r.cant, pitch: r.pitch }; }
  return out;
}

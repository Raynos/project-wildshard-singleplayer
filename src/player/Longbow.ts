import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import { WIND_DIR, windGustAt } from '../world/wind';
import { fixIBL, fovForAspect, isMesh, viewmodelMaterial, FOV_HIP, type ImpactSurface, type Targets, type TargetHit } from './Crossbow';
import { Projectiles, type ProjectileKind, type WindField } from './Projectiles';
import { BowDraw, RENOCK_TIME } from './bowDraw';
import { ARM_PAL, gloveFist, riderArm, placeArm } from './nalatiArms';
import type { Weapon } from './Weapon';

/**
 * Longbow — THE WARDEN'S LONGBOW, the Antler King's reward on Pine Hollow (PINE-HOLLOW-REMASTER PH-U15 / PH-C2 / PH-C11):
 * a yew self-bow, sapwood back and heartwood belly, horn nocks, a linen string, the grip bound in bark-brown leather with
 * amber set in it. ADAPTED from Nalati's `Bow.ts` (the composite recurve): the same draw (`bowDraw.ts`, verbatim), the same
 * flight / wind / walk-over recovery (`Projectiles.ts`, verbatim), the same gloved hands (`nalatiArms.ts`, verbatim — its
 * palette is swapped to a Pine Hollow hunter's for the build), the same BowMesh idea (limbs + string rewritten on the CPU
 * as the draw changes), the same drop-arc preview. What differs: photoreal PBR, not painterly (every part is on the
 * viewmodels' shared lit program, `Crossbow.viewmodelMaterial` — the viewmodel compiles no program of its own; the
 * world's arrows are one instanced standard material); the limb is a longbow's (a long, near-constant bend, no ears); the
 * wind is the shared `src/world/wind.ts` (its gust field, the one the pines sway in); no saddle, no styles.
 *
 *   const bow = new Longbow({ game, sky, player, forest }, targets, { allowUnlocked });
 *   new Weapons(crossbow, rifle, [{ weapon: bow, id: 'bow', name: "Warden's longbow" }])   // kit id 'bow' (TouchControls' draw disc)
 *
 * Input: LMB held = draw (the string comes back over DRAW_TIME), released at full draw = the loose, released early = a
 * let-down (no arrow spent). The touch FIRE disc is the same hold (`altHeld`, TouchControls). `F` / a `tryFire()` with
 * nothing held = a whole shot: draw, and loose at full (`tryFire()` itself only clicks dry, as Bow.ts's). RMB / the AIM disc = the zoom down the arrow (AIM_ZOOM).
 * Held at full: steady 3 s, then the aim trembles, then the arms give out (bowDraw.ts).
 *
 * Numbers: speed SPEED_BASE + SPEED_DRAW m/s, gravity 6 (the arc reads; a crossbow bolt flies flatter), drag 0.014, wind
 * drift 0.25 /s sideways toward the wind; damage = the animal's bolt model × DAMAGE_SCALE. Quiver QUIVER_MAX; stuck arrows
 * are picked up by walking over them (70 % survive).
 */

export const QUIVER_MAX = 20;
const ARC_FROM = 0.25;
const SWAY_MAX = THREE.MathUtils.degToRad(1.4);
const SPEED_BASE = 32, SPEED_DRAW = 30;
const DAMAGE_SCALE = 1.35;       // the King's bow: every loose is a full draw — 43–54 body
export const AIM_ZOOM = 1.6, AIM_VM_ZOOM = 0.85, AIM_SWAY = 0.5, AIM_SPREAD = 0.5, AIM_IN = 10;
const ARC_MAX = 56, ARC_SPACING = 0.8, ARC_SKIP = 0.5, ARC_BLEND = 11, ARC_AMBER = 0xffc070;
/** the drop arc: on while AIM is on (the default), `?arc=1` always while drawing, `?arc=0` never */
const ARC_PARAM = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('arc');

export interface LongbowWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface LongbowOptions { allowUnlocked?: boolean }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────────────────────── the shared wind as a field (m/s in XZ) ─────────────────────────────

/** Pine Hollow's wind for a flying arrow: the prevailing direction, its speed from the gust field the pines sway in
 *  (≈ 2 m/s in a lull … ≈ 8 under a front in a gust; the rain's `windBoost` raises the gust) */
export const pineWind: WindField = {
  vecAt: (x, z, out) => { const s = 1.2 + 7 * windGustAt(x, z); out.x = WIND_DIR.x * s; out.z = WIND_DIR.z * s; return out; },
};

// ───────────────────────────── palette (sRGB hex → linear via THREE.Color) ─────────────────────────────

const C = (hex: number) => new THREE.Color(hex);
const PAL = {
  sap: C(0xd9c08e), sapDark: C(0xb89a64), heart: C(0x9a4a24), heartDark: C(0x6a2c14), heartHi: C(0xc0703a),
  horn: C(0x2a211a), hornHi: C(0x6a5a44), leather: C(0x3a2a1c), leatherHi: C(0x5c4430), amber: C(0xe08a28),
  string: C(0xd8ccb0), serving: C(0x3a2e24),
  shaft: C(0xc9a878), shaftDark: C(0x8a6a46), binding: C(0x4a3622), head: C(0x3c3e42), feather: C(0x8e8a84), featherBar: C(0xe6e0d4),
};

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
/** a planar uv from the vertex positions (the shared program samples its 1×1 fillers; a uv keeps the TBN finite) */
function planarUv(g: THREE.BufferGeometry, k = 8): THREE.BufferGeometry {
  const p = g.getAttribute('position'), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * k; uv[i * 2 + 1] = p.getY(i) * k; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The arrow: an ash shaft, a sinew-bound bodkin head, three grey-goose feathers (a white cock feather). TIP at the
 *  origin, shaft along +Z (`ARROW_LEN`) — Projectiles.ts's convention. Feathers two-faced (no DoubleSide program). */
export const ARROW_LEN = 0.76;
export function buildArrowGeometry(): THREE.BufferGeometry {
  const L = ARROW_LEN, r = 0.0045;
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(r, r * 0.92, L - 0.07, 6, 1); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.065 + (L - 0.07) / 2);
  parts.push(paint(shaft, PAL.shaft, 0.08, 11));
  for (const z of [0.075, L - 0.19, L - 0.03]) { const b = new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.012, 6, 1); b.rotateX(Math.PI / 2); b.translate(0, 0, z); parts.push(paint(b, PAL.binding, 0.05, 12)); }
  const nock = new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.014, 6, 1); nock.rotateX(Math.PI / 2); nock.translate(0, 0, L - 0.004);
  parts.push(paint(nock, PAL.shaftDark, 0.04, 13));
  const head = new THREE.ConeGeometry(0.0085, 0.062, 4, 1); head.rotateY(Math.PI / 4); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.031);
  parts.push(paint(head, PAL.head, 0.08, 14));
  const socket = new THREE.CylinderGeometry(r * 1.05, r * 1.3, 0.02, 6, 1); socket.rotateX(Math.PI / 2); socket.translate(0, 0, 0.066);
  parts.push(paint(socket, PAL.head, 0.05, 15));
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 6, z0 = L - 0.04, len = 0.14;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = z0 - t * len;
      const h = 0.016 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.35 * t * t);
      const c = k === 0 ? PAL.featherBar : PAL.feather;
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

/** the arrow as a `Projectiles` kind: one instanced standard material for every arrow in flight or stuck in the world */
export function arrowKind(sky: Sky): ProjectileKind {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  material.name = 'longbow-arrow'; fixIBL(material, 'longbow-arrow'); sky.setupMaterial(material);
  return { geometry: buildArrowGeometry(), material, length: ARROW_LEN, gravity: 6, drag: 0.014, windCoupling: 0.25, bury: 0.09, recover: 0.7, maxFlying: 8, maxStuck: 48 };
}

// ───────────────────────────── the longbow's shape ─────────────────────────────

const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _b3 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c1 = new THREE.Color();

/* Bow-local frame (Bow.ts's): the grip centre at the origin, +Y up the bow, −Z = where the arrow flies (the bow's back),
 * +Z toward the archer (the belly), +X the archer's right. The arrow rests on the LEFT of the grip (a Mediterranean draw).
 * Each limb: the stiff grip, then a working limb of near-constant bend κ(p) toward the archer, then the horn nock. */
const GRIP_H = 0.06, LIMB_W = 0.74, NOCK_L = 0.035;
const KAPPA_REST = 0.52, KAPPA_DRAW = 0.9;
const BRACE_Z = 0.155, DRAW_LEN = 0.56;
const ARROW_X = -0.017, ARROW_Y = 0.052;
const BOW_LEN = GRIP_H + LIMB_W + NOCK_L;
const RADIAL = 14, STRING_RADIAL = 6, STRING_R = 0.0019;
const STRING_RINGS = 4, SERVING = 0.1;

function limbAt(u: number, sign: number, p: number, pos: THREE.Vector3, tan: THREE.Vector3): void {
  const k = KAPPA_REST + KAPPA_DRAW * p;
  if (u <= GRIP_H) { pos.set(0, sign * u, 0); tan.set(0, sign, 0); return; }
  // the bend grows along the limb (a longbow bends through the handle's ends and the mid-limb most, the tips least)
  const w = Math.min(u - GRIP_H, LIMB_W);
  const th = k * w;
  let y = GRIP_H + Math.sin(th) / k, z = (1 - Math.cos(th)) / k;
  let a = th;
  if (u > GRIP_H + LIMB_W) { a = k * LIMB_W; const s = u - GRIP_H - LIMB_W; y += Math.cos(a) * s; z += Math.sin(a) * s; }
  pos.set(0, sign * y, z); tan.set(0, sign * Math.cos(a), Math.sin(a));
}
/** half width (x) and half thickness (belly-back) at u — a D section: deep at the handle, tapering to the nocks */
function limbSection(u: number): [number, number] {
  if (u <= GRIP_H) return [0.0145, 0.019];
  const w = u - GRIP_H;
  if (w <= LIMB_W) { const t = w / LIMB_W, fade = Math.exp(-((w / 0.035) ** 2)); return [0.0145 - 0.0065 * t + 0.001 * fade, 0.0155 - 0.008 * t + 0.0035 * fade]; }
  const t = (w - LIMB_W) / NOCK_L;
  return [0.0075 - 0.0025 * t + 0.0012 * Math.sin(t * Math.PI), 0.0072 - 0.002 * t + 0.0012 * Math.sin(t * Math.PI)];
}
function gripWrap(u: number, ph: number, sign: number): number { return u < GRIP_H ? 1 + 0.06 * Math.max(0, Math.sin(u * 300 * sign + ph * 2)) ** 3 : 1; }
function grain(x: number, y: number): number { const h = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }

/** the painted colour at arc length u, ring angle φ (sin φ > 0 = the belly, toward the archer): yew — the pale sapwood
 *  back, the orange-brown heartwood belly with its dark streaks and pin knots, the leather grip with its amber, horn nocks */
function limbColor(out: number[], u: number, phi: number, sign: number): void {
  const belly = Math.sin(phi);
  if (u <= GRIP_H) {
    const wrap = Math.max(0, Math.sin(u * 300 * sign + phi * 2)) ** 3;
    const amber = Math.abs(u - GRIP_H * 0.5) < 0.006 && belly < -0.2 ? 1 : 0; // a band of amber set into the back of the grip
    if (amber) { mix3(out, PAL.amber, PAL.amber, 0, 1.15); return; }
    mix3(out, PAL.leather, PAL.leatherHi, 0.15 + wrap * 0.7, 0.85 + 0.15 * wrap); return;
  }
  const w = u - GRIP_H;
  if (w > LIMB_W) { const g = grain(u * 200, phi * 3); mix3(out, PAL.horn, PAL.hornHi, 0.25 * g + (u > BOW_LEN - 0.008 ? 0.5 : 0)); return; }
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

/** The longbow + the left fist: one geometry. The first `dynVerts` vertices (limbs + string) are rewritten by `shape(p)`. */
class LongbowMesh {
  readonly geometry = new THREE.BufferGeometry();
  readonly dynVerts: number;
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly ringU: number[] = [];
  private readonly ringSign: number[] = [];
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly limbVerts: number;
  private lastP = -1; private lastNock = -1;

  constructor(staticParts: THREE.BufferGeometry[]) {
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
      for (let k = 0; k <= RADIAL; k++) { limbColor(col, u, (k / RADIAL) * Math.PI * 2, sign); uv.push(k / RADIAL, u * sign * 6); }
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
      n.set(0, -t.z * sign, t.y * sign);
      const [hw, ht] = limbSection(u);
      for (let k = 0; k <= RADIAL; k++) {
        const ph = (k / RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        // a D section: the back (sp < 0) flat-ish, the belly rounded
        const flat = sp < 0 ? 0.55 : 1;
        const j = (r * (RADIAL + 1) + k) * 3;
        const rr = gripWrap(u, ph, sign);
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
    limbAt(BOW_LEN - 0.014, 1, pc, this.tipTop, t); this.tipTop.z += 0.004;
    limbAt(BOW_LEN - 0.014, -1, pc, this.tipBot, t); this.tipBot.z += 0.004;
    const braceZ = (this.tipTop.z + this.tipBot.z) / 2;
    this.nock.set(ARROW_X * 0.3, ARROW_Y - 0.004, braceZ + (BRACE_Z + DRAW_LEN - braceZ) * Math.max(-0.12, nockDraw));
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

// ───────────────────────────── the drop arc (Bow.ts's, amber) ─────────────────────────────

class DropArc {
  readonly points: THREE.Points;
  readonly ring: THREE.Mesh;
  private readonly buf = new Float32Array(ARC_MAX * 3);
  private readonly attr: THREE.BufferAttribute;
  private readonly uAlpha: THREE.IUniform<number> = { value: 0 };
  private readonly uPx: THREE.IUniform<number> = { value: 6 };
  private readonly ringMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.buf, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: this.uAlpha, uPx: this.uPx, uColor: { value: new THREE.Color(ARC_AMBER) } },
      vertexShader: `uniform float uPx; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * clamp(8.0 / max(0.1, -mv.z), 0.6, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uAlpha; uniform vec3 uColor; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(uColor, uAlpha * (1.0 - smoothstep(0.55, 1.0, r))); }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false; this.points.renderOrder = 998; this.points.visible = false;
    this.ringMat = new THREE.MeshBasicMaterial({ color: ARC_AMBER, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const rg = new THREE.RingGeometry(0.62, 1, 36); rg.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(rg, this.ringMat);
    this.ring.frustumCulled = false; this.ring.renderOrder = 998; this.ring.visible = false;
    scene.add(this.points, this.ring);
  }

  hide(): void { this.points.visible = false; this.ring.visible = false; }

  show(arrows: Projectiles, origin: THREE.Vector3, vel: THREE.Vector3, from: THREE.Vector3, alpha: number, camPos: THREE.Vector3, dpr: number): void {
    const n = arrows.predict(origin, vel, this.buf, ARC_MAX, ARC_SPACING, ARC_SKIP);
    const ox = from.x - origin.x, oy = from.y - origin.y, oz = from.z - origin.z, b = this.buf;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const px = b[j] ?? 0, py = b[j + 1] ?? 0, pz = b[j + 2] ?? 0;
      const d = Math.hypot(px - origin.x, py - origin.y, pz - origin.z);
      const k = 1 - sstep(0, ARC_BLEND, d);
      b[j] = px + ox * k; b[j + 1] = py + oy * k; b[j + 2] = pz + oz * k;
    }
    this.attr.clearUpdateRanges(); this.attr.addUpdateRange(0, n * 3); this.attr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, n);
    this.uAlpha.value = alpha * 0.7; this.uPx.value = 7 * dpr;
    this.points.visible = n > 0;
    this.ring.visible = arrows.landed;
    if (arrows.landed) {
      const d = arrows.landing.distanceTo(camPos);
      this.ring.position.copy(arrows.landing).addScaledVector(arrows.landingNormal, 0.05);
      this.ring.quaternion.setFromUnitVectors(_up, arrows.landingNormal);
      this.ring.scale.setScalar(0.2 + d * 0.013);
      this.ringMat.opacity = alpha * 0.7;
    }
  }
}

// ───────────────────────────── the hands (nalatiArms.ts, a Pine Hollow hunter's palette) ─────────────────────────────

const lin = (hex: number): THREE.Color => new THREE.Color(hex).convertSRGBToLinear();
/** a hunter's dark-tan leather gloves, a grey knit cuff, the sleeve of a waxed-canvas coat with leather patches */
const HUNTER_PAL: Partial<Record<keyof typeof ARM_PAL, THREE.Color>> = {
  leather: lin(0x6a4a30), leatherLight: lin(0x8a6646), leatherDark: lin(0x3a281a), leatherEdge: lin(0x4a3424), thread: lin(0xa89878),
  fleece: lin(0x6e685e), fleeceShade: lin(0x524c44), fleeceDeep: lin(0x3a352f),
  wool: lin(0x5e5038), woolShade: lin(0x3e3424), red: lin(0x4a3422), redDeep: lin(0x33251a), redLine: lin(0x2a1e14),
};
/** build with the hunter's palette, then put Nalati's back (the module's palette is shared) */
function withHunterPalette<T>(build: () => T): T {
  const saved = new Map<keyof typeof ARM_PAL, THREE.Color>();
  for (const k of Object.keys(HUNTER_PAL) as (keyof typeof ARM_PAL)[]) { const c = HUNTER_PAL[k]; if (c === undefined) continue; saved.set(k, ARM_PAL[k].clone()); ARM_PAL[k].copy(c); }
  try { return build(); } finally { for (const [k, c] of saved) ARM_PAL[k].copy(c); }
}

// ───────────────────────────── the longbow ─────────────────────────────

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _fwd = new THREE.Vector3(), _dir = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const NEG_Z = new THREE.Vector3(0, 0, -1), POS_Z = new THREE.Vector3(0, 0, 1), Y_AXIS = new THREE.Vector3(0, 1, 0);

interface GripPose { pos: THREE.Vector3; aim: THREE.Vector3; cant: number; pitch: number }
const L_FIST = { R: 0.019, mirror: true, yaw: -0.32 };
const R_FIST = { R: 0.009, yaw: 0.55 };
const R_FIST_ROLL = 1.35, HOOK_BELOW_NOCK = 0.006;
const _rollQ = new THREE.Quaternion(), _rDir = new THREE.Vector3();
const R_ARM_DIR = V(0.6, -0.42, 0.68).normalize(), R_ARM_DIR_PORT = V(0.42, -0.62, 0.66).normalize();
const RN_FOLLOW = 0.18, RN_DROP = 0.52, FOLLOW_OFF = V(0.035, 0.012, 0.075), QUIVER_OFF = V(0.3, -0.55, 0.12);

/* Poses in rig space (camera space / VM_SCALE), Bow.ts's, re-seated for a bow twice as tall: rest = lowered and canted
 * across the body; drawn = the fist right of centre, the stave canted, the arrow converging on the crosshair ~6 m out. */
const VM_SCALE = 0.72;
export const POSE = {
  rest: { pos: V(0.32, -0.46, -0.9), aim: V(-0.1, 0.25, -4), cant: -0.78, pitch: -0.16 },
  drawn: { pos: V(0.2, -0.17, -1.12), aim: V(0, 0, -5.5), cant: -0.3, pitch: 0 },
  restPort: { pos: V(0.16, -0.52, -0.92), aim: V(-0.05, 0.12, -4), cant: -0.62, pitch: -0.14 },
  drawnPort: { pos: V(0.07, -0.1, -1.08), aim: V(0, 0, -5.5), cant: -0.24, pitch: 0 },
  aim: { pos: V(0.1, -0.22, -1.15), aim: V(0.02, -0.052, -7), cant: -0.22, pitch: 0 },
  aimPort: { pos: V(0.04, -0.19, -1.15), aim: V(0.02, -0.052, -8), cant: -0.16, pitch: 0 },
} satisfies Record<string, GripPose>;
const L_ELBOW = V(-0.42, -0.52, -0.3), L_ELBOW_PORT = V(-0.2, -0.75, -0.32);

export class Longbow implements Weapon {
  readonly hasAmmo = true;
  readonly ammoLabel = 'Arrows';
  readonly segments = 4;
  readonly magazine = QUIVER_MAX;
  state = { bolts: QUIVER_MAX, loaded: true, reloading: false, reloadProgress: 1, ads: false };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  /** the draw, held (Weapons.altHeld — the touch FIRE disc) */
  altHeld = false;
  holster = 0;
  aimInfo: { kind: string; distance: number } | null = null;
  /** dev: > 0 = the bow held up close and turned (`inspectYaw` rad) */
  inspect = 0; inspectYaw = 0; inspectPitch = 0;
  /** dev: hold the draw at this value (0..1) for a still — `__weapons.get('bow')` does not reach it; `window.__longbow.freezeDraw = 1` */
  freezeDraw: number | null = null;

  onFire?: (() => void) | undefined;
  onHit?: ((kind: string, headshot: boolean, killed: boolean) => void) | undefined;
  onImpact?: ((surface: ImpactSurface, point: THREE.Vector3) => void) | undefined;
  onReloadStart?: (() => void) | undefined;
  onReloadEnd?: (() => void) | undefined;
  onDry?: (() => void) | undefined;
  onDrawStart?: (() => void) | undefined;
  onLetDown?: (() => void) | undefined;
  onFullDraw?: (() => void) | undefined;
  onRecover?: ((survived: boolean) => void) | undefined;
  onLoose?: ((power: number) => void) | undefined;
  damageMultiplier: ((hit: TargetHit) => number) | undefined;

  readonly model = new THREE.Group();
  readonly arrows: Projectiles;
  private readonly game: Game; private readonly sky: Sky; private readonly player: Player;
  private readonly targets: Targets | undefined;
  private readonly bowPivot = new THREE.Group();
  private readonly bowMesh: LongbowMesh;
  private readonly nocked: THREE.Mesh;
  private readonly rHand: THREE.Mesh;
  private readonly lSleeve: THREE.Mesh; private readonly rSleeve: THREE.Mesh;
  private readonly lWrist: THREE.Vector3; private readonly rWrist: THREE.Vector3; private readonly rHook: THREE.Vector3; private readonly rWristDir: THREE.Vector3;
  private readonly releasePos = new THREE.Vector3(); private readonly handPos = new THREE.Vector3();
  private readonly arc: DropArc;
  /** the bow + hands' material (the viewmodels' shared program) and the plain displayed copy's */
  private readonly mat: THREE.MeshPhysicalMaterial;

  private readonly draw = new BowDraw();
  private p = 0;
  private vis = 0; private visVel = 0;
  private mouseDraw = false; private mouseAds = false; private mouseCancel = false;
  /** `tryFire()` with nothing held: draw and loose at full (the F key; a tap from any other caller) */
  private autoShot = false;
  private aimBlend = 0;
  private ready = 0;
  private recoil = 0;
  private swayYaw = 0; private swayPitch = 0;
  private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagPitch = 0; private lagYawV = 0; private lagPitchV = 0;
  private aimFrame = 0; private readonly aimCache = { kind: '', distance: 0 };
  private readonly spawnPos = new THREE.Vector3(); private readonly launchVel = new THREE.Vector3();
  private readonly gripPos = new THREE.Vector3(); private readonly gripQuat = new THREE.Quaternion();
  aimOn = false;

  constructor(world: LongbowWorld, targets?: Targets, opts: LongbowOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;

    // one material on the viewmodels' shared lit program (vertex colours × the 1×1 fillers): waxed yew, leather, linen
    this.mat = viewmodelMaterial(this.sky, 'longbow', { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 });
    const { lf, rf, lArm, rArm } = withHunterPalette(() => ({ lf: gloveFist(L_FIST), rf: gloveFist(R_FIST), lArm: riderArm(1.0, 1), rArm: riderArm(0.9, 2) }));
    this.lWrist = lf.wrist; this.rWrist = rf.wrist; this.rHook = rf.hook; this.rWristDir = rf.wristDir;
    _rollQ.setFromAxisAngle(rf.wristDir, R_FIST_ROLL);
    this.bowMesh = new LongbowMesh([lf.geometry]);
    this.bowPivot.add(new THREE.Mesh(this.bowMesh.geometry, this.mat));
    this.nocked = new THREE.Mesh(planarUv(buildArrowGeometry(), 20), this.mat);
    this.rHand = new THREE.Mesh(planarUv(rf.geometry), this.mat);
    this.lSleeve = new THREE.Mesh(planarUv(lArm), this.mat);
    this.rSleeve = new THREE.Mesh(planarUv(rArm), this.mat);
    this.model.add(this.bowPivot, this.nocked, this.rHand, this.lSleeve, this.rSleeve);
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m !== clearer;
      if (m === clearer) return;
      m.renderOrder = 1000;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.depthWrite = true; }
    });
    this.model.scale.setScalar(VM_SCALE);
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);

    this.arrows = new Projectiles(world, targets, arrowKind(this.sky));
    this.arrows.onHit = (kind, headshot, killed) => this.onHit?.(kind, headshot, killed);
    this.arrows.onImpact = (s, pt) => this.onImpact?.(s, pt);
    this.arrows.wind = pineWind;
    this.arrows.canRecover = () => this.state.bolts < QUIVER_MAX;
    this.arrows.onRecover = (ok) => { if (ok) this.state.bolts = Math.min(QUIVER_MAX, this.state.bolts + 1); this.onRecover?.(ok); };
    this.arc = new DropArc(this.game.scene);
    this.bindInput();
  }

  get wind(): WindField | null { return this.arrows.wind; }
  set wind(w: WindField | null) { this.arrows.wind = w; }
  get charge(): number { return this.p; }
  get drawing(): boolean { return this.p > 0.01; }
  get fullDraw(): boolean { return this.draw.full; }
  get aimed(): number { return this.aimBlend; }

  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) { if (this.state.bolts <= 0) this.onDry?.(); else { this.mouseDraw = true; this.mouseCancel = false; } }
      if (e.button === 2) this.mouseAds = !this.mouseAds;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !this.mouseDraw) return;
      this.mouseDraw = false;
      if (!this.inputAllowed()) this.mouseCancel = true;
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat || e.code !== 'KeyF') return;
      if (this.state.bolts <= 0) this.onDry?.(); else if (!this.mouseDraw && !this.altHeld) this.autoShot = true; // F: a whole shot
    });
    window.addEventListener('blur', () => { if (this.mouseDraw) this.mouseCancel = true; this.mouseDraw = false; this.mouseAds = false; this.autoShot = false; });
  }

  /** the FIRE disc's touch-down (Weapons.tryFire): the draw itself is the hold (`altHeld`), so this only clicks dry on an
   *  empty quiver. `F` is a whole shot (bindInput: the draw, loosed at full). */
  tryFire(): void {
    if (this.enabled && this.state.bolts <= 0) this.onDry?.();
  }

  private loose(): void {
    this.aimRay(_v1, _fwd);
    const spreadDeg = 0.3 * (1 - (1 - AIM_SPREAD) * this.aimBlend) + 0.6 * this.player.speedFactor;
    const spread = THREE.MathUtils.degToRad(spreadDeg);
    _dir.copy(_fwd);
    _v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_fwd).normalize();
    _dir.addScaledVector(_v2, Math.tan(spread * Math.sqrt(Math.random()))).normalize();
    this.launchFrom(_dir, this.spawnPos, this.launchVel);
    this.arrows.launch(this.spawnPos, this.launchVel, { damageScale: DAMAGE_SCALE, onHitScale: this.damageMultiplier });
    this.state.bolts--;
    this.p = 0;
    this.releasePos.copy(this.handPos);
    this.recoil = 1;
    this.onFire?.(); this.onLoose?.(1);
  }

  private launchFrom(dir: THREE.Vector3, pos: THREE.Vector3, vel: THREE.Vector3): void {
    const cam = this.game.camera;
    pos.setFromMatrixPosition(cam.matrixWorld).addScaledVector(dir, 0.55);
    this.nocked.getWorldPosition(_v3);
    pos.lerp(_v3, 0.15);
    vel.copy(dir).multiplyScalar(SPEED_BASE + SPEED_DRAW);
  }

  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const cam = this.game.camera;
    cam.getWorldDirection(dir);
    origin.setFromMatrixPosition(cam.matrixWorld);
    return dir;
  }

  addBolts(n: number): void { this.state.bolts = Math.min(QUIVER_MAX, this.state.bolts + n); }
  reload(): void { /* the draw is the reload */ }

  /** A world-space copy for the King's reward orb: the braced stave (+ the left glove on it) on the same material. */
  displayModel(): THREE.Group {
    const g = new THREE.Group();
    const geo = this.bowMesh.geometry.clone();
    const m = new THREE.Mesh(geo, this.mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return g;
  }

  update(dt: number, t: number): void {
    const pl = this.player, cam = this.game.camera;
    cam.updateMatrixWorld();
    if (!this.enabled) { this.mouseDraw = false; this.mouseAds = false; this.autoShot = false; }

    // the draw (bowDraw.ts): hold = draw, release at full = loose, early = let-down; an auto shot holds until full
    const auto = this.autoShot && !this.draw.full;
    const held = this.mouseDraw || this.altHeld || auto;
    if (this.autoShot && this.draw.full && !this.mouseDraw && !this.altHeld) this.autoShot = false; // released this frame → the loose
    const running = pl.sprinting;
    const blocked = !this.enabled || this.mouseCancel || this.state.bolts <= 0 || running || pl.swimming;
    if (!held) this.mouseCancel = false;
    if (blocked) this.autoShot = false;
    const ev = this.draw.step(dt, held, blocked, 1);
    if (ev === 'start') this.onDrawStart?.();
    else if (ev === 'full') this.onFullDraw?.();
    else if (ev === 'letdown' || ev === 'tired') this.onLetDown?.();
    this.p = this.freezeDraw ?? this.draw.p;
    if (ev === 'loose') this.loose();
    this.state.loaded = this.state.bolts > 0;
    this.state.reloading = false;
    this.state.reloadProgress = 1 - this.draw.renockT / RENOCK_TIME;

    // AIM: the zoom down the arrow (a toggle; it never draws). `state.ads` stays false: the crosshair over the arrow IS the aim
    if (running || !this.enabled) this.mouseAds = false;
    this.aimOn = (this.mouseAds || this.adsHeld) && this.enabled && !running && !pl.swimming;
    this.aimBlend += ((this.aimOn && this.model.visible ? 1 : 0) - this.aimBlend) * Math.min(1, dt * AIM_IN);
    if (Math.abs(this.aimBlend - (this.aimOn ? 1 : 0)) < 0.002) this.aimBlend = this.aimOn ? 1 : 0;
    const aimK = sstep(0, 1, this.aimBlend);
    const zoom = 1 + (AIM_ZOOM - 1) * aimK;
    const baseFov = fovForAspect(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV_HIP) / 2) / zoom)), cam.aspect);
    const prevFov = this.fov;
    this.fov += (baseFov - this.fov) * Math.min(1, dt * 12);
    if (Math.abs(baseFov - this.fov) < 0.02) this.fov = baseFov;
    const fovNow = this.fov + pl.fovKick;
    if (this.model.visible && Math.abs(fovNow - cam.fov) > 0.01) { cam.fov = fovNow; cam.updateProjectionMatrix(); if (Math.abs(prevFov - this.fov) > 0.001 || Math.abs(fovNow - this.fov) < 0.01) this.sky.csm.updateFrustums(); }
    this.model.scale.set(VM_SCALE, VM_SCALE, VM_SCALE * zoom ** AIM_VM_ZOOM);

    // aim sway on a long hold
    let sy = 0, sp = 0;
    if (this.p > 0.3 && this.freezeDraw === null) {
      const over = this.draw.sway;
      const amp = (THREE.MathUtils.degToRad(0.06) + SWAY_MAX * over * over) * (1 - (1 - AIM_SWAY) * aimK) * this.p;
      sy = Math.sin(t * 1.3) * amp + Math.sin(t * 2.9 + 1) * amp * 0.35;
      sp = Math.sin(t * 1.7 + 0.5) * amp * 0.8 + Math.sin(t * 3.7) * amp * 0.25;
    }
    pl.yaw += sy - this.swayYaw; pl.pitch += sp - this.swayPitch; this.swayYaw = sy; this.swayPitch = sp;

    this.poseViewmodel(dt, t);

    // the drop arc: while drawn, with AIM on (or always / never by `?arc=`)
    const arcWanted = ARC_PARAM === '1' || (ARC_PARAM !== '0' && this.aimOn);
    if (arcWanted && this.p > ARC_FROM && this.model.visible && this.holster < 0.01) {
      this.aimRay(_v1, _fwd);
      this.launchFrom(_fwd, _v2, _v3);
      this.nocked.getWorldPosition(_dir);
      this.arc.show(this.arrows, _v2, _v3, _dir, sstep(ARC_FROM, 0.85, this.p), _v1, this.game.renderer.getPixelRatio());
    } else this.arc.hide();

    if (this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_v1, _fwd);
      const hit = this.targets.raycast(_v1, _fwd, 150);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.arrows.update(dt);
  }

  private poseViewmodel(dt: number, t: number): void {
    const pl = this.player, cam = this.game.camera;
    const port = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const raise = this.p > 0.01 || this.mouseDraw || this.altHeld || this.autoShot || this.aimBlend > 0.01 || this.draw.renockT > 0;
    this.ready += ((raise ? 1 : 0) - this.ready) * Math.min(1, dt * (raise ? 9 : 4));
    const r = sstep(0, 1, this.ready);
    for (let rem = dt; rem > 0; rem -= 1 / 240) {
      const h = Math.min(rem, 1 / 240);
      this.visVel += (-(this.vis - this.p) * 1600 - this.visVel * 26) * h; this.vis += this.visVel * h;
    }
    if (this.freezeDraw !== null) { this.vis = this.freezeDraw; this.visVel = 0; }
    this.bowMesh.shape(Math.max(0, this.vis), this.vis);

    const R = POSE.rest, D = POSE.drawn, RP = POSE.restPort, DP = POSE.drawnPort;
    const g = this.gripPos, aim = _v1;
    g.lerpVectors(R.pos, RP.pos, port).lerp(_v2.lerpVectors(D.pos, DP.pos, port), r);
    aim.lerpVectors(R.aim, RP.aim, port).lerp(_v2.lerpVectors(D.aim, DP.aim, port), r);
    let cant = THREE.MathUtils.lerp(THREE.MathUtils.lerp(R.cant, RP.cant, port), THREE.MathUtils.lerp(D.cant, DP.cant, port), r);
    const pitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(R.pitch, RP.pitch, port), 0, r);
    const ak = sstep(0, 1, this.aimBlend) * r;
    if (ak > 0) {
      const A = POSE.aim, AP = POSE.aimPort;
      g.lerp(_v2.lerpVectors(A.pos, AP.pos, port), ak);
      aim.lerp(_v2.lerpVectors(A.aim, AP.aim, port), ak);
      cant = THREE.MathUtils.lerp(cant, THREE.MathUtils.lerp(A.cant, AP.cant, port), ak);
    }
    const sf = pl.speedFactor * (1 - 0.6 * r) * (1 - 0.6 * ak);
    let dYaw = pl.yaw - this.lastYaw, dPitch = pl.pitch - this.lastPitch;
    this.lastYaw = pl.yaw; this.lastPitch = pl.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawV += (-this.lagYaw * 200 - this.lagYawV * 20) * h; this.lagYaw += this.lagYawV * h;
      this.lagPitchV += (-this.lagPitch * 200 - this.lagPitchV * 20) * h; this.lagPitch += this.lagPitchV * h;
    }
    this.recoil *= Math.exp(-dt * 7);
    const lagK = (1 - 0.6 * r) * (1 - 0.7 * ak);
    g.x += Math.sin(t * 0.8) * 0.004 + Math.cos(pl.bobTime) * 0.02 * sf + this.lagYaw * 0.3 * lagK;
    g.y += Math.sin(t * 1.2) * 0.003 - Math.abs(Math.sin(pl.bobTime)) * 0.018 * sf + this.lagPitch * 0.25 * lagK;
    g.z -= this.recoil * 0.05; g.y -= this.recoil * 0.012;
    cant += Math.cos(pl.bobTime) * 0.03 * sf + this.recoil * 0.1;
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); g.y -= h * 0.5; g.z += h * 0.1; cant -= h * 0.4; }
    _dir.subVectors(aim, g).normalize();
    this.gripQuat.setFromUnitVectors(NEG_Z, _dir)
      .multiply(_q1.setFromAxisAngle(POS_Z, cant))
      .multiply(_q2.setFromAxisAngle(_v3.set(1, 0, 0), pitch - this.recoil * 0.08 + this.lagPitch * 0.4 * lagK))
      .multiply(_q3.setFromAxisAngle(Y_AXIS, this.lagYaw * 0.5 * lagK));
    if (this.inspect > 0) { g.set(0.02, -0.02, -1.4); this.gripQuat.setFromAxisAngle(Y_AXIS, this.inspectYaw).multiply(_q1.setFromAxisAngle(_v3.set(1, 0, 0), this.inspectPitch)); }
    this.bowPivot.position.copy(g); this.bowPivot.quaternion.copy(this.gripQuat);

    // the right hand: on the string while drawing; after a loose it follows through, drops to the quiver at the hip and
    // comes back up with the next arrow
    const nock = _v2.copy(this.bowMesh.nock).applyQuaternion(this.gripQuat).add(g);
    const H = this.handPos;
    let arrowInHand = this.state.bolts > 0;
    if (this.draw.renockT > 0) {
      const u = 1 - this.draw.renockT / RENOCK_TIME;
      const follow = _v3.copy(this.releasePos).add(FOLLOW_OFF);
      if (u < RN_FOLLOW) H.lerpVectors(this.releasePos, follow, sstep(0, 1, u / RN_FOLLOW));
      else if (u < RN_DROP) { const k = (u - RN_FOLLOW) / (RN_DROP - RN_FOLLOW); H.copy(follow).lerp(_v1.copy(this.releasePos).add(QUIVER_OFF), k * k); }
      else { const k = (u - RN_DROP) / (1 - RN_DROP); H.copy(this.releasePos).add(QUIVER_OFF).lerp(nock, 1 - (1 - k) ** 3); }
      arrowInHand &&= u >= RN_DROP;
    } else H.copy(nock);
    const raised = r > 0.25 && this.inspect === 0;
    this.rHand.visible = raised; this.rSleeve.visible = raised;
    this.rHand.quaternion.copy(this.gripQuat).multiply(_rollQ);
    this.rHand.position.copy(this.rHook).applyQuaternion(this.rHand.quaternion).negate().add(H);
    this.rHand.position.addScaledVector(_v3.set(0, 1, 0).applyQuaternion(this.gripQuat), -HOOK_BELOW_NOCK);
    this.nocked.visible = raised && arrowInHand;
    const rest = _v1.set(ARROW_X, ARROW_Y, 0).applyQuaternion(this.gripQuat).add(g);
    _dir.subVectors(rest, H).normalize();
    this.nocked.quaternion.setFromUnitVectors(NEG_Z, _dir);
    this.nocked.position.copy(H).addScaledVector(_dir, ARROW_LEN);
    const lw = _v1.copy(this.lWrist).applyQuaternion(this.gripQuat).add(g);
    const ld = _v3.lerpVectors(L_ELBOW, L_ELBOW_PORT, port).sub(lw).normalize();
    placeArm(this.lSleeve, lw.addScaledVector(ld, -0.02), ld);
    this.lSleeve.visible = this.inspect === 0;
    const rw = _v1.copy(this.rWrist).applyQuaternion(this.rHand.quaternion).add(this.rHand.position);
    _rDir.copy(this.rWristDir).applyQuaternion(this.rHand.quaternion);
    const rd = _v3.lerpVectors(R_ARM_DIR, R_ARM_DIR_PORT, port).lerp(_rDir, 0.5).normalize();
    placeArm(this.rSleeve, rw.addScaledVector(rd, -0.02), rd);
  }

  get stuckCount(): number { return this.arrows.stuckCount; }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { lin } from '@wildshard/engine/math/color';
import { ARM_PAL, gloveFist, riderArm } from '@wildshard/engine/player/nalatiArms';
import type { ArmPaletteKey, ArmPaletteRow, GloveHandsLook, HandSpec } from '../runtime/viewmodel/gloveHands';
import type { ArrowLook, StaveBowLook } from '../runtime/viewmodel/staveBow';
import { BUCKSKIN, HUNTER_HANDS } from '../data/handsLook';
import { LONGBOW_LOOK } from '../data/longbowLook';

/**
 * Pine Hollow's first-person hands, baked (SHARD-PLATFORM, sp-o190): every gloved hand a weapon holds (the crossbow's and
 * the lever-action's: HAND_SPECS, each its weapon's HandHold spec verbatim; test/pine-hands-baked.test.ts keeps them equal) and the Longbow's parts (the stave's painted rings with the left fist on it,
 * the right fist, both rider sleeves, the arrow loose and nocked), built once here with the engine's arm builder
 * (nalatiArms) in the hunter's palette and written as one rest-geometry pool. The runtime (runtime/viewmodel/gloveHands.ts,
 * staveBow.ts) borrows them by part name; it no longer builds a hand.
 */

type V3 = [number, number, number];
type Geo = THREE.BufferGeometry;

/** Build with `palette` over the arm builder's palette, then put the old colours back (the module's palette is shared). */
function withArmPalette<T>(palette: ArmPaletteRow, build: () => T): T {
  const saved = new Map<ArmPaletteKey, THREE.Color>();
  for (const k of Object.keys(palette) as ArmPaletteKey[]) { const hex = palette[k]; if (hex === undefined) continue; saved.set(k, ARM_PAL[k].clone()); ARM_PAL[k].copy(lin(hex)); }
  try { return build(); } finally { for (const [k, c] of saved) ARM_PAL[k].copy(c); }
}

// ───────────────────────────── the forearms ─────────────────────────────

function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** rings × (RAD + 1) vertices → an indexed tube with smooth normals (and a uv if given) */
function tube(rings: number, RAD: number, pos: number[], col: number[], uv: number[] | null): Geo {
  const idx: number[] = [], row = RAD + 1;
  for (let i = 0; i < rings - 1; i++) for (let k = 0; k < RAD; k++) { const a = i * row + k, b = a + 1, d = a + row, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const GAUNT = 0.068, CUFF = 0.118;
/** The forearm along +Y, `len` m: the glove's flared gauntlet (a rolled, stitched edge), a ribbed knit cuff, the canvas
 *  sleeve (soft folds, a darker seam). */
function gloveSleeve(len = 0.55, seed = 1): Geo {
  const P = ARM_PAL, leather = P.leather, leatherLight = P.leatherLight, leatherDark = P.leatherDark, edge = P.leatherEdge, thread = P.thread;
  const knit = P.fleece, knitShade = P.fleeceShade, knitDeep = P.fleeceDeep, canvas = P.wool, canvasShade = P.woolShade;
  const RAD = 32;
  const ys: number[] = [];
  for (let y = 0; y < len;) { ys.push(y); y += y < GAUNT ? 0.0085 : y < CUFF + 0.01 ? 0.005 : y < 0.25 ? 0.02 : 0.045; }
  ys.push(len);
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  for (const y of ys) {
    for (let k = 0; k <= RAD; k++) {
      const a = k / RAD, ph = a * Math.PI * 2;
      let r: number;
      if (y < GAUNT) {
        const t = y / GAUNT;
        r = 0.033 + 0.011 * t * t + 0.0022 * Math.exp(-(((t - 0.93) / 0.06) ** 2));
        c.copy(leather).lerp(leatherLight, 0.22 + 0.18 * Math.sin(ph + 0.4));
        if (t > 0.86) c.lerp(edge, 0.6);
        if (Math.abs(Math.sin(ph * 0.5 - 0.3)) < 0.05 && t > 0.15 && t < 0.85) c.lerp(thread, 0.45);
        c.multiplyScalar(0.9 + 0.1 * vnoise(ph * 4, y * 90 + seed));
        if (t < 0.12) c.lerp(leatherDark, 0.5 * (1 - t / 0.12));
      } else if (y < CUFF) {
        const t = (y - GAUNT) / (CUFF - GAUNT), rib = Math.cos(ph * 12);
        r = 0.044 + 0.006 * Math.sin(t * Math.PI) ** 0.7 + 0.0011 * rib;
        c.copy(knit).lerp(knitShade, 0.35 * (0.5 - 0.5 * rib) + 0.2 * vnoise(ph * 9 + seed, y * 300)).lerp(knitDeep, 0.45 * (1 - Math.sin(t * Math.PI)) ** 2);
      } else {
        const s = y - CUFF;
        const fold = Math.sin(ph * 3 + y * 7 + seed) * 0.6 + Math.sin(ph * 5 - y * 11 + seed * 2) * 0.4;
        r = 0.049 + Math.min(1, s / 0.3) * 0.012 + 0.0028 * fold * Math.min(1, s / 0.04);
        c.copy(canvas).lerp(canvasShade, 0.4 * Math.max(0, -fold) + 0.45 * Math.exp(-s * 45));
        if (Math.abs(Math.sin(ph * 0.5 + 1.1)) < 0.035) c.lerp(canvasShade, 0.7);
        c.multiplyScalar(0.92 + 0.1 * vnoise(ph * 14, y * 60 + seed));
      }
      pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
      col.push(c.r, c.g, c.b);
    }
  }
  return tube(ys.length, RAD, pos, col, null);
}

/** The glove's gauntlet alone, `len` m along +Y from the wrist: flared leather, a rolled edge (it tucks into the coat's cuff). */
function gloveGauntlet(len = 0.06): Geo {
  const P = ARM_PAL, leather = P.leather, light = P.leatherLight, dark = P.leatherDark, edge = P.leatherEdge;
  const RAD = 24, ys: number[] = [];
  for (let y = 0; y < len; y += 0.008) ys.push(y);
  ys.push(len);
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  for (const y of ys) for (let k = 0; k <= RAD; k++) {
    const ph = (k / RAD) * Math.PI * 2, t = y / len;
    const r = 0.033 + 0.007 * t + 0.0015 * Math.exp(-(((t - 0.92) / 0.07) ** 2));
    c.copy(leather).lerp(light, 0.22 + 0.18 * Math.sin(ph + 0.4));
    if (t > 0.85) c.lerp(edge, 0.55);
    if (t < 0.15) c.lerp(dark, 0.45 * (1 - t / 0.15));
    pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r); col.push(c.r, c.g, c.b);
  }
  return tube(ys.length, RAD, pos, col, null);
}

/** Where the coat's cuff starts past the glove's wrist (m, along the forearm): the gauntlet runs on inside it. */
const COAT_FROM = 0.02;
const CUFF_LEN = 0.075;
/** The coat sleeve along +Y from its cuff's edge: a turned-back cuff (a rolled lip, two stitched seams), then the sleeve
 *  (bunched compression folds, long soft folds, the seam along the underside); the uv lays the runtime's waxed canvas. */
function coatSleeve(look: GloveHandsLook, len = 1, seed = 1): Geo {
  const cloth = ARM_PAL.wool, shade = ARM_PAL.woolShade;
  const RAD = 40, ys: number[] = [];
  for (let y = 0; y < len;) { ys.push(y); y += y < CUFF_LEN + 0.004 ? 0.004 : y < 0.3 ? 0.008 : 0.03; }
  ys.push(len);
  const pos: number[] = [], col: number[] = [], uv: number[] = [], c = new THREE.Color();
  const lip = lin(look.coatLip), stitch = lin(look.coatStitch);
  for (const y of ys) for (let k = 0; k <= RAD; k++) {
    const a = k / RAD, ph = a * Math.PI * 2;
    let r: number;
    c.copy(cloth);
    if (y <= CUFF_LEN) {
      const t = y / CUFF_LEN;
      r = 0.05 + 0.0035 * Math.exp(-((t / 0.12) ** 2)) - 0.0035 * (t < 0.03 ? 1 - t / 0.03 : 0) + 0.0012 * Math.sin(ph * 2 + seed) * t;
      for (const sy of [0.2, 0.86]) if (Math.abs(t - sy) < 0.03) { r -= 0.0007; c.lerp(stitch, 0.55); }
      c.lerp(lip, 0.5 * Math.exp(-((t / 0.1) ** 2)));
      c.lerp(shade, 0.25 * Math.max(0, -Math.sin(ph - 0.6)));
      if (t < 0.03) c.multiplyScalar(0.55);
    } else {
      const s = y - CUFF_LEN;
      const bunch = Math.exp(-s * 16) * (0.5 + 0.5 * Math.sin(ph * 3 + seed + Math.sin(s * 60) * 1.5)) * Math.sin(s * 95);
      const fold = Math.sin(ph * 3 + y * 6 + seed) * 0.6 + Math.sin(ph * 5 - y * 9 + seed * 2) * 0.4;
      r = 0.046 + Math.min(1, s / 0.3) * 0.013 + 0.0026 * fold + 0.0022 * bunch - 0.002 * Math.exp(-((s / 0.006) ** 2));
      c.lerp(shade, 0.42 * Math.max(0, -fold) + 0.35 * Math.max(0, -bunch) + 0.5 * Math.exp(-s * 70));
      c.lerp(lip, 0.18 * Math.max(0, bunch));
      if (Math.abs(Math.sin(ph * 0.5 + 1.1)) < 0.04) c.lerp(stitch, 0.5);
    }
    pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
    col.push(c.r, c.g, c.b);
    uv.push(a * 6, y * 20);
  }
  return tube(ys.length, RAD, pos, col, uv);
}

// ───────────────────────────── a hand ─────────────────────────────

const Y_AXIS = new THREE.Vector3(0, 1, 0);
function tintGeo(g: Geo, t: readonly [number, number, number]): Geo {
  if (t[0] === 1 && t[1] === 1 && t[2] === 1) return g;
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * t[0], c.getY(i) * t[1], c.getZ(i) * t[2]);
  return g;
}
/** a zero uv beside the vertex colours (the viewmodel program's map slots hold 1×1 fillers) */
function zeroUv(g: Geo): Geo { g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2)); return g; }
const onlyPNC = (g: Geo): Geo => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); return g; };

interface BuiltHand { geometry: Geo; sleeve: Geo | null; wrist: THREE.Vector3; dir: THREE.Vector3 }
function buildHand(look: GloveHandsLook, spec: HandSpec, free: boolean): BuiltHand {
  const mirror = spec.mirror === true, sx = mirror ? -1 : 1, k = spec.tint ?? 1, tint: V3 = [k, k, k], glove = spec.gloveTint ?? tint;
  return withArmPalette(look.palette, () => {
    const fist = gloveFist({ R: spec.R, mirror, span: spec.span ?? 1, curl: spec.curl ?? 1, thumbCurl: spec.thumbCurl ?? spec.curl ?? 1 });
    const bend = spec.bend ?? [0.12, 0];
    const d = new THREE.Vector3(sx * bend[0], bend[1], 1).normalize(), toD = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d);
    const start = fist.wrist.clone().addScaledVector(d, -0.016); // the gauntlet laps over the back of the hand
    if (spec.coat === true) {
      const g = onlyPNC(gloveGauntlet(0.06)).applyQuaternion(toD).translate(start.x, start.y, start.z);
      const out = mergeGeometries([onlyPNC(fist.geometry), g], false);
      const coat = tintGeo(coatSleeve(look, spec.armLen ?? 1, mirror ? 2 : 1), tint);
      return { geometry: zeroUv(tintGeo(out, glove)), sleeve: coat, wrist: start.clone().addScaledVector(d, COAT_FROM), dir: d };
    }
    const arm = tintGeo(onlyPNC(gloveSleeve(spec.armLen ?? 0.55, mirror ? 2 : 1)), tint);
    tintGeo(onlyPNC(fist.geometry), glove);
    if (free) return { geometry: zeroUv(fist.geometry), sleeve: zeroUv(arm), wrist: start, dir: d };
    arm.applyQuaternion(toD);
    arm.translate(start.x, start.y, start.z);
    return { geometry: zeroUv(mergeGeometries([fist.geometry, arm], false)), sleeve: null, wrist: start, dir: d };
  });
}

// ───────────────────────────── the Longbow ─────────────────────────────

function paint(g: Geo, c: THREE.Color, jitter: number, seed: number): Geo {
  const n = g.getAttribute('position').count, out = new Float32Array(n * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = 1 - jitter + (s / 4294967296) * jitter * 2;
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return onlyPNC(g);
}
/** A planar uv from the vertex positions (the shared program samples its 1×1 fillers; a uv keeps the TBN finite). */
function planarUv(g: Geo, k = 8): Geo {
  const p = g.getAttribute('position'), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * k; uv[i * 2 + 1] = p.getY(i) * k; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** The arrow: a shaft, a sinew-bound bodkin head, three feathers (the first the cock feather). TIP at the origin, shaft
 *  along +Z (`look.length`). Feathers two-faced (no DoubleSide program). */
function arrowGeometry(look: ArrowLook): Geo {
  const L = look.length, r = 0.0045;
  const shaftC = new THREE.Color(look.shaft), shaftDark = new THREE.Color(look.shaftDark), binding = new THREE.Color(look.binding), headC = new THREE.Color(look.head);
  const feather = new THREE.Color(look.feather), featherBar = new THREE.Color(look.featherBar);
  const parts: Geo[] = [];
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

const STRING_RINGS = 4;
function grain(x: number, y: number): number { const h = (a: number, b: number): number => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }

/** The stave's painted colour at arc length u, ring angle φ (sin φ > 0 = the belly): the pale sapwood back, the heartwood
 *  belly with dark streaks and pin knots, the leather grip with its amber inlay, horn nocks. */
function limbColor(look: StaveBowLook, bowLen: number, out: number[], u: number, phi: number, sign: number): void {
  const P = look.palette, C = (hex: number): THREE.Color => new THREE.Color(hex);
  const { gripH: GRIP_H, limbW: LIMB_W } = look;
  const belly = Math.sin(phi);
  if (u <= GRIP_H) {
    const wrap = Math.max(0, Math.sin(u * 300 * sign + phi * 2)) ** 3;
    if (Math.abs(u - GRIP_H * 0.5) < 0.006 && belly < -0.2) { mix3(out, C(P.amber), C(P.amber), 0, 1.15); return; }
    mix3(out, C(P.leather), C(P.leatherHi), 0.15 + wrap * 0.7, 0.85 + 0.15 * wrap); return;
  }
  const w = u - GRIP_H;
  if (w > LIMB_W) { const g = grain(u * 200, phi * 3); mix3(out, C(P.horn), C(P.hornHi), 0.25 * g + (u > bowLen - 0.008 ? 0.5 : 0)); return; }
  const g1 = grain(u * 26 + sign * 3, phi * 1.7), g2 = grain(u * 140, phi * 5 + sign);
  const line = -0.25 + 0.22 * (grain(u * 9 + sign * 11, 1.3) - 0.5);
  if (belly < line - 0.08) { mix3(out, C(P.sap), C(P.sapDark), 0.25 * g2 + 0.2 * g1, 0.96 + 0.06 * g1); return; }
  if (belly < line + 0.08) { mix3(out, C(P.sapDark), C(P.heartHi), (belly - line + 0.08) / 0.16); return; }
  const streak = 0.5 + 0.5 * Math.sin(u * 55 + 4 * Math.sin(u * 7 + sign * 2) + phi * 2);
  const knot = grain(u * 40 + 5, phi * 4) > 0.9 ? 0.7 : 0;
  const c = C(P.heart).lerp(C(P.heartHi), streak * 0.45 * (0.6 + 0.4 * g2)).lerp(C(P.heartDark), knot + 0.15 * g1);
  out.push(c.r, c.g, c.b);
}

/** The stave's rings (arc length and limb side), and the stave + string with `fist` after them: the colours, uv and index
 *  are final; the first `dynVerts` positions and normals are zero (the runtime's StaveBowMesh shapes them every draw). */
function staveRest(look: StaveBowLook, fist: Geo): { geometry: Geo; ringU: number[]; ringSign: number[]; limbVerts: number; dynVerts: number } {
  const { gripH: GRIP_H, limbW: LIMB_W, nockL: NOCK_L, radial: RADIAL, stringRadial: STRING_RADIAL } = look;
  const BOW_LEN = GRIP_H + LIMB_W + NOCK_L;
  const ringU: number[] = [], ringSign: number[] = [];
  for (const sign of [-1, 1]) {
    const us: number[] = [];
    for (let u = 0; u <= BOW_LEN + 1e-6; u += u < GRIP_H ? 0.006 : u < GRIP_H + LIMB_W ? 0.012 : 0.006) us.push(Math.min(u, BOW_LEN));
    if ((us[us.length - 1] ?? 0) < BOW_LEN) us.push(BOW_LEN);
    if (sign < 0) { for (let i = us.length - 1; i >= 1; i--) { ringU.push(us[i] ?? 0); ringSign.push(-1); } }
    else for (const u of us) { ringU.push(u); ringSign.push(1); }
  }
  const rings = ringU.length, limbVerts = rings * (RADIAL + 1) + 2, dynVerts = limbVerts + 2 * STRING_RINGS * STRING_RADIAL;
  const statVerts = fist.getAttribute('position').count, total = dynVerts + statVerts;
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  const col: number[] = [], uv: number[] = [], idx: number[] = [];
  const horn = new THREE.Color(look.palette.horn), str = new THREE.Color(look.palette.string), serving = new THREE.Color(look.palette.serving);
  for (let r = 0; r < rings; r++) {
    const u = ringU[r] ?? 0, sign = ringSign[r] ?? 1;
    for (let k = 0; k <= RADIAL; k++) { limbColor(look, BOW_LEN, col, u, (k / RADIAL) * Math.PI * 2, sign); uv.push(k / RADIAL, u * sign * 6); }
  }
  mix3(col, horn, horn, 0); mix3(col, horn, horn, 0); uv.push(0, 0, 0, 1);
  for (let r = 0; r < rings - 1; r++) for (let k = 0; k < RADIAL; k++) { const a = r * (RADIAL + 1) + k, b = a + RADIAL + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const capBot = rings * (RADIAL + 1), capTop = capBot + 1, lastRing = (rings - 1) * (RADIAL + 1);
  for (let k = 0; k < RADIAL; k++) { idx.push(capBot, k + 1, k); idx.push(capTop, lastRing + k, lastRing + k + 1); }
  for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
    const serv = ring >= 2;
    mix3(col, serv ? serving : str, serv ? serving : str, 0, 0.9 + 0.1 * (k % 2));
    uv.push(k / STRING_RADIAL, ring * 3);
  }
  for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS - 1; ring++) {
    const o = limbVerts + (leg * STRING_RINGS + ring) * STRING_RADIAL;
    for (let k = 0; k < STRING_RADIAL; k++) { const a = o + k, a1 = o + ((k + 1) % STRING_RADIAL), b = a + STRING_RADIAL, b1 = a1 + STRING_RADIAL; idx.push(a, a1, b, a1, b1, b); }
  }
  const sp = fist.getAttribute('position'), sn = fist.getAttribute('normal'), sc = fist.getAttribute('color');
  for (let i = 0; i < statVerts; i++) {
    const j = (dynVerts + i) * 3;
    pos[j] = sp.getX(i); pos[j + 1] = sp.getY(i); pos[j + 2] = sp.getZ(i);
    nrm[j] = sn.getX(i); nrm[j + 1] = sn.getY(i); nrm[j + 2] = sn.getZ(i);
    col.push(sc.getX(i), sc.getY(i), sc.getZ(i));
    uv.push((sp.getX(i) + sp.getZ(i)) * 8, sp.getY(i) * 8);
  }
  const si = fist.getIndex();
  if (si) for (let i = 0; i < si.count; i++) idx.push(si.getX(i) + dynVerts);
  else for (let i = 0; i < statVerts; i++) idx.push(i + dynVerts);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geometry: g, ringU, ringSign, limbVerts, dynVerts };
}

/** The Longbow sleeves' vertex budget: the engine's rider arm (96 around, 3 mm rings through its ornament bands) is ~19-20 k
 *  vertices; first person needs a few thousand, so the bake simplifies it, weighing the vertex colours (the felt bands)
 *  and normals (the folds) so the pattern and silhouette keep where they change. Kept vertices keep their own normals. */
const SLEEVE_VERTS = 7000;
function decimate(g: Geo, verts: number): Geo {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color'), src = g.getIndex();
  if (src === null) throw new Error('[pine-hollow hands pool] a sleeve to decimate must be indexed');
  const count = p.count, pos = new Float32Array(count * 3), attr = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
    attr.set([c.getX(i), c.getY(i), c.getZ(i), n.getX(i), n.getY(i), n.getZ(i)], i * 6);
  }
  const index = Uint32Array.from({ length: src.count }, (_, i) => src.getX(i));
  const target = Math.round(index.length * (verts / count) / 3) * 3;
  const [kept] = MeshoptSimplifier.simplifyWithAttributes(index, pos, 3, attr, 6, [12, 12, 12, 1, 1, 1], null, target, 0.05);
  const remap = new Int32Array(count).fill(-1), order: number[] = [];
  const out = new Uint32Array(kept.length);
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i] ?? 0;
    let m = remap[v] ?? -1;
    if (m < 0) { m = order.length; remap[v] = m; order.push(v); }
    out[i] = m;
  }
  const take = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute => {
    const o = new Float32Array(order.length * 3);
    order.forEach((v, i) => { o[i * 3] = a.getX(v); o[i * 3 + 1] = a.getY(v); o[i * 3 + 2] = a.getZ(v); });
    return new THREE.BufferAttribute(o, 3);
  };
  const d = new THREE.BufferGeometry();
  d.setAttribute('position', take(p)); d.setAttribute('normal', take(n)); d.setAttribute('color', take(c));
  d.setIndex(new THREE.BufferAttribute(out, 1));
  return d;
}

// ───────────────────────────── the pool ─────────────────────────────

/** Every hand a weapon holds: its part name, its HandHold spec (Crossbow.ts CROSSBOW_HAND_HOLDS, LeverRifle.ts
 *  LEVER_HAND_HOLDS, verbatim and in their key order: the bake key is their JSON) and whether it is the left (mirrored). */
const HAND_SPECS: readonly (readonly [string, HandSpec, boolean])[] = [
  ['crossbow-left', { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, true],
  ['crossbow-right', { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, false],
  ['lever-left', { R: 0.02, curl: 0.8, bend: [0.4, -0.8], armLen: 0.5, tint: 2.2, gloveTint: BUCKSKIN }, true],
  ['lever-right', { R: 0.012, span: 0.9, bend: [0.3, -0.6], armLen: 0.5, tint: 2.2, gloveTint: BUCKSKIN }, false],
];
const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
/** A hand's bake key: the look, the spec as the weapon passes it, and whether its sleeve is free (gloveHands.handKey). */
const handKey = (look: GloveHandsLook, spec: HandSpec, free: boolean): string => JSON.stringify([look, spec, free]);

/** Every hand and Longbow part as one rest-geometry pool GLB, and the rows the runtime reads it by. */
export async function handsPool(): Promise<{ glb: Uint8Array; rows: unknown }> {
  await MeshoptSimplifier.ready;
  const parts = new Map<string, Geo>();
  const hands: Record<string, { geometry: string; sleeve: string | null; wrist: V3; dir: V3 }> = {};
  for (const [name, held, mirror] of HAND_SPECS) {
    const spec: HandSpec = { ...held, mirror }, free = held.elbow !== undefined, made = buildHand(HUNTER_HANDS, spec, free);
    parts.set(`hand-${name}`, made.geometry);
    if (made.sleeve !== null) parts.set(`sleeve-${name}`, made.sleeve);
    hands[handKey(HUNTER_HANDS, spec, free)] = { geometry: `hand-${name}`, sleeve: made.sleeve === null ? null : `sleeve-${name}`, wrist: v3(made.wrist), dir: v3(made.dir) };
  }
  const look = LONGBOW_LOOK;
  const { lf, rf, lArm, rArm } = withArmPalette(look.hands, () => ({ lf: gloveFist(look.leftFist), rf: gloveFist(look.rightFist), lArm: riderArm(...look.leftSleeve), rArm: riderArm(...look.rightSleeve) }));
  const stave = staveRest(look, lf.geometry);
  parts.set('bow-stave', stave.geometry);
  parts.set('bow-right-fist', planarUv(rf.geometry));
  parts.set('bow-left-sleeve', planarUv(decimate(lArm, SLEEVE_VERTS)));
  parts.set('bow-right-sleeve', planarUv(decimate(rArm, SLEEVE_VERTS)));
  parts.set('bow-arrow', arrowGeometry(look.arrow));
  parts.set('bow-arrow-nocked', planarUv(arrowGeometry(look.arrow), 20));
  const bow = {
    look: JSON.stringify(look), arrow: JSON.stringify(look.arrow), ringU: stave.ringU, ringSign: stave.ringSign, limbVerts: stave.limbVerts, dynVerts: stave.dynVerts,
    lWrist: v3(lf.wrist), rWrist: v3(rf.wrist), rHook: v3(rf.hook), rWristDir: v3(rf.wristDir),
  };
  const neutral = new THREE.MeshStandardMaterial();
  const glb = staticGlb([...parts].map(([name, geometry]) => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const box = geometry.boundingBox, sphere = geometry.boundingSphere;
    return { name, geometry, material: neutral, compactIndex: true as const, extras: {
      restGroups: [],
      restBox: name === 'bow-stave' || box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
      restSphere: name === 'bow-stave' || sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
    } };
  }), 'pine-hands-pool');
  return { glb, rows: { pool: { url: '/assets/pine-hollow/baked/hands-pool.glb', parts: [...parts.keys()] }, hands, bow } };
}

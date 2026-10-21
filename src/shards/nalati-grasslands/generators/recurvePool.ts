import ARM_STYLE from '../data/armsStyle.json' with {type:'json'};
// Nalati's composite recurve, baked (SHARD-PLATFORM C6 view, G467): the horn-and-sinew bow with the left glove on it, the
// right thumb-draw fist, both rider sleeves and the birch arrow (loose and nocked), built once here with the engine's arm
// builder (nalatiArms) and written as one rest-geometry pool GLB plus the held bow draw's rows (@wildshard/game/plugin/
// heldLauncher heldBowProfile; the rows file loads with its loadHeldBow). The runtime borrows the parts by name and bends the stave on the engine's BowShape; it
// builds no bow. The Golden Bow and the Sky-Wolf skin are the same bow repainted: each paint is a colour channel on the
// stave (`styles`, the first the base), swapped in by the host's repaint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { gloveFist, riderArm } from '@wildshard/engine/player/firstPersonArms';
import items from '../data/items.json' with { type: 'json' };
import { BowWeaponProfileSchema, type HeldBowBaseSchema } from '@wildshard/format/weaponProfiles';
import { BOW } from '@wildshard/game/weapons/starterBowProfile';
import * as schema from 'valibot';

const BOW_PROFILE = schema.parse(BowWeaponProfileSchema, items.rows.find(row => row.id === 'weapon.bow')?.profile);

/** Original riding/feel/loose policy, emitted without executable view strategies. */
export function recurveBase(): schema.InferInput<typeof HeldBowBaseSchema> {
  const { wind, ...base } = BOW; void wind;
  return { ...base, quiver: BOW_PROFILE.quiver, speedBase: BOW_PROFILE.speedBase, speedDraw: BOW_PROFILE.speedDraw, damageScale: BOW_PROFILE.damageScale,
    aimSpread: BOW_PROFILE.spread.aimMultiplier, draw: BOW_PROFILE.draw, loose: { ...BOW_PROFILE.spread, muzzle: BOW_PROFILE.muzzle },
    projectile: { ...BOW_PROFILE.flight, maxFlying: BOW_PROFILE.pool, substeps: BOW_PROFILE.substeps, lifetime: BOW_PROFILE.lifetime }, mounted: {
      drawTime: 0.9, rearAngle: 110, rearDraw: 0.2, rearSpread: 0.5, arc: false,
      gaits: [{ below: 0.3, spread: 0.3 }, { below: 3.2, spread: 0.8 }, { below: 6.5, spread: 3 }, { below: 10.5, spread: 1.5 }, { below: null, spread: 1.8 }],
    } };
}

type V3 = [number, number, number];
const C = (hex: number) => new THREE.Color(hex);
const PAL = {
  lacquer: C(0x7a3a1c), ornament: C(0xe0c080), horn: C(0x2a1a10),
  bone: C(0xe6dcc2), boneDark: C(0x5a4a38), sinew: C(0xd8c8a0), leather: C(0x3c2414), leatherHi: C(0x5a3a22),
  string: C(0xd4c8a8), serving: C(0x4a3424), hornHoney: C(0x9a6a34), birchBark: C(0xd8bc92), lenticel: C(0x4a3424), gold: C(0xe0b864),
  shaft: C(0xc8a070), shaftDark: C(0x8a6440), head: C(0x3a3c40), feather: C(0xece6da), featherBar: C(0x4a3a30), crest: C(0xa82a1c),
};

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

/** The arrow: birch shaft with a red cresting band, iron leaf head, three barred feathers. TIP at the origin, shaft
 *  along +Z (`ARROW_LEN`), so a stuck one is placed at the hit point. Feathers are two-faced (no DoubleSide program). */
const ARROW_LEN = 0.8;
function arrowGeometry(): THREE.BufferGeometry {
  const L = ARROW_LEN, r = 0.0042;
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(r, r * 0.92, L - 0.07, 6, 1); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.065 + (L - 0.07) / 2);
  parts.push(paint(shaft, PAL.shaft, 0.08, 11));
  const crest = new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.05, 6, 1); crest.rotateX(Math.PI / 2); crest.translate(0, 0, L - 0.2);
  parts.push(paint(crest, PAL.crest, 0.05, 12));
  const nock = new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.014, 6, 1); nock.rotateX(Math.PI / 2); nock.translate(0, 0, L - 0.004);
  parts.push(paint(nock, PAL.shaftDark, 0.04, 13));
  const head = new THREE.ConeGeometry(0.011, 0.058, 4, 1); head.rotateY(Math.PI / 4); head.scale(1, 1, 0.3); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.029);
  parts.push(paint(head, PAL.head, 0.08, 14));
  const socket = new THREE.CylinderGeometry(r * 1.05, r * 1.25, 0.018, 6, 1); socket.rotateX(Math.PI / 2); socket.translate(0, 0, 0.064);
  parts.push(paint(socket, PAL.head, 0.05, 15));
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 6, z0 = L - 0.035, len = 0.13;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = z0 - t * len;
      const h = 0.017 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.35 * t * t);
      const c = t > 0.45 && t < 0.62 ? PAL.featherBar : PAL.feather;
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
  return mergeGeometries(parts, false);
}

/* Bow-local frame: grip centre at the origin, +Y up the bow, −Z = where the arrow flies (the bow's back), +Z toward the
 * archer (the belly), +X the archer's right (a thumb draw). Each limb is the grip, a working limb bending at curvature κ
 * toward the archer, then the stiff siyah (ear) kinked forward by `tipKink` (the engine's BowShape bends it per draw). */
const GRIP_H = 0.07, LIMB_W = 0.42, SIYAH = 0.15;
const BOW_LEN = GRIP_H + LIMB_W + SIYAH;
const RADIAL = 16, STRING_RADIAL = 6, STRING_RINGS = 4;
/** The recurve's look as the held bow draw reads it (`bake.look`): the bend, the string, the arrow's rest, the tips. */
const LOOK = {
  gripH: GRIP_H, limbW: LIMB_W, nockL: SIYAH, kappaRest: 2.1, kappaDraw: 1.35, tipKink: 0.95,
  braceZ: 0.163, drawLen: 0.58, arrowX: 0.02, arrowY: 0.058, nockX: 0,
  radial: RADIAL, stringRadial: STRING_RADIAL, stringR: 0.0021, serving: 0.085, rightRoll: 1.35,
  backScale: 1, tipInset: 0.012, tipOffset: 0.006,
};
/** the fists (nalatiArms.ts): the left closed on the grip, the right a tight thumb-draw fist hooked on the string */
const L_FIST = { R: 0.021, mirror: true, yaw: -0.32 }, R_FIST = { R: 0.009, thumbRing: true, yaw: 0.55 };

/** half width (x) and half thickness (belly-back) at u */
function limbSection(u: number): [number, number] {
  if (u <= GRIP_H) { const g = 1 - (u / GRIP_H) ** 2; return [0.016 + 0.002 * g, 0.018 + 0.006 * g]; }
  const w = u - GRIP_H;
  const bind = binding(w) ? 0.0013 : 0;
  if (w <= LIMB_W) { const t = w / LIMB_W; return [0.019 - 0.006 * t + bind, 0.013 - 0.004 * t + bind]; }
  const t = (w - LIMB_W) / SIYAH;
  const bridge = 0.0045 * Math.exp(-(((t - 0.1) / 0.07) ** 2));
  return [0.011 - 0.003 * t, 0.015 - 0.004 * t + bridge];
}
/** the sinew bindings: where the grip meets the limb, and where the limb meets the bone ear */
function binding(w: number): boolean { return (w > 0 && w < 0.018) || Math.abs(w - LIMB_W) < 0.014; }
/** the leather grip's spiral wrap, as a radius multiplier */
function gripRidge(u: number, ph: number, sign: number): number { return u < GRIP_H ? 1 + 0.07 * Math.max(0, Math.sin(u * 280 * sign + ph * 2)) ** 3 : 1; }
function grain(x: number, y: number): number { const h = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }

/** the colours the limbs + string are painted from (each style is one set; the fist keeps its own) */
interface LimbPalette { leather: THREE.Color; leatherHi: THREE.Color; sinew: THREE.Color; bone: THREE.Color; boneDark: THREE.Color; birchBark: THREE.Color; lenticel: THREE.Color; lacquer: THREE.Color; gold: THREE.Color; horn: THREE.Color; hornHoney: THREE.Color; ornament: THREE.Color; string: THREE.Color; serving: THREE.Color }
const STYLES = {
  recurve: { leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: PAL.sinew, bone: PAL.bone, boneDark: PAL.boneDark, birchBark: PAL.birchBark, lenticel: PAL.lenticel, lacquer: PAL.lacquer, gold: PAL.gold, horn: PAL.horn, hornHoney: PAL.hornHoney, ornament: PAL.ornament, string: PAL.string, serving: PAL.serving },
  // the Golden Bow (the Golden King's reward, runtime/weapons/GoldenBow.ts): gold-sheathed limbs, the scroll burnished
  // bright (a touch over 1: it catches the bloom), ivory ears, a string of light
  golden: {
    leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: C(0xf0c060), bone: C(0xf4e6c0), boneDark: C(0x8a6a30),
    birchBark: C(0xc8902a), lenticel: C(0x6a4410), lacquer: C(0xb87818), gold: new THREE.Color(1.6, 1.2, 0.5),
    horn: C(0x8a5210), hornHoney: C(0xe0a030), ornament: new THREE.Color(1.5, 1.15, 0.45),
    string: new THREE.Color(3.2, 2.6, 1.3), serving: C(0xd8a040),
  },
  // the SKY-WOLF skin (Kokbori's drop, weapons/nalatiSkins.ts): blue-grey horn limbs, wolf-bone ears, a silver string
  'sky-wolf': {
    leather: C(0x2e3440), leatherHi: C(0x56606e), sinew: C(0xb8c4d0), bone: C(0xe6ecf2), boneDark: C(0x6a7684),
    birchBark: C(0x7c8a9a), lenticel: C(0x3a4452), lacquer: C(0x4a5a6e), gold: C(0xc8d4e0),
    horn: C(0x3c4a5c), hornHoney: C(0x8a9cb2), ornament: C(0xd8e4f0),
    string: new THREE.Color(1.6, 1.7, 1.9), serving: C(0x9aa6b4),
  },
} satisfies Record<string, LimbPalette>;

/** the painted colour at arc length u, ring angle φ (sin φ > 0 = belly, toward the archer) */
function limbColor(L: LimbPalette, out: number[], u: number, phi: number, sign: number): void {
  const belly = Math.sin(phi), w = u - GRIP_H;
  if (u <= GRIP_H) { const wrap = Math.max(0, Math.sin(u * 280 * sign + phi * 2)) ** 3; mix3(out, L.leather, L.leatherHi, 0.15 + wrap * 0.75, 0.85 + 0.15 * wrap); return; }
  if (binding(w)) { const b = Math.max(0, Math.sin(u * 1500 * sign + phi)) ** 2; mix3(out, L.sinew, L.bone, b * 0.5, 0.78 + 0.22 * b); return; }
  if (w > LIMB_W) {
    const t = (w - LIMB_W) / SIYAH, g = grain(u * 90, phi * 2), tip = u > BOW_LEN - 0.018 ? 0.85 : 0;
    mix3(out, L.bone, L.boneDark, Math.max(tip, 0.12 * g + 0.25 * Math.exp(-(((t - 0.1) / 0.07) ** 2)) * Math.max(0, belly)));
    return;
  }
  const t = w / LIMB_W;
  if (belly < -0.38) {
    const dash = grain(u * 170, phi * 1.5 + sign * 7) > 0.78 ? 1 : 0;
    mix3(out, L.birchBark, L.lenticel, dash * 0.85 + 0.12 * grain(u * 30, phi), 0.92 + 0.08 * grain(u * 60, 3));
    return;
  }
  if (belly < 0.38) { const rule = Math.abs(belly - 0.3) < 0.09 ? 1 : 0; mix3(out, L.lacquer, L.gold, rule * 0.85, 0.9 + 0.1 * grain(u * 40, phi * 3)); return; }
  // the belly: horn streaks with the painted ram's-horn scroll near the grip and a fine centre line out to the ear
  const streak = 0.5 + 0.5 * Math.sin(u * 60 + 3 * Math.sin(u * 9 + sign) + phi * 3);
  let orn = 0;
  if (t > 0.05 && t < 0.42) {
    const sAl = (t - 0.05) / 0.37, across = (Math.cos(phi) / 0.92) * 0.5 + 0.5, curl = 0.5 + 0.3 * Math.sin(sAl * Math.PI * 3.2);
    orn = Math.max(0, 1 - Math.abs(across - curl) * 5) * (sAl < 0.95 ? 1 : 0);
    const bay = Math.hypot((across - (curl > 0.5 ? 0.22 : 0.78)) * 1.4, ((sAl * 3.2 * 0.5) % 1) - 0.5);
    orn = Math.max(orn, bay < 0.16 ? 0.9 : 0);
    if (sAl < 0.04 || sAl > 0.92) orn = Math.max(orn, 0.95);
  } else if (t >= 0.42 && t < 0.97) orn = Math.max(0, 1 - Math.abs(Math.cos(phi)) * 5) * 0.75;
  const hornR = L.horn.r + (L.hornHoney.r - L.horn.r) * streak, hornG = L.horn.g + (L.hornHoney.g - L.horn.g) * streak, hornB = L.horn.b + (L.hornHoney.b - L.horn.b) * streak;
  const o = Math.min(1, orn);
  out.push(hornR + (L.ornament.r - hornR) * o, hornG + (L.ornament.g - hornG) * o, hornB + (L.ornament.b - hornB) * o);
}

/** The stave's rings (signed arc length, lower tip → upper tip, denser where the ornament is). */
function rings(): { ringU: number[]; ringSign: number[] } {
  const ringU: number[] = [], ringSign: number[] = [];
  for (const sign of [-1, 1]) {
    const us: number[] = [];
    for (let u = 0; u <= BOW_LEN + 1e-6; u += u < GRIP_H ? 0.01 : u < GRIP_H + LIMB_W * 0.45 ? 0.0045 : u < GRIP_H + LIMB_W ? 0.008 : 0.01) us.push(Math.min(u, BOW_LEN));
    if ((us[us.length - 1] ?? 0) < BOW_LEN) us.push(BOW_LEN);
    if (sign < 0) { for (let i = us.length - 1; i >= 1; i--) { ringU.push(us[i] ?? 0); ringSign.push(-1); } }
    else for (const u of us) { ringU.push(u); ringSign.push(1); }
  }
  return { ringU, ringSign };
}
/** One style's colours over the stave, string and fist (the fist's own colours after the dynamic range). */
function staveColours(L: LimbPalette, ringU: readonly number[], ringSign: readonly number[], fist: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const col: number[] = [];
  for (let r = 0; r < ringU.length; r++) for (let k = 0; k <= RADIAL; k++) limbColor(L, col, ringU[r] ?? 0, (k / RADIAL) * Math.PI * 2, ringSign[r] ?? 1);
  mix3(col, L.boneDark, L.boneDark, 0); mix3(col, L.boneDark, L.boneDark, 0); // caps
  for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
    const c = ring >= 2 ? L.serving : L.string;
    mix3(col, c, c, 0, 0.9 + 0.1 * (k % 2));
  }
  for (let i = 0; i < fist.count; i++) col.push(fist.getX(i), fist.getY(i), fist.getZ(i));
  return new Float32Array(col);
}
/** The stave + string with the left fist after them: colours (one channel per style) and index final; the first
 *  `dynVerts` positions and normals are zero (the engine's BowShape shapes them every draw). */
function staveRest(fist: THREE.BufferGeometry) {
  const { ringU, ringSign } = rings();
  const limbVerts = ringU.length * (RADIAL + 1) + 2, dynVerts = limbVerts + 2 * STRING_RINGS * STRING_RADIAL;
  const fp = fist.getAttribute('position'), fn = fist.getAttribute('normal'), fc = fist.getAttribute('color');
  const total = dynVerts + fp.count, pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), idx: number[] = [];
  for (let r = 0; r < ringU.length - 1; r++) for (let k = 0; k < RADIAL; k++) { const a = r * (RADIAL + 1) + k, b = a + RADIAL + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const capBot = ringU.length * (RADIAL + 1), capTop = capBot + 1, lastRing = (ringU.length - 1) * (RADIAL + 1);
  for (let k = 0; k < RADIAL; k++) { idx.push(capBot, k + 1, k); idx.push(capTop, lastRing + k, lastRing + k + 1); }
  for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS - 1; ring++) {
    const o = limbVerts + (leg * STRING_RINGS + ring) * STRING_RADIAL;
    for (let k = 0; k < STRING_RADIAL; k++) { const a = o + k, a1 = o + ((k + 1) % STRING_RADIAL), b = a + STRING_RADIAL, b1 = a1 + STRING_RADIAL; idx.push(a, a1, b, a1, b1, b); }
  }
  for (let i = 0; i < fp.count; i++) {
    const j = (dynVerts + i) * 3;
    pos[j] = fp.getX(i); pos[j + 1] = fp.getY(i); pos[j + 2] = fp.getZ(i);
    nrm[j] = fn.getX(i); nrm[j + 1] = fn.getY(i); nrm[j + 2] = fn.getZ(i);
  }
  const fi = fist.getIndex();
  if (fi) for (let i = 0; i < fi.count; i++) idx.push(fi.getX(i) + dynVerts);
  else for (let i = 0; i < fp.count; i++) idx.push(i + dynVerts);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const base = new THREE.BufferAttribute(staveColours(STYLES.recurve, ringU, ringSign, fc), 3);
  g.setAttribute('color', base); g.setAttribute('paintRecurve', base.clone());
  g.setAttribute('paintGolden', new THREE.BufferAttribute(staveColours(STYLES.golden, ringU, ringSign, fc), 3));
  g.setAttribute('paintSkyWolf', new THREE.BufferAttribute(staveColours(STYLES['sky-wolf'], ringU, ringSign, fc), 3));
  g.setIndex(idx);
  return { geometry: g, ringU, ringSign, limbVerts, dynVerts };
}

/** The sleeves' vertex budget: the engine's rider arm is ~19.6 k vertices (96 around, 3 mm rings through its ornament
 *  bands); simplified with colour and normal weights it reads the same at arm's length and keeps the pool under 1 MB. */
const SLEEVE_VERTS = 6000;
function decimate(g: THREE.BufferGeometry, verts: number): THREE.BufferGeometry {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color'), src = g.getIndex();
  if (src === null) throw new Error('[nalati recurve pool] a sleeve to decimate must be indexed');
  const count = p.count, pos = new Float32Array(count * 3), attr = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
    attr.set([c.getX(i), c.getY(i), c.getZ(i), n.getX(i), n.getY(i), n.getZ(i)], i * 6);
  }
  const index = Uint32Array.from({ length: src.count }, (_, i) => src.getX(i));
  const target = Math.round(index.length * (verts / count) / 3) * 3;
  const [kept] = MeshoptSimplifier.simplifyWithAttributes(index, pos, 3, attr, 6, [12, 12, 12, 1, 1, 1], null, target, 0.05);
  const remap = new Int32Array(count).fill(-1), order: number[] = [], out = new Uint32Array(kept.length);
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

const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
const V = (x: number, y: number, z: number): V3 => [x, y, z];
/* Poses in rig space. REST = the bow lowered and canted (no arrow). DRAWN = the fist right of centre, the bow canted ~20°,
 * the arrow converging on the crosshair a couple of metres out. AIM (N18): down the arrow, the fist BELOW the crosshair,
 * the shaft crossing it ~7–8 m out. Portrait phones get their own (narrower frame). */
const POSES = {
  rest: { pos: V(0.34, -0.42, -0.86), aim: V(-0.1, 0.25, -4), cant: -0.62, pitch: -0.14 },
  drawn: { pos: V(0.22, -0.17, -1.12), aim: V(0, 0, -5.5), cant: -0.36, pitch: 0 },
  restPort: { pos: V(0.17, -0.5, -0.9), aim: V(-0.05, 0.12, -4), cant: -0.5, pitch: -0.12 },
  drawnPort: { pos: V(0.07, -0.1, -1.08), aim: V(0, 0, -5.5), cant: -0.3, pitch: 0 },
  aim: { pos: V(0.12, -0.24, -1.15), aim: V(-0.02, -0.058, -7), cant: -0.32, pitch: 0 },
  aimPort: { pos: V(0.04, -0.2, -1.15), aim: V(-0.02, -0.058, -8), cant: -0.22, pitch: 0 },
};
const PARTS = { stave: 'recurve-stave', nocked: 'recurve-arrow-nocked', rightFist: 'recurve-right-fist', leftSleeve: 'recurve-left-sleeve', rightSleeve: 'recurve-right-sleeve', arrow: 'recurve-arrow' };
/** the pool's style channels: GLB semantic → the loaded attribute's name */
const CHANNELS = [{ name: 'paintRecurve', semantic: '_PAINT_RECURVE' }, { name: 'paintGolden', semantic: '_PAINT_GOLDEN' }, { name: 'paintSkyWolf', semantic: '_PAINT_SKY_WOLF' }];

/** Every recurve part as one rest-geometry pool GLB, and the held bow draw's rows. */
export async function recurvePool(): Promise<{ glb: Uint8Array; rows: { pool: { url: string; parts: readonly string[]; channels: readonly unknown[] }; bow: unknown; base: ReturnType<typeof recurveBase> } }> {
  await MeshoptSimplifier.ready;
  const lf = gloveFist(ARM_STYLE, L_FIST), rf = gloveFist(ARM_STYLE, R_FIST);
  const stave = staveRest(lf.geometry);
  const parts = new Map<string, THREE.BufferGeometry>([
    [PARTS.stave, stave.geometry], [PARTS.rightFist, pnc(rf.geometry)],
    [PARTS.leftSleeve, decimate(riderArm(ARM_STYLE, 1.0, 1), SLEEVE_VERTS)], [PARTS.rightSleeve, decimate(riderArm(ARM_STYLE, 0.9, 2), SLEEVE_VERTS)],
    [PARTS.arrow, arrowGeometry()], [PARTS.nocked, arrowGeometry()],
  ]);
  const neutral = new THREE.MeshStandardMaterial();
  const glb = staticGlb([...parts].map(([name, geometry]) => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const box = geometry.boundingBox, sphere = geometry.boundingSphere, rest = name === PARTS.stave;
    return { name, geometry, material: neutral, compactIndex: true as const,
      customAttributes: rest ? Object.fromEntries(CHANNELS.map(c => [c.semantic, c.name])) : {},
      extras: { restGroups: [],
        restBox: rest || box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
        restSphere: rest || sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] } };
  }), 'nalati-recurve-pool');
  const sectionSamples = {
    widths: stave.ringU.flatMap(u => limbSection(u)),
    ridges: stave.ringU.flatMap((u, r) => Array.from({ length: RADIAL + 1 }, (_, k) => gripRidge(u, (k / RADIAL) * Math.PI * 2, stave.ringSign[r] ?? 1))),
  };
  const vm = { rim: 0.55, bands: 0.7, shade: 1 };
  const { gravity, drag, windCoupling } = BOW_PROFILE.flight;
  const bow = {
    bake: { look: JSON.stringify(LOOK), arrow: JSON.stringify({ length: ARROW_LEN }), ringU: stave.ringU, ringSign: stave.ringSign, limbVerts: stave.limbVerts, dynVerts: stave.dynVerts,
      sectionSamples, lWrist: v3(lf.wrist), rWrist: v3(rf.wrist), rHook: v3(rf.hook), rWristDir: v3(rf.wristDir) },
    parts: PARTS,
    materials: { bow: { name: 'recurve', painterly: { ...vm, transparent: true } }, arrow: { name: 'recurve-arrow', painterly: { rim: 0.45 } } },
    arrow: { gravity, drag, windCoupling, bury: 0.09, recover: 0.7, maxFlying: BOW_PROFILE.pool, maxStuck: 64 },
    wind: { field: 'steppe' },
    poses: POSES,
    styles: { recurve: 'paintRecurve', golden: 'paintGolden', 'sky-wolf': 'paintSkyWolf' },
  };
  return { glb, rows: { pool: { url: '/assets/nalati/baked/recurve-pool.glb', parts: [...parts.keys()],
    channels: CHANNELS.map(c => ({ name: c.name, source: `_${c.semantic.slice(1).toLowerCase()}`, width: 3, parts: [PARTS.stave] })) }, bow, base: recurveBase() } };
}

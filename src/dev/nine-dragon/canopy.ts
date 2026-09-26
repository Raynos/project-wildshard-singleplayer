// Copied from the organic lab (src/dev/nd-lab/organic/canopy.ts, round-9-lab-organic) into the clean room by dome B
// (E169, round-10-dome-b): the banyan's painted leaf-card canopy. Dome B's banyan (banyan.ts) plans the lumps; the
// builder at the end of this file (`buildCanopy`) dresses them and is wired in main.ts after the spill bake.
// Lab P7 "organic" (E169): the banyan's leaf mass. The clean room's canopy is the hero lab's cloud-shelves: 7–9
// flattened ellipsoid lumps on every limb tip, which read as smooth blobs. The targets (round-6 style A, round-8
// look-loop targets) show a dense, layered, PAINTED leaf mass: clusters of outlined gongbi leaves in three flat greens,
// dark bellies, light breaking through between the clusters. Four ways to build it, all on the same lumps (`planLumps`):
//  - 'lumps'  the clean room's K.leaf ellipsoids (the baseline; drawn by the Jiehua program, not here);
//  - 'cards'  painted leaf-cluster cards (a codex gongbi atlas, 2×2 clusters) clustered over every lump's surface, lit
//             with the LUMP's normal (so a card is part of a volume, never a flat cut-out), alpha-to-coverage under the
//             MSAA ×4 target (no discard), then a depth-equal pass that writes the inverse depth into alpha so the post
//             silhouette inks the leafy edge (a2c alone would write the coverage there);
//  - 'leaves' real leaf geometry: every leaf a 7-vertex fan with its outline drawn from a rim distance attribute,
//             opaque (hidden-surface removal stays on); it needs ~10× the triangles for the same cover;
//  - 'shells' the lumps re-tessellated and displaced into scalloped cloud-shelves (a leafy bump per cluster), with the
//             Voronoi leaf pattern painted in the fragment program: the cheap opaque option.
// 'cards' and 'leaves' also draw the lumps shrunk (`inner` mode, darker) as the crown's core, so no view sees through
// the tree. Every foliage fragment reports its LUMP's front depth to the post silhouette (the plateau, see the VS), and
// the silk fog runs per vertex. The winner and its parameters: art/nine-dragon-stack/round-9-lab-organic/README.md.
import {
  AddEquation, BufferGeometry, Color, CustomBlending, DoubleSide, EqualDepth, Float32BufferAttribute, FrontSide, type IUniform,
  LinearFilter, LinearMipmapLinearFilter, Mesh, OneFactor, ShaderMaterial, type Texture, TextureLoader, Uint32BufferAttribute, Vector3,
  Vector4, ZeroFactor,
} from 'three';
import { type Emitter, bakeSpill } from './emitters';
import { FOG_GLSL, NOISE_GLSL, type Shared } from './style';
import { Rng } from './util';

/** one lump of foliage: centre, radii (x, y, z; axis-aligned), how high it sits on its shelf, a seed */
export interface Lump { c: Vector3; r: Vector3; up: number; seed: number; wash: number }

const GREENS = [0x2f6a48, 0x3a7a52, 0x285c40, 0x4a8a5c, 0x23553b, 0x3f7550] as const;
const LIGHT = [0x4f8a5c, 0x5a9160, 0x467f55] as const, DARK = [0x23513a, 0x2a5a42, 0x1f4a36] as const;

/**
 * The hero banyan's canopy plan, call-for-call the same random draws as `buildBanyan`'s canopy loop (so the tree, its
 * aerial roots and its ribbons stay where they were): a cloud-shelf of 7–9 flattened lumps on every limb / twig tip.
 */
export function planLumps(tips: readonly Vector3[], rng: Rng): Lump[] {
  const out: Lump[] = [];
  for (const tip of tips) {
    const n = rng.int(7, 9);
    const shelfR = rng.range(1.0, 1.7);
    for (let j = 0; j < n; j++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = rng.range(0.2, 1) * shelfR;
      const up = rng.range(-0.25, 0.45);
      const c = tip.clone().add(new Vector3(Math.cos(a) * rr, up + 0.35, Math.sin(a) * rr));
      const s0 = rng.range(0.5, 0.9);
      const sd = rng.range(0, 10);
      const wash = up > 0.1 ? rng.pick(LIGHT) : up < -0.05 ? rng.pick(DARK) : rng.pick(GREENS);
      out.push({ c, r: new Vector3(s0 * 1.25, s0 * 0.48, s0 * 1.15), up, seed: sd, wash });
    }
  }
  return out;
}

/** the canopy's bounding ellipsoid: "how deep inside the crown" darkens the leaves (the core is in shade) */
export interface Crown { c: Vector3; r: Vector3 }
export function crownOf(lumps: readonly Lump[]): Crown {
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const l of lumps) { lo.min(l.c.clone().sub(l.r)); hi.max(l.c.clone().add(l.r)); }
  return { c: lo.clone().add(hi).multiplyScalar(0.5), r: hi.clone().sub(lo).multiplyScalar(0.5) };
}
const innerAt = (p: Vector3, k: Crown): number => {
  const q = p.clone().sub(k.c).divide(k.r);
  // 0 on the crown's skin, 1 at its heart; the underside counts as inside (it is in the crown's shadow)
  return Math.max(0, Math.min(1, 1 - q.length())) * 0.8 + Math.max(0, Math.min(1, -q.y)) * 0.35;
};

/** geometry writer: position, normal (= the SHADING normal: the lump's, not the card's), aUv (u, v, rim, _), aTone */
class Writer {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly tone: number[] = [];
  readonly lump: number[] = [];
  readonly idx: number[] = [];
  n = 0;
  /** the lump this geometry dresses: its centre and largest radius (the silhouette plateau) */
  on: Lump | null = null;
  v(p: Vector3, nrm: Vector3, u: number, v: number, rim: number, tone: number, inner: number): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(nrm.x, nrm.y, nrm.z);
    this.uv.push(u, v, rim, 0);
    this.tone.push(tone, inner);
    const l = this.on;
    if (l === null) this.lump.push(p.x, p.y, p.z, 0);
    else this.lump.push(l.c.x, l.c.y, l.c.z, Math.max(l.r.x, l.r.y, l.r.z));
    return this.n++;
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aUv', new Float32BufferAttribute(this.uv, 4));
    g.setAttribute('aTone', new Float32BufferAttribute(this.tone, 2));
    g.setAttribute('aLump', new Float32BufferAttribute(this.lump, 4));
    g.setAttribute('aSpill', new Float32BufferAttribute(new Float32Array(this.n * 3), 3));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** the ellipsoid normal of lump `l` at world point p (smooth across every card that sits on it) */
const lumpNormal = (l: Lump, p: Vector3): Vector3 => {
  const q = p.clone().sub(l.c);
  return new Vector3(q.x / (l.r.x * l.r.x), q.y / (l.r.y * l.r.y), q.z / (l.r.z * l.r.z)).normalize();
};
/** a random direction on the unit sphere, fewer on the underside (bias 0: uniform) */
const sphereDir = (rng: Rng, bias: number): Vector3 => {
  for (;;) {
    const d = new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    const l = d.length();
    if (l < 0.05 || l > 1) continue;
    d.divideScalar(l);
    const w = 1 - bias + bias * Math.min(1, Math.max(0, (d.y + 0.6) / 1.0));
    if (rng.next() < w) return d;
  }
};
const ellArea = (r: Vector3): number => {
  const p = 1.6;
  return 4 * Math.PI * (((r.x * r.y) ** p + (r.x * r.z) ** p + (r.y * r.z) ** p) / 3) ** (1 / p);
};

export interface CardOpt {
  /** cards per m² of lump surface */
  perM2: number;
  /** card edge (m) */
  size: number;
  /** how far out of the lump surface the card centres sit (× radius) */
  lift: [number, number];
  /** how much a card's plane leans away from the lump tangent (0 = tangent, 1 = random) */
  tilt: number;
  /** fewer cards on the underside (0 = uniform) */
  bias: number;
  /** atlas tiles across (2 = the codex 2×2 sheet) */
  tiles: number;
}
export const CARDS: CardOpt = { perM2: 3.6, size: 1.5, lift: [0.6, 1.0], tilt: 0.55, bias: 0.35, tiles: 2 };

/** painted leaf-cluster cards over every lump (double-sided quads; the shading normal is the lump's) */
export function cardGeometry(lumps: readonly Lump[], rng: Rng, o: CardOpt = CARDS): BufferGeometry {
  const w = new Writer();
  const crown = crownOf(lumps);
  const up = new Vector3(0, 1, 0);
  for (const l of lumps) {
    w.on = l;
    const n = Math.max(4, Math.round(ellArea(l.r) * o.perM2));
    const scale = 0.75 + 0.35 * Math.min(1, l.r.x / 1.1);
    for (let i = 0; i < n; i++) {
      const d = sphereDir(rng, o.bias);
      const p = l.c.clone().add(d.clone().multiply(l.r).multiplyScalar(rng.range(o.lift[0], o.lift[1])));
      const ln = lumpNormal(l, p);
      const cn = ln.clone().add(new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiplyScalar(o.tilt)).normalize();
      // the cluster's stem end points down the lump (its fan opens outward and up), then a random swing
      let tu = up.clone().sub(cn.clone().multiplyScalar(up.dot(cn)));
      if (tu.lengthSq() < 0.04) tu = new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).sub(cn.clone().multiplyScalar(0.0));
      tu.sub(cn.clone().multiplyScalar(tu.dot(cn))).normalize();
      tu.applyAxisAngle(cn, rng.range(-0.7, 0.7));
      const tr = new Vector3().crossVectors(tu, cn).normalize();
      const s = o.size * scale * rng.range(0.8, 1.2);
      const tile = rng.int(0, o.tiles * o.tiles - 1);
      const u0 = (tile % o.tiles) / o.tiles, v0 = Math.floor(tile / o.tiles) / o.tiles, ts = 1 / o.tiles;
      const flip = rng.chance(0.5);
      const tone = rng.next();
      const base = w.n;
      for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
        const q = p.clone().addScaledVector(tr, cx * s).addScaledVector(tu, cy * s);
        const uu = flip ? 0.5 - cx : cx + 0.5;
        // the atlas row 0 is the image top: v grows downward in the PNG, so the stem (image bottom) is v = 1 - …
        w.v(q, lumpNormal(l, q), u0 + uu * ts, 1 - (v0 + (0.5 - cy) * ts), 0, tone, innerAt(q, crown));
      }
      w.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return w.build();
}

export interface LeafOpt { perM2: number; len: [number, number]; lift: [number, number]; bias: number; droop: number }
export const LEAVES: LeafOpt = { perM2: 45, len: [0.16, 0.26], lift: [0.85, 1.12], bias: 0.3, droop: 0.45 };

/** real leaves: a 7-vertex fan each (rim distance in aUv.z draws its outline), opaque */
export function leafGeometry(lumps: readonly Lump[], rng: Rng, o: LeafOpt = LEAVES): BufferGeometry {
  const w = new Writer();
  const crown = crownOf(lumps);
  // the leaf outline in (across, along): base, left, left-upper, tip, right-upper, right
  const rim: [number, number][] = [[0, 0], [-0.8, 0.28], [-0.6, 0.7], [0, 1], [0.6, 0.7], [0.8, 0.28]];
  for (const l of lumps) {
    w.on = l;
    const n = Math.max(6, Math.round(ellArea(l.r) * o.perM2));
    for (let i = 0; i < n; i++) {
      const d = sphereDir(rng, o.bias);
      const p = l.c.clone().add(d.clone().multiply(l.r).multiplyScalar(rng.range(o.lift[0], o.lift[1])));
      const ln = lumpNormal(l, p);
      const nrm = ln.clone().add(new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiplyScalar(0.6)).normalize();
      // the leaf points out of the lump and droops
      let ax = ln.clone().add(new Vector3(0, -o.droop, 0)).add(new Vector3(rng.range(-1, 1), rng.range(-0.5, 0.5), rng.range(-1, 1)).multiplyScalar(0.7));
      ax.sub(nrm.clone().multiplyScalar(ax.dot(nrm)));
      if (ax.lengthSq() < 1e-4) ax = new Vector3(1, 0, 0);
      ax.normalize();
      const side = new Vector3().crossVectors(nrm, ax).normalize();
      const L = rng.range(o.len[0], o.len[1]), W = L * 0.4;
      const tone = rng.next(), inner = innerAt(p, crown);
      const base = w.n;
      // the centre, raised a little (a cupped leaf reads in the wash), then the rim
      const cc = p.clone().addScaledVector(ax, L * 0.42).addScaledVector(nrm, L * 0.06);
      w.v(cc, lumpNormal(l, cc), 0, 0.42, 1, tone, inner);
      for (const [s, t] of rim) {
        const q = p.clone().addScaledVector(ax, t * L).addScaledVector(side, s * W).addScaledVector(nrm, -Math.abs(s) * L * 0.08);
        w.v(q, lumpNormal(l, q), s, t, 0, tone, inner);
      }
      for (let k = 0; k < 6; k++) w.idx.push(base, base + 1 + k, base + 1 + ((k + 1) % 6));
    }
  }
  return w.build();
}

export interface ShellOpt { lat: number; lon: number; bumps: number; amp: number; shrink: number }
/** the lumps as the canopy core (shrink < 1, no bumps) or as scalloped cloud-shelves (bumps > 0) */
export const CORE: ShellOpt = { lat: 5, lon: 9, bumps: 0, amp: 0, shrink: 0.86 };
export const SHELLS: ShellOpt = { lat: 12, lon: 20, bumps: 11, amp: 0.3, shrink: 1 };

export function shellGeometry(lumps: readonly Lump[], rng: Rng, o: ShellOpt): BufferGeometry {
  const w = new Writer();
  const crown = crownOf(lumps);
  const d = new Vector3();
  for (const l of lumps) {
    w.on = l;
    const r = l.r.clone().multiplyScalar(o.shrink);
    const bumps: Vector3[] = [];
    for (let b = 0; b < o.bumps; b++) bumps.push(sphereDir(rng, 0.4));
    const bump = (dd: Vector3): number => {
      if (bumps.length === 0) return 1;
      // a scalloped rim: the max of round bumps (each one leaf cluster), a dip between them
      let m = 0;
      for (const b of bumps) { const t = Math.max(0, dd.dot(b)); m = Math.max(m, t * t * t * t); }
      return 1 + o.amp * (m - 0.35) - (dd.y < -0.3 ? 0.15 : 0);
    };
    const tone = rng.next();
    const base = w.n;
    for (let i = 0; i <= o.lat; i++) {
      const th = (i / o.lat) * Math.PI;
      for (let j = 0; j <= o.lon; j++) {
        const ph = (j / o.lon) * Math.PI * 2;
        d.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
        const k = bump(d);
        const p = l.c.clone().add(new Vector3(d.x * r.x * k, d.y * r.y * k, d.z * r.z * k));
        w.v(p, lumpNormal({ ...l, r }, p), j / o.lon, i / o.lat, 0, tone, innerAt(p, crown));
      }
    }
    for (let i = 0; i < o.lat; i++) {
      for (let j = 0; j < o.lon; j++) {
        const a = base + i * (o.lon + 1) + j, b = a + o.lon + 1;
        w.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  return w.build();
}

// ── the foliage program ──
/** the vertex-stage subset of NOISE_GLSL that silkFog needs (the rest uses derivatives, fragment-only) */
const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const VS = /* glsl */ `
attribute vec4 aUv;
attribute vec2 aTone;
attribute vec3 aSpill;
attribute vec4 aLump;
uniform float uPlate;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
${NOISE_VS}
${FOG_GLSL}
invariant gl_Position;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
#ifndef DEPTH_ONLY
  // the silk fog per VERTEX: the crown is ~20 m across and the fog varies over tens of metres, and the cards overdraw
  // 2–4 layers deep, so the 9-band fog loop must not run per fragment (the phone's cost is the canopy's fill)
  vFog = silkFog(wp.xyz, 1.0);
#else
  vFog = vec4(0.0, 0.0, 0.0, 1.0);
#endif
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = aUv;
  vTone = aTone;
  vSpill = aSpill;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  // the silhouette plateau: every fragment of a lump (its cards, leaves, core) reports ONE depth, the lump's front,
  // so the post inks the clump's outline and the step to the next clump, not every card edge and pin-hole
  vec4 lc = viewMatrix * modelMatrix * vec4(aLump.xyz, 1.0);
  vPlate = aLump.w > 0.0 ? mix(-vp.z, max(-lc.z - aLump.w * 0.85, 0.2), uPlate) : -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS = /* glsl */ `
uniform float uTime;
uniform float uNear;
uniform float uSutra;
uniform float uDpr;
uniform vec3 uLightDir;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uInkMid;
uniform vec2 uLineFade;
uniform vec3 uGold;
uniform vec3 uPaper;
uniform vec3 uLeaf[5];
uniform vec4 uWash;    // x: band contrast, y: inner darkening, z: per-cluster tone spread, w: painted value weight
uniform vec4 uLeafInk; // x: outline px (at 3×), y: outline strength, z: midrib strength, w: sky rim light
uniform sampler2D uAtlas;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
uniform vec3 uCam;
${NOISE_GLSL}
vec3 ramp(float v) {
  v = clamp(v, 0.0, 1.0) * 4.0;
  float i = floor(v), f = v - i;
  vec3 a = uLeaf[0], b = uLeaf[1];
  if (i >= 3.0) { a = uLeaf[3]; b = uLeaf[4]; } else if (i >= 2.0) { a = uLeaf[2]; b = uLeaf[3]; } else if (i >= 1.0) { a = uLeaf[1]; b = uLeaf[2]; }
  // painted washes: flat steps with a narrow soft edge, not a gradient
  return mix(a, b, smoothstep(0.35, 0.65, f));
}
void main() {
#ifdef DEPTH_ONLY
  gl_FragColor = vec4(0.0, 0.0, 0.0, uNear / max(vPlate, uNear));
  return;
#else
  vec3 n = normalize(vN);
  vec3 V = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);
  float ndl = dot(n, uLightDir);
  // three hard washes: the belly, the body, the lit top (the sky screens light the crown from above)
  float band = smoothstep(-0.34, -0.26, ndl) * 0.5 + smoothstep(0.3, 0.38, ndl) * 0.5;
  float v = 0.06 + band * uWash.x - vTone.y * uWash.y + (vTone.x - 0.5) * uWash.z;
  float ink = 0.0;
  float a = 1.0;
#ifdef CARD
  vec4 tx = texture2D(uAtlas, vUv.xy);
  float L = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
  // the painted leaves keep their own light / dark and their ink; the hue is ours
  v += (smoothstep(0.18, 0.62, L) - 0.4) * uWash.w;
  ink = (1.0 - smoothstep(0.07, 0.2, L)) * uLeafInk.y;
  // alpha to coverage, sharpened to a crisp leaf edge at any mip (the MSAA resolve antialiases it)
  // (mip-level coverage kept: the mips average the clear gaps in, so a far cluster would thin out and vanish)
  vec2 tsz = vec2(textureSize(uAtlas, 0));
  vec2 dx = dFdx(vUv.xy * tsz), dy = dFdy(vUv.xy * tsz);
  float mip = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
  float ta = tx.a * (1.0 + max(mip, 0.0) * 0.25);
  a = clamp((ta - 0.5) / max(fwidth(ta), 1e-4) + 0.5, 0.0, 1.0);
#endif
#ifdef LEAF
  // the leaf's outline from its rim distance (aUv.z: 1 at the centre, 0 on the rim), a thin midrib
  float px = uLeafInk.x * uDpr;
  float fr = max(fwidth(vUv.z), 1e-5);
  float big = smoothstep(0.02, 0.2, 1.0 / (fr * 12.0));   // outlines only while the leaf is ≥ ~12 px
  ink = clamp(px * 0.5 + 0.5 - vUv.z / fr, 0.0, 1.0) * uLeafInk.y * big;
  float fs = max(fwidth(vUv.x), 1e-5);
  ink = max(ink, clamp(0.5 - abs(vUv.x) / fs, 0.0, 1.0) * step(0.08, vUv.y) * step(vUv.y, 0.85) * uLeafInk.z * big);
  v += (vTone.x - 0.5) * 0.15;
#endif
#ifdef SHELL
  // gongbi leaves painted on the shell: a Voronoi of leaves, each outlined and tinted (the K.leaf pattern, finer)
  vec3 an = abs(n);
  vec2 lp = (an.y > max(an.x, an.z) ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy)) / 0.2;
  vec2 cc = floor(lp), fc = fract(lp);
  float d1 = 9.0, d2 = 9.0, idv = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 rr = o + vec2(h12(cc + o), h12(cc + o + 17.3)) - fc;
      float dd = dot(rr, rr);
      if (dd < d1) { d2 = d1; d1 = dd; idv = h12(cc + o + 3.1); } else if (dd < d2) { d2 = dd; }
    }
  }
  float flw = max(fwidth(lp.x), fwidth(lp.y)) * 0.2;
  float det = smoothstep(2.5, 6.0, 0.2 / flw);
  float ed = (sqrt(d2) - sqrt(d1)) * 0.5 * 0.2;
  ink = clamp(uLeafInk.x * uDpr * 0.3 + 0.5 - ed / flw, 0.0, 1.0) * det * uLeafInk.y * 0.7;
  v += (idv - 0.5) * 0.35 * det;
#endif
#ifdef INNER
  v = 0.14 + band * 0.22 - vTone.y * 0.12;
#endif
  vec3 col = ramp(v);
  // light through the crown's edge: a cool sky rim where the lump turns away from the eye on its upper side
  float rim = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0) * smoothstep(-0.1, 0.5, n.y) * (1.0 - vTone.y);
  col += uLeaf[4] * rim * uLeafInk.w;
  // warm lantern / neon spill, baked per vertex like the kits
  col += col * vSpill * 1.6;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  inkC = mix(inkC, uGold, uSutra);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, uPaper * (0.5 + v * 0.7), uSutra * 0.8);
  vec4 fg = vFog;
  col = mix(col, inkC, ink * fade * pow(max(fg.a, 1e-4), 0.7));
#ifdef CARD
  // alpha = coverage (a2c); the blend keeps the target's alpha, the depth pass writes the plateau after
  gl_FragColor = vec4(col * fg.a + fg.rgb, a);
#else
  // alpha = inverse view depth (the post silhouette reads it), the lump's plateau
  gl_FragColor = vec4(col * fg.a + fg.rgb, uNear / max(vPlate, uNear));
#endif
#endif
}
`;

export type FoliageMode = 'cards' | 'cards-depth' | 'leaves' | 'shells' | 'inner';

/** the gongbi banyan greens (display sRGB), sampled from the targets' canopy (k-means of style A's crown) */
export const LEAF_PALETTE = [0x131d19, 0x20322a, 0x31483c, 0x566a4d, 0xa4a674] as const;

export interface FoliageUniforms { uLeaf: IUniform<Color[]>; uWash: IUniform<Vector4>; uLeafInk: IUniform<Vector4>; uPlate: IUniform<number> }
export function foliageUniforms(): FoliageUniforms {
  return {
    uLeaf: { value: LEAF_PALETTE.map((h) => new Color(h)) },
    uWash: { value: new Vector4(0.32, 0.45, 0.26, 1.0) },
    uLeafInk: { value: new Vector4(1.6, 0.9, 0.5, 0.35) },
    uPlate: { value: 1 },
  };
}

/**
 * One program, five modes. 'cards' is alpha-to-coverage with the target's alpha KEPT (blend: rgb = src, a = dst);
 * 'cards-depth' re-draws the same cards depth-EQUAL writing only alpha = near / viewZ (the post silhouette's inverse
 * depth), so it must render right after 'cards' (renderOrder). Everything else is plain opaque.
 */
export function foliageMaterial(shared: Shared, mode: FoliageMode, fu: FoliageUniforms, atlas: Texture | null): ShaderMaterial {
  const defines: Record<string, string> = {};
  if (mode === 'cards') defines['CARD'] = '';
  if (mode === 'cards-depth') defines['DEPTH_ONLY'] = '';
  if (mode === 'leaves') defines['LEAF'] = '';
  if (mode === 'shells') defines['SHELL'] = '';
  if (mode === 'inner') defines['INNER'] = '';
  const m = new ShaderMaterial({
    // the foliage uniform objects are shared by every mode: one write reaches them all
    uniforms: { ...shared.u, uLeaf: fu.uLeaf, uWash: fu.uWash, uLeafInk: fu.uLeafInk, uPlate: fu.uPlate, uAtlas: { value: atlas } },
    vertexShader: VS, fragmentShader: FS, defines,
    side: mode === 'cards' || mode === 'cards-depth' || mode === 'leaves' ? DoubleSide : FrontSide,
  });
  if (mode === 'cards') {
    m.alphaToCoverage = true;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = OneFactor;
    m.blendDst = ZeroFactor;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
  }
  if (mode === 'cards-depth') {
    m.depthFunc = EqualDepth;
    m.depthWrite = false;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = ZeroFactor;
    m.blendDst = OneFactor;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = OneFactor;
    m.blendDstAlpha = ZeroFactor;
  }
  return m;
}

/** dome B's ramp (display sRGB), darker than the lab's LEAF_PALETTE */
export const DOME_B_LEAVES = [0x0e1612, 0x17251e, 0x24362c, 0x3d5040, 0x6f7c5a] as const;

/** the painted leaf atlas (the codex gongbi 2×2 sheet), mipmapped, anisotropic */
function loadAtlas(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url).then((t) => {
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  });
}

/**
 * Dome B: dress the banyan's lumps with the painted cards (alpha to coverage, then the depth-equal pass that writes the
 * lumps' plateau depth into the colour target's alpha for the post's ink) over a darker core. Returns the meshes to add
 * (none when the atlas fails: the tree then stands bare, which shows at once). Spill is baked like the kits'.
 */
export async function buildCanopy(shared: Shared, lumps: readonly Lump[], emitters: readonly Emitter[]): Promise<Mesh[]> {
  if (lumps.length === 0) return [];
  try {
    const atlas = await loadAtlas('/assets/nine-dragon/lab/organic/leaf-atlas.webp');
    const fu = foliageUniforms();
    // dome B's night crown (ΔE vs its targets: the lab's palette read #4c5742 against #343b32, the lit tops khaki from
    // above): the ramp a step darker and less yellow, the lit band narrower
    fu.uLeaf.value = DOME_B_LEAVES.map((h) => new Color(h));
    fu.uWash.value.x = 0.24;
    const rng = new Rng(97);
    const gCards = cardGeometry(lumps, rng, CARDS);
    const gCore = shellGeometry(lumps, rng, CORE);
    bakeSpill([gCards, gCore], emitters);
    const cards = new Mesh(gCards, foliageMaterial(shared, 'cards', fu, atlas));
    const cardsDepth = new Mesh(gCards, foliageMaterial(shared, 'cards-depth', fu, atlas));
    cards.renderOrder = 1;
    cardsDepth.renderOrder = 2;
    const core = new Mesh(gCore, foliageMaterial(shared, 'inner', fu, null));
    return [core, cards, cardsDepth];
  } catch (e: unknown) {
    console.warn('nine-dragon: the leaf atlas failed to load, the banyan has no canopy', e);
    return [];
  }
}

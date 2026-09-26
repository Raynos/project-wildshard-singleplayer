// 界画霓虹 Jiehua Neon: one program for all architecture plus the neon, sky, sky-screen, fog-sheet, steam and filament
// programs. The architecture program is the ink lab's (src/dev/nd-lab/ink/jiehua.ts, round-7-lab-ink), merged:
//  - ruled ink on every built border, box-filtered at a fixed px width from the gradient length (`inkCov`, `mpp`), a
//    heavier ground line on walkable lips; every repeated ruling fades to its AVERAGE tone when crowded (`ruled`);
//  - one fade per job: 焦墨 until ~110 m, clear air for the first 16 m, lines gone 120–330 m, fog dissolves lines first
//    (T^0.7);
//  - a painted wash: two hard bands of top light, soffits a deeper ink, pooling, rain stains, mottle, a world-anchored
//    fractal silk weave and granulation; the fog carries a screen-space silk;
//  - alpha = near / viewZ, so the MSAA resolve gives the post silhouette an antialiased inverse depth.
// Kept from the clean room: the wet flagstones shared with the streak cards (kind 3), nets, leaves, cloth, baked neon
// spill, the colour script down the Well, gold lines on the deep strata, and the 泥金磁青 flip (`uSutra`).
// Presets (`setLook`): blue hour (the default, Jake's round-6 pick), warm raw silk, and the gold-on-indigo sutra.
import {
  AddEquation, BackSide, Color, CustomBlending, DataTexture, DoubleSide, LinearMipmapLinearFilter,
  OneFactor, OneMinusSrcAlphaFactor, RedFormat, RepeatWrapping, ShaderMaterial, SrcAlphaFactor, type Texture, type IUniform,
  UnsignedByteType, Vector2, Vector3, Vector4, ZeroFactor,
} from 'three';
import { Y0 } from '../layout';
import { FLAG, PAINT_GLSL, paintUniforms } from './paint';
// the baked light volume (lab P6): warm pools from every lantern, shop, lamp, sign and lit window
import { LIGHTVOL_GLSL, lightVolUniforms } from './light/lightvol';
import { METAL, Rng, SUTRA } from '../util';

const c = (hex: number): Color => new Color(hex);

export type LookName = 'jiehua' | 'silk' | 'sutra';

/** the fog bands down the Well (centre y, half-width m, density /m) and their silk per look: thin dense bands with
 *  clear air between read as counted bands (ink lab learning 6); deeper = bluer, to indigo */
interface Band { y: number; w: number; d: number; jiehua: number; silk: number; sutra: number }
const BANDS: readonly Band[] = [
  { y: 212, w: 6, d: 0.022, jiehua: 0xd6dbe2, silk: 0xd8cfbd, sutra: 0x2a3a62 },
  { y: 152, w: 3, d: 0.008, jiehua: 0xc9ced6, silk: 0xcbc0ad, sutra: 0x24345a },
  { y: 101, w: 5, d: 0.1, jiehua: 0xc2cad6, silk: 0xc6baa7, sutra: 0x223257 },
  { y: 36, w: 5, d: 0.11, jiehua: 0xb1bccb, silk: 0xaba396, sutra: 0x1e2c4e },
  { y: -30, w: 5, d: 0.1, jiehua: 0x9eabbe, silk: 0x8f8a82, sutra: 0x192644 },
  { y: -110, w: 5, d: 0.09, jiehua: 0x5d6a86, silk: 0x5f6478, sutra: 0x142039 },
  { y: -190, w: 5, d: 0.1, jiehua: 0x2c3a5e, silk: 0x2c3a5e, sutra: 0x101b31 },
  { y: -236, w: 5, d: 0.12, jiehua: 0x16223c, silk: 0x16223c, sutra: 0x0c1729 },
  { y: -400, w: 1, d: 0, jiehua: 0x000000, silk: 0x000000, sutra: 0x000000 },
];
export const BAND_COUNT = 9;

interface LookPreset { fog: number; sky: [number, number]; tint: [number, number, number]; shade: number }
const LOOKS: Readonly<Record<LookName, LookPreset>> = {
  jiehua: { fog: 0x97a7c0, sky: [0x7390b8, 0xaec0d8], tint: [0.9, 0.93, 1.0], shade: 0x939bae },
  silk: { fog: 0xc4b59a, sky: [0xa8977a, 0xd2c3a4], tint: [1.1, 1.0, 0.82], shade: 0xbcb2a0 },
  sutra: { fog: 0x22325a, sky: [0x0a1224, 0x1d2b4a], tint: [1, 1, 1], shade: 0xadb2bf },
};

/** a 256² plain-weave silk, normalised to the full range (the ink lab's: the first one was ±2 % and invisible) */
function silkWeave(): DataTexture {
  const N = 256, data = new Uint8Array(N * N), raw = new Float32Array(N * N);
  const r = new Rng(77);
  const warp = Array.from({ length: N / 2 }, () => r.range(-1, 1));
  const weft = Array.from({ length: N / 2 }, () => r.range(-1, 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = x >> 1, ty = y >> 1;
    const over = ((tx + ty) & 1) === 0;
    const thread = over ? (warp[tx] ?? 0) * 0.5 : (weft[ty] ?? 0) * 0.5;
    const slub = Math.sin((x + (weft[ty] ?? 0) * 11) * 0.13) * 0.18 + Math.sin((y + (warp[tx] ?? 0) * 9) * 0.11) * 0.18;
    raw[y * N + x] = thread * 36 + slub * 44 + (r.next() - 0.5) * 22;
  }
  const sorted = Float32Array.from(raw).sort();
  const lo = sorted[Math.floor(N * N * 0.01)] ?? -1, hi = sorted[Math.floor(N * N * 0.99)] ?? 1;
  for (let i = 0; i < N * N; i++) data[i] = Math.max(0, Math.min(255, Math.round((((raw[i] ?? 0) - lo) / (hi - lo)) * 255)));
  const t = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export type Uniforms = Record<string, IUniform>;

/** keeps the target's alpha (the silhouette's inverse depth) under a transparent pass */
export const KEEP_ALPHA = {
  blending: CustomBlending, blendEquation: AddEquation, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
  blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
} as const;
export const ADD_KEEP_ALPHA = {
  blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
  blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
} as const;

/** uniforms every world program shares (one object each, so a write reaches every material) */
export class Shared {
  readonly u = {
    uTime: { value: 0 },
    uCam: { value: new Vector3() },
    uRes: { value: new Vector2(1, 1) },
    /** device px per CSS px / 3: line widths are authored at 3× */
    uDpr: { value: 1 },
    uNear: { value: 0.1 },
    uSutra: { value: 0 },
    // lines
    uLinePx: { value: 2.1 },
    uGroundPx: { value: 4.2 },
    uLineFade: { value: new Vector2(120, 330) },
    uInkMid: { value: 110 },
    uInk0: { value: c(0x1c1a19) },
    uInk1: { value: c(0x5f5e5c) },
    uLineFog: { value: 1.7 },
    uSilver: { value: c(METAL.silver) },
    uGold: { value: c(METAL.gold) },
    uGoldDim: { value: c(0x7a5f2a) },
    // washes
    uLightDir: { value: new Vector3(0.35, 0.86, 0.38).normalize() },
    uShade: { value: c(0xadb2bf) },
    uPool: { value: 0.06 },
    uStain: { value: 0.1 },
    uMottle: { value: 0.12 },
    uWeave: { value: 0.08 },
    uSilkPaper: { value: 0.12 },
    uWashTint: { value: new Vector3(0.9, 0.93, 1.0) },
    uWinWarm: { value: c(0xeaa95c) },
    uWinCool: { value: c(0xd8ece6) },
    uWinDark: { value: c(0x5a6068) },
    uPaper: { value: c(SUTRA.indigo) },
    uPaperDeep: { value: c(SUTRA.deep) },
    uSutraWin: { value: c(0xe8b85a) },
    // fog
    uFogBase: { value: 0.0052 },
    uFogStart: { value: 16 },
    uFogBaseCol: { value: c(0x9aa6ba) },
    uBands: { value: BANDS.map((b) => new Vector4(b.y, b.w, b.d, 0)) },
    uBandCols: { value: BANDS.map((b) => c(b.jiehua)) },
    uSkyTop: { value: c(0x7c8aa3) },
    uSkyHorizon: { value: c(0xc6cbd3) },
    uSilk: { value: silkWeave() as Texture },
    uGroundY: { value: 0 },
    // the painted surfaces (paint.ts, merged from lab P5): the texture array and its strengths; the glazed tiles' pitch
    ...paintUniforms(),
    uTilePitch: { value: new Vector2(0.24, 0.22) },
    // the clean room's paint strengths per surface (round 9 repair): flagstones (dry areas only), and
    // x: bare stone (balustrade rails, posts, the Well lip), y: the carved frieze, z: concrete walls
    uPaintFlag: { value: 0.18 },
    uPaintStone: { value: new Vector3(0.2, 0.0, 0.65) },
    // the Well's shaft mist: its box (x0, z0, x1, z1) and density / rim height (set by main.ts from layout.ts WELL)
    uShaft: { value: new Vector4(0, 0, 0, 0) },
    uShaftK: { value: new Vector2(0.085, 0) },
    ...lightVolUniforms(),
  };
  look: LookName = 'jiehua';

  /** the look: blue hour (Jake's pick), warm raw silk (what codex paints), or the gold-on-indigo sutra */
  setLook(name: LookName): void {
    this.look = name;
    const p = LOOKS[name];
    this.u.uSutra.value = name === 'sutra' ? 1 : 0;
    BANDS.forEach((b, i) => { this.u.uBandCols.value[i]?.setHex(b[name]); });
    this.u.uFogBaseCol.value.setHex(p.fog);
    this.u.uSkyTop.value.setHex(p.sky[0]);
    this.u.uSkyHorizon.value.setHex(p.sky[1]);
    this.u.uWashTint.value.set(...p.tint);
    this.u.uShade.value.setHex(p.shade);
  }

  /** kept for the old API: 0 = blue hour, 1 = sutra */
  setSutra(s: number): void { this.setLook(s > 0.5 ? 'sutra' : 'jiehua'); }
}

export const NOISE_GLSL = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
// antialiased ruled line: d = distance to the line (m), fw = metres per pixel, w = width (px); below 1 px it fades, never aliases
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
float cover1(float x, float a, float b, float fw) { float w = max(fw, 1e-5); return clamp((min(x + 0.5 * w, b) - max(x - 0.5 * w, a)) / w, 0.0, 1.0); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// metres per pixel of a scalar field (the gradient length: fwidth thins 45° lines by √2)
float mpp(float x) { return max(length(vec2(dFdx(x), dFdy(x))), 1e-6); }
// a ruled line of full width w px whose centre is dpx pixels away: box-filtered; under 1 px it fades instead of thinning
float inkCov(float dpx, float w) { float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - dpx, 0.0, 1.0) * min(w, 1.0); }
// a repeating ruling (pitch p m) along x: distance to the nearest ruled line, in px (g = m per px)
float ruleDist(float x, float p, float g) { return abs(fract(x / p + 0.5) - 0.5) * p / g; }
// a ruling of width w px whose lines are sp px apart: crisp above 6 px spacing, its average coverage below 3 px
float ruled(float dpx, float w, float sp) { return mix(clamp(w / sp, 0.0, 1.0), inkCov(dpx, w), smoothstep(3.0, 6.0, sp)); }
`;

export const FOG_GLSL = /* glsl */ `
uniform vec3 uCam;
uniform float uFogBase;
uniform float uFogStart;
uniform vec3 uFogBaseCol;
uniform vec4 uShaft;
uniform vec2 uShaftK;
uniform vec4 uBands[${BAND_COUNT}];
uniform vec3 uBandCols[${BAND_COUNT}];
// the colour script: the silk's tint at an altitude, interpolated between the bands
vec3 scriptCol(float y) {
  vec3 c = uBandCols[0];
  for (int i = 0; i < ${BAND_COUNT - 2}; i++) {
    vec4 a = uBands[i];
    vec4 b = uBands[i + 1];
    if (y <= a.x && y >= b.x) c = mix(uBandCols[i + 1], uBandCols[i], (y - b.x) / max(a.x - b.x, 1.0));
  }
  if (y < uBands[${BAND_COUNT - 2}].x) c = uBandCols[${BAND_COUNT - 2}];
  return c;
}
// banded silk fog (the ink lab's): every band is a sech² bump in height whose optical depth along the ray is analytic
// (tanh); composited front to back, then the base air after the first uFogStart metres of clear air. Each band billows:
// its depth is scaled by a noise read where the ray crosses the band's plane (world-anchored), calmed with distance,
// and its cores are painted a shade deeper. Looking down the Well, the base air takes the colour script of the strata.
// rgb = inscatter, a = transmittance.
vec4 silkFog(vec3 wp, float scale) {
  if (scale <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 d = wp - uCam;
  float L = length(d);
  float dy = d.y;
  float ady = abs(dy);
  float midY = uCam.y + 0.5 * dy;
  vec3 acc = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < ${BAND_COUNT}; i++) {
    int k = dy < 0.0 ? i : ${BAND_COUNT - 1} - i;
    vec4 b = uBands[k];
    if (b.z <= 0.0) continue;
    float tau;
    if (ady > b.y * 0.5) {
      float t0 = tanh(clamp((uCam.y - b.x) / b.y, -10.0, 10.0));
      float t1 = tanh(clamp((wp.y - b.x) / b.y, -10.0, 10.0));
      tau = b.z * b.y * abs(t1 - t0) * L / ady;
    } else {
      float ch = cosh(clamp((midY - b.x) / b.y, -10.0, 10.0));
      tau = b.z * L / (ch * ch);
    }
    float tc = (b.x - uCam.y) / (abs(dy) > 1e-3 ? dy : 1e-3);
    vec2 xp = uCam.xz + d.xz * clamp(tc, 0.0, 1.0);
    float bil = smoothstep(0.28, 0.72, vnoise(xp * 0.11 + b.x) * 0.6 + vnoise(xp * 0.33 - b.x) * 0.4);
    bil = mix(bil, 0.5, smoothstep(50.0, 160.0, length(d.xz) * clamp(tc, 0.0, 1.0)));
    tau *= (0.35 + 1.3 * bil) * scale;
    float a = 1.0 - exp(-tau);
    acc += T * a * uBandCols[k] * (1.1 - 0.34 * smoothstep(0.4, 1.0, bil));
    T *= 1.0 - a;
  }
  // the base air thins above the square's datum and thickens down the Well (read at the ray's mid height): the
  // aerials see lamp-lit depth, the shaft fills with silk. Looking up (from inside the Well) the ray is read nearer
  // its top: the shaft opens toward the lit sky instead of greying out
  float hy = dy > 0.0 ? mix(midY, max(uCam.y, wp.y), 0.8) : midY;
  float hk = hy < ${Y0}.0 ? min(exp((${Y0}.0 - hy) / 30.0), 3.6) : max(exp(-(hy - ${Y0}.0) / 45.0), 0.35);
  float a0 = 1.0 - exp(-uFogBase * hk * max(L - uFogStart, 0.0) * scale);
  vec3 baseC = mix(uFogBaseCol, scriptCol(wp.y), clamp((uCam.y - wp.y) / 150.0, 0.0, 1.0));
  acc += T * a0 * baseC;
  T *= 1.0 - a0;
  // the Well's own silk: the stretch of the ray inside the shaft (a slab test on its box) fills with pale mist, from
  // nothing at the rim to full 25 m down (the round-6 mockups' Well views: paler, mistier, lighter depth)
  if (uShaftK.x > 0.0 && L > 1e-3) {
    vec3 dn = d / L;
    vec3 inv = vec3(abs(dn.x) > 1e-5 ? 1.0 / dn.x : 1e5, abs(dn.y) > 1e-5 ? 1.0 / dn.y : 1e5, abs(dn.z) > 1e-5 ? 1.0 / dn.z : 1e5);
    vec3 t0 = (vec3(uShaft.x, -260.0, uShaft.y) - uCam) * inv, t1 = (vec3(uShaft.z, uShaftK.y, uShaft.w) - uCam) * inv;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float ta = max(max(tn.x, tn.y), max(tn.z, 0.0)), tb = min(min(tf.x, tf.y), min(tf.z, L));
    if (tb > ta) {
      float my = uCam.y + dn.y * 0.5 * (ta + tb);
      // (measured below the rim or the eye, whichever is lower: the mist lies below you — seen from inside the shaft
      // looking up, the stretch above stays clear toward the lit sky)
      float as = 1.0 - exp(-uShaftK.x * (tb - ta) * smoothstep(0.0, 25.0, min(uShaftK.y, uCam.y) - my) * scale);
      acc += T * as * mix(uFogBaseCol * 1.16, scriptCol(my), 0.35);
      T *= 1.0 - as;
    }
  }
  return vec4(acc, T);
}
// the neon lab's fog interface (their programs mix toward fogCol by fogAmt)
float fogAmt(vec3 wp) { return 1.0 - silkFog(wp, 1.0).a; }
vec3 fogCol(vec3 wp) { vec4 f = silkFog(wp, 1.0); return f.rgb / max(1.0 - f.a, 1e-3); }
`;

/** the silk ground under the fog and the sky: weave + slow blotches in screen space (they have no surface) */
export const PAPER_GLSL = /* glsl */ `
uniform float uSilkPaper;
uniform float uDpr;
float silkPaper(vec2 fc) {
  float sw = texture(uSilk, fc / (486.0 * uDpr)).r;
  float bl = vnoise(fc / (110.0 * uDpr)) * 0.6 + vnoise(fc / (330.0 * uDpr) + 7.0) * 0.4;
  return 1.0 + (sw - 0.5) * uSilkPaper + (bl - 0.5) * uSilkPaper * 0.7;
}
`;

export const STONES_GLSL = /* glsl */ `
// (needs PAINT_GLSL before it: the layout is paint.ts FLAG, shared with the paint's per-stone windows)
vec4 stone(vec2 p, float px) {
  vec4 fc = flagCell(p);
  float cx = fc.x, r = fc.y;
  float L = flagLen(r), rh = ${FLAG.rh.toFixed(3)};
  float fx = fc.z / L, fy = fc.w / rh;
  vec2 fw = max(fwidth(p), vec2(1e-5));
  vec2 lw = min(fw * px, vec2(0.012));
  float jx = 1.0 - smoothstep(lw.x, lw.x + fw.x, min(fx, 1.0 - fx) * L);
  float jy = 1.0 - smoothstep(lw.y, lw.y + fw.y, min(fy, 1.0 - fy) * rh);
  float joint = max(jx * smoothstep(4.0, 9.0, L / fw.x), jy * smoothstep(4.0, 9.0, rh / fw.y));
  float id = h12(vec2(cx, r));
  float puddle = smoothstep(0.42, 0.72, vnoise(p * 0.21 + 3.0) * 0.6 + vnoise(p * 0.83) * 0.4);
  return vec4(joint, id, puddle, h12(vec2(cx, r) + 17.0) * 2.0 - 1.0);
}
`;


const VS_JIEHUA = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec4 aMisc;
attribute vec2 aOff;
attribute vec3 aSpill;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
varying float vViewZ;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
varying vec3 vSpill;
void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(m) * normal);
  vColor = color;
#ifdef USE_INSTANCING_COLOR
  vColor *= instanceColor;
#endif
  vFace = aFace;
  vPat = aPat;
  vMisc = aMisc;
  vOff = aOff;
  vSpill = aSpill;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

const FS_JIEHUA = /* glsl */ `
uniform float uTime;
uniform float uNear;
uniform float uSutra;
uniform float uLinePx;
uniform float uGroundPx;
uniform vec2 uLineFade;
uniform float uInkMid;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uLineFog;
uniform vec3 uSilver;
uniform vec3 uGold;
uniform vec3 uGoldDim;
uniform vec3 uLightDir;
uniform vec3 uShade;
uniform float uPool;
uniform float uStain;
uniform float uMottle;
uniform float uWeave;
uniform vec3 uWashTint;
uniform vec3 uWinWarm;
uniform vec3 uWinCool;
uniform vec3 uWinDark;
uniform vec3 uPaper;
uniform vec3 uPaperDeep;
uniform vec3 uSutraWin;
uniform float uFogScale;
uniform sampler2D uSilk;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
varying float vViewZ;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
varying vec3 vSpill;
${NOISE_GLSL}
${FOG_GLSL}
${PAPER_GLSL}
uniform vec2 uTilePitch;
uniform float uPaintFlag;
uniform vec3 uPaintStone;
${PAINT_GLSL}
${STONES_GLSL}
${LIGHTVOL_GLSL}
float bit(float f, float b) { return mod(floor(f / b), 2.0); }
float bayer4(vec2 fc) {
  vec2 p = mod(floor(fc), 4.0);
  float i = p.x + p.y * 4.0;
  return (i == 0.0 ? 0.0 : i == 1.0 ? 8.0 : i == 2.0 ? 2.0 : i == 3.0 ? 10.0 : i == 4.0 ? 12.0 : i == 5.0 ? 4.0 : i == 6.0 ? 14.0 : i == 7.0 ? 6.0
    : i == 8.0 ? 3.0 : i == 9.0 ? 11.0 : i == 10.0 ? 1.0 : i == 11.0 ? 9.0 : i == 12.0 ? 15.0 : i == 13.0 ? 7.0 : i == 14.0 ? 13.0 : 5.0) / 16.0 + 1.0 / 32.0;
}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float kind = floor(vPat.x + 0.5);
  float fl = floor(vMisc.w + 0.5);
  float accent = bit(fl, 16.0), gloss = bit(fl, 32.0), goldL = bit(fl, 64.0);
  vec3 base = vColor * mix(uWashTint, vec3(1.0), accent);
  // the painted surface (paint.ts; flag bits × 4096: 0 by kind, 1 none, 2 stone, 3 concrete, 4 lacquer, 5 wood, 6 poster)
  float surf = floor(fl / 4096.0);
  float pk = surf == 1.0 ? 0.0 : uPaintK.x;
  vec3 toCam = uCam - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);

  // ── face-local metres and their pixel rates ──
  vec2 uv = vFace.xy;
  vec2 sz = vFace.zw;
  float gu = mpp(uv.x), gv = mpp(uv.y);
  vec2 q = uv + vOff;
  float gq = max(gu, gv);
  vec4 dpx = vec4(uv.x / gu, (sz.x - uv.x) / gu, uv.y / gv, (sz.y - uv.y) / gv);
  float dEdge = min(min(dpx.x, dpx.y), min(dpx.z, dpx.w));
  float thin = mix(1.0, 0.62, smoothstep(8.0, 70.0, dist));
  float Wr = uLinePx * uDpr * thin;
  float W = Wr * vMisc.y;
  float Wg = uGroundPx * uDpr * mix(1.0, 0.55, smoothstep(6.0, 60.0, dist));
  float lines = 0.0;
  if (vMisc.y > 0.0) {
    vec4 e = vec4(bit(fl, 1.0), bit(fl, 2.0), bit(fl, 4.0), bit(fl, 8.0));
    vec4 g = vec4(bit(fl, 256.0), bit(fl, 512.0), bit(fl, 1024.0), bit(fl, 2048.0));
    vec4 w4 = mix(vec4(W), vec4(Wg), g);
    e = max(e, g);
    lines = max(max(e.x * inkCov(dpx.x, w4.x), e.y * inkCov(dpx.y, w4.y)), max(e.z * inkCov(dpx.z, w4.z), e.w * inkCov(dpx.w, w4.w)));
  }

  vec3 col = base;
  vec3 emit = base * vMisc.x;
  float wet = vMisc.z;
  float wetPool = 0.0;
  float vert = 1.0 - abs(n.y);
  float forceInk = 0.0;

  if (kind == 1.0) {
    // ── facade: a storey per row, a window module per column ──
    float rowP = vPat.y, colP = vPat.z, seed = vPat.w;
    // the wall is painted concrete (2 scales, grime as ink); glass and lit rooms keep their colours
    if (pk > 0.0) base *= pInk(paintWall(4, 2, q, 6.0, seed, pk * uPaintK.z * uPaintStone.z), uPaintInk);
    vec2 g2 = q / vec2(colP, rowP);
    vec2 cell = floor(g2);
    vec2 f = fract(g2);
    float cellPx = min(colP / gu, rowP / gv);
    float blk = smoothstep(3.0, 7.0, cellPx);
    float h1 = h12(cell + seed * 13.1), h2 = h12(cell.yx * 1.7 + seed * 5.3 + 11.0), h3 = h12(cell * 0.73 + seed + 3.0);
    float floorH = h12(vec2(cell.y * 0.37, seed * 2.1));
    float litP = 0.2 + 0.3 * floorH;
    float isLit = step(h1, litP);
    float sv = h12(vec2(seed, 7.0));
    vec2 wa = vec2(0.16 + 0.1 * sv, 0.26), wb = vec2(0.84 - 0.1 * sv, 0.8);
    float wide = step(0.72, h2);
    wa.x = mix(wa.x, 0.07, wide); wb.x = mix(wb.x, 0.93, wide);
    float inX = cover1(f.x, wa.x, wb.x, gu / colP), inY = cover1(f.y, wa.y, wb.y, gv / rowP);
    float win = inX * inY;
    float under = smoothstep(0.72, 0.97, f.y) * 0.45;
    vec3 wall = base * (1.0 - under * blk);
    vec3 glass = mix(uWinDark, uWinDark * 1.35, smoothstep(0.26, 0.8, 1.0 - f.y) * 0.6) * mix(0.85, 1.1, h3) * uWashTint;
    vec3 warm = mix(uWinWarm, uWinCool, step(0.85, h2)) * (0.55 + 0.5 * h3);
    float curtain = step(0.5, h3) * isLit * cover1(f.x, wa.x, mix(wa.x, wb.x, 0.35 + 0.3 * h2), gu / colP);
    vec3 cellC = mix(wall, glass, win);
    cellC = mix(cellC, vec3(0.78, 0.66, 0.5) * 0.9, curtain * win);
    float area = (wb.x - wa.x) * (wb.y - wa.y);
    vec3 avgC = mix(base * (1.0 - 0.11), glass, area * 0.85);
    col = mix(avgC, cellC, blk);
    float litMask = isLit * win * (1.0 - curtain * 0.6);
    emit += mix(uWinWarm * litP * area * 0.55, warm * litMask, blk) * 0.8;
    float wpx = Wr;
    float colPx = colP / gu, rowPx = rowP / gv;
    float lipCov = inkCov(ruleDist(q.y, rowP, gv), wpx * 1.35);
    float lip = mix(clamp(wpx * 1.35 / rowPx, 0.0, 1.0), lipCov, smoothstep(3.0, 6.0, rowPx));
    float inXh = step(wa.x, f.x) * step(f.x, wb.x), inYh = step(wa.y, f.y) * step(f.y, wb.y);
    float dfx = min(abs(f.x - wa.x), abs(f.x - wb.x)) * colPx;
    float dfy = min(abs(f.y - wa.y), abs(f.y - wb.y)) * rowPx;
    float mullOn = step(0.3, h2), tranOn = step(0.45, h3);
    float covU = max(inkCov(dfx, wpx * 0.85) * inYh, inkCov(abs(f.x - 0.5) * colPx, wpx * 0.6) * inYh * mullOn);
    float covV = max(max(inkCov(dfy, wpx * 0.85) * inXh, inkCov(abs(f.y - mix(wa.y, wb.y, 0.7)) * rowPx, wpx * 0.55) * inXh * tranOn),
      inkCov(abs(f.y - (wa.y - 0.05)) * rowPx, wpx * 0.8) * step(wa.x - 0.05, f.x) * step(f.x, wb.x + 0.05));
    float avgU = clamp(wpx * (1.7 + 0.6 * mullOn) / colPx, 0.0, 1.0) * (wb.y - wa.y);
    float avgV = clamp(wpx * (2.5 + 0.55 * tranOn) / rowPx, 0.0, 1.0) * (wb.x - wa.x);
    float spU = colPx * min(wa.x, 0.5 - wa.x) * 2.0, spV = rowPx * 0.24;
    float lu = mix(avgU, covU, smoothstep(3.0, 6.0, spU));
    float lv = mix(avgV, covV, smoothstep(3.0, 6.0, spV));
    lines = max(lines, lip);
    lines = max(lines, max(lu, lv) * blk);
    // the clutter a jiehua painter rules into every bay, only where a cell is ≥ ~12 px (below that it is wash)
    float det = smoothstep(11.0, 24.0, cellPx);
    if (det > 0.0) {
      float t4 = h12(cell * 1.31 + seed * 3.7 + 19.0), t5 = h12(cell * 2.17 + seed * 1.9 + 7.0);
      vec2 m = f * vec2(colP, rowP);
      vec2 A = wa * vec2(colP, rowP), B = wb * vec2(colP, rowP);
      float gx = gu, gy = gv;
      float clut = 0.0;
      vec3 clutC = col;
      if (t4 > 0.7 && t4 <= 0.82) {
        vec2 ca = A - vec2(0.06, 0.05), cb = B + vec2(0.06, 0.1);
        float inC = cover1(m.x, ca.x, cb.x, gx) * cover1(m.y, ca.y, cb.y, gy);
        float bars = ruled(ruleDist(q.x, 0.13, gx), wpx * 0.6, 0.13 / gx);
        float rails = inkCov(min(min(abs(m.y - ca.y), abs(m.y - cb.y)), abs(m.y - mix(ca.y, cb.y, 0.55))) / gy, wpx * 0.8);
        float box = max(inkCov(min(abs(m.x - ca.x), abs(m.x - cb.x)) / gx, wpx * 0.9), rails);
        clut = max(clut, max(bars, box) * inC);
        clutC = mix(clutC, clutC * 0.82, inC);
      }
      if (t4 > 0.82 && t4 <= 0.9) {
        float inW = cover1(m.x, A.x, B.x, gx) * cover1(m.y, A.y, B.y, gy);
        clutC = mix(clutC, base * 1.04, inW);
        clut = max(clut, ruled(ruleDist(q.y, 0.1, gy), wpx * 0.5, 0.1 / gy) * inW);
        emit *= 1.0 - inW;
      }
      if (t4 > 0.9) {
        float py = B.y - 0.05;
        float pole = inkCov(abs(m.y - py) / gy, wpx * 0.7) * cover1(m.x, A.x - 0.2, B.x + 0.2, gx);
        float k = floor((m.x - A.x) / 0.42);
        float cx0 = A.x + k * 0.42 + 0.04, cx1 = cx0 + 0.3;
        float hk = h12(vec2(k, cell.x * 3.1 + cell.y + seed));
        float cy0 = py - 0.45 - 0.35 * hk;
        float inCl = cover1(m.x, cx0, cx1, gx) * cover1(m.y, cy0, py, gy) * step(0.0, k) * step(k, 2.0) * step(0.25, hk);
        vec3 cloth = hk < 0.45 ? vec3(0.62, 0.2, 0.14) : hk < 0.62 ? vec3(0.22, 0.34, 0.55) : hk < 0.8 ? vec3(0.86, 0.84, 0.78) : vec3(0.55, 0.43, 0.25);
        clutC = mix(clutC, cloth * 0.85, inCl);
        float clo = max(inkCov(min(abs(m.x - cx0), abs(m.x - cx1)) / gx, wpx * 0.6) * cover1(m.y, cy0, py, gy),
                        inkCov(abs(m.y - cy0) / gy, wpx * 0.6) * cover1(m.x, cx0, cx1, gx)) * step(0.0, k) * step(k, 2.0) * step(0.25, hk);
        clut = max(clut, max(pole, clo));
      }
      if (t5 < 0.3) {
        float ax0 = colP * 0.5, ax1 = ax0 + 0.72, ay0 = 0.12, ay1 = 0.62;
        float inA = cover1(m.x, ax0, ax1, gx) * cover1(m.y, ay0, ay1, gy);
        clutC = mix(clutC, base * 1.16, inA);
        float edge = max(inkCov(min(abs(m.x - ax0), abs(m.x - ax1)) / gx, wpx * 0.8) * cover1(m.y, ay0, ay1, gy),
                         inkCov(min(abs(m.y - ay0), abs(m.y - ay1)) / gy, wpx * 0.8) * cover1(m.x, ax0, ax1, gx));
        float grille = ruled(ruleDist(m.y - ay0, 0.09, gy), wpx * 0.45, 0.09 / gy) * cover1(m.x, ax0 + 0.08, ax0 + 0.4, gx) * cover1(m.y, ay0 + 0.06, ay1 - 0.06, gy);
        clut = max(clut, max(edge, grille));
        emit *= 1.0 - inA;
      }
      if (t5 > 0.955) {
        float by0 = rowP * 0.84, by1 = rowP * 0.97;
        float inB = cover1(m.x, 0.1, colP - 0.1, gx) * cover1(m.y, by0, by1, gy);
        vec3 bc = t4 < 0.5 ? vec3(0.42, 0.1, 0.08) : vec3(0.1, 0.18, 0.32);
        clutC = mix(clutC, bc, inB);
        clut = max(clut, max(inkCov(min(abs(m.y - by0), abs(m.y - by1)) / gy, wpx * 0.8) * cover1(m.x, 0.1, colP - 0.1, gx),
                             inkCov(min(abs(m.x - 0.1), abs(m.x - colP + 0.1)) / gx, wpx * 0.8) * cover1(m.y, by0, by1, gy)));
      }
      col = mix(col, clutC, det);
      lines = max(lines, clut * det);
    }
    float pipeOn = step(0.8, h12(vec2(cell.x, seed * 5.7)));
    float xm = f.x * colP;
    float pipe = pipeOn * max(inkCov(abs(xm - 0.1) / gu, wpx * 0.6), inkCov(abs(xm - 0.24) / gu, wpx * 0.6));
    col = mix(col, base * 1.08, pipeOn * cover1(xm, 0.1, 0.24, gu) * blk);
    lines = max(lines, ruled(min(xm, colP - xm) / gu, wpx * 0.45, colPx) * 0.6 * step(0.5, fract(seed * 7.3)));
    lines = max(lines, pipe * smoothstep(4.0, 9.0, 0.14 / gu));
  } else if (kind == 2.0) {
    // glazed roof tiles: courses down the slope, joints across
    // the rulings take the glazed-tile texture's pitch so its joints and the ink coincide
    float rp = uTilePitch.y, cp = uTilePitch.x;
    float rows = ruled(ruleDist(q.y, rp, gv), Wr * 0.8, rp / gv);
    float cols = ruled(ruleDist(q.x, cp, gu), Wr * 0.55, cp / gu) * 0.8;
    col *= 0.93 + 0.14 * h12(floor(q / vec2(cp, rp)));
    lines = max(lines, max(rows, cols));
  } else if (kind == 3.0) {
    // wet granite flagstones (the neon lab's ground, stone() shared with the streak cards): per-stone value and
    // speckle, 55 % darker where wet, a fresnel sheen of the silk, drizzle rings, ink joints
    vec2 p = vWorld.xz;
    vec4 st = stone(p, 1.1);
    float speck = vnoise(p * 23.0) * 0.4 + vnoise(p * 61.0) * 0.35 + vnoise(p * 157.0) * 0.25;
    // painted granite per stone (two layers, a window and a quarter turn each); its cavity deepens puddles
    // (round 9 repair: at full strength the painted granite read as grainy grey noise that broke the streaks. The
    // wet ground stays a smooth dark gloss (the r7 granite); the paint is a quarter strength and only where it is dry;
    // the cavity still pools the puddles)
    vec4 pf = paintFlag(p, 1.0);
    float wLoc = st.z;
    float kf = pk * uPaintK.y * uPaintFlag * (1.0 - smoothstep(0.15, 0.5, wLoc));
    col = base * (0.82 + 0.3 * st.y) * (0.74 + 0.52 * speck) * pInk(mix(vec3(1.0), pf.rgb, kf), uPaintInk);
    float wAmt = wet * mix(0.55, 1.0, wLoc);
    wetPool = wAmt * (1.0 - st.x);
    col *= 1.0 - 0.45 * wAmt;
    float ndv = clamp(V.y, 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
    emit += fogCol(vWorld) * fres * wAmt * 0.3 * (1.0 - st.x);
    // (lab P6) + the water film's reflection of the blue-hour sky: fogCol() is ~black inside the first 16 m of clear
    // air, so the near ground never got a sheen; a broader lobe than Schlick; uLpSky 0 = off
    emit += uFogBaseCol * (0.35 + 0.65 * pow(clamp(1.0 - ndv, 0.0, 1.0), 3.0)) * wAmt * uLpSky * (1.0 - st.x);
    vec2 rc = floor(p / 1.1);
    float rp2 = fract(uTime * 0.7 + h12(rc + 5.0));
    vec2 ctr = (rc + 0.2 + 0.6 * vec2(h12(rc + 1.0), h12(rc + 2.0))) * 1.1;
    float rd = abs(length(p - ctr) - rp2 * 0.3);
    float fwr = max(fwidth(rd), 1e-5);
    float ring = (1.0 - smoothstep(0.004, 0.004 + fwr * 1.2, rd)) * (1.0 - rp2) * wAmt * (1.0 - smoothstep(0.01, 0.03, fwr));
    emit += fogCol(vWorld) * ring * 0.35;
    lines = max(lines, st.x * 0.6);
  } else if (kind == 4.0) {
    // bars / railings: ruled balusters that fade to their average; see-through (ordered dither under the cut)
    float cp = vPat.z;
    float bars = ruled(ruleDist(q.x, cp, gu), Wr * 0.9, cp / gu);
    float mid = inkCov(abs(uv.y - sz.y * 0.5) / gv, Wr * 0.8) * step(0.5, vPat.y);
    float cov = max(max(bars, mid), lines);
#ifdef ALPHA_CUT
    if (cov <= bayer4(gl_FragCoord.xy)) discard;
    forceInk = 1.0;
#endif
    lines = cov;
  } else if (kind == 5.0) {
    // carved stone / timber panel: a double inset frame, a shade deeper field, carved ruyi clouds
    float ins = min(min(uv.x, sz.x - uv.x), min(uv.y, sz.y - uv.y));
    float l1 = inkCov(abs(ins - 0.06) / gq, Wr * 0.8);
    float l2 = inkCov(abs(ins - 0.12) / gq, Wr * 0.55);
    float dens = smoothstep(3.0, 7.0, 0.06 / gq);
    // which paint a panel takes: a painted board (accent) or timber (surf wood); a balustrade-sized stone panel
    // (0.3–1.2 m tall, 1.8–8 × as wide) the carved frieze over its whole face; any other stone box plain stone
    float isBoard = max(accent, step(4.5, surf) * step(surf, 5.5));
    float friezeFace = step(0.3, sz.y) * step(sz.y, 1.2) * step(1.8, sz.x / sz.y) * step(sz.x / sz.y, 8.0);
    float frieze = pk * friezeFace * (1.0 - isBoard) * uPaintStone.y;
    lines = max(lines, max(l1, l2) * dens * (1.0 - frieze));
    col *= mix(1.0, 0.9, step(0.12, ins) * dens * (1.0 - frieze));
    float fh = max(min(sz.x, sz.y) - 0.24, 0.05);
    float cw = fh * 1.5;
    vec2 fp2 = vec2((uv.x - 0.12) / cw, (uv.y - 0.12) / fh);
    vec2 mc = vec2(fract(fp2.x), fp2.y);
    float inField = step(0.12, ins);
    float dm = smoothstep(8.0, 16.0, fh / gq);
    vec2 c1 = vec2(0.3, 0.46), c2 = vec2(0.7, 0.54);
    vec2 d1 = (mc - c1) * vec2(cw, fh), d2 = (mc - c2) * vec2(cw, fh);
    float r1 = fh * 0.26, r2 = fh * 0.24;
    float s1 = min(abs(length(d1) - r1) + step(d1.y, -0.02 * fh) * 9.0, abs(length(d1) - r1 * 0.5));
    float s2 = min(abs(length(d2) - r2) + step(0.02 * fh, d2.y) * 9.0, abs(length(d2) - r2 * 0.5));
    float join = abs((mc.y - 0.5) * fh - (mc.x - 0.5) * cw * 0.25) + step(0.2, abs(mc.x - 0.5)) * 9.0;
    float carve = min(min(s1, s2), join) / gq;
    lines = max(lines, inkCov(carve, Wr * 0.55) * inField * dm * 0.9 * (1.0 - frieze));
    col *= 1.0 - 0.07 * (1.0 - smoothstep(0.0, fh * 0.1, min(min(s1, s2), join))) * inField * dm * (1.0 - frieze);
    // the frieze's own carved frame, lit lips and inked relief replace the ruled inset frame and the procedural ruyi
    // (they fade out under it); boards take weathered lacquer or planks. (Wet is the shared block below.)
    if (pk > 0.0 && isBoard > 0.5) {
      col *= surf == 5.0 ? paintFace(7, q, 1.5, vPat.w, pk * uPaintK.w) : paintFace(6, q, 1.3, vPat.w, pk * uPaintK.w * 0.6);
    } else if (pk > 0.0) {
      col *= pInk(friezeFace > 0.5 ? paintPanel(uv / max(sz, vec2(0.05)), pk * uPaintK.z * uPaintStone.y) : paintWall(2, 2, q, 1.7, vPat.w, pk * uPaintK.z * uPaintStone.x), uPaintInk);
    }
  } else if (kind == 6.0) {
    // net / wrap: a diagonal ruled mesh that fades to its average; see-through
    float cp = vPat.z;
    vec2 rq = vec2(q.x + q.y, q.x - q.y) * 0.7071;
    float gr = max(mpp(rq.x), mpp(rq.y));
    float cov = max(ruled(ruleDist(rq.x, cp, gr), Wr * 0.8, cp / gr), ruled(ruleDist(rq.y, cp, gr), Wr * 0.8, cp / gr));
    cov = max(cov, lines);
#ifdef ALPHA_CUT
    if (cov <= bayer4(gl_FragCoord.xy)) discard;
    forceInk = 1.0;
#endif
    lines = cov;
  } else if (kind == 7.0) {
    // foliage: gongbi leaves, each outlined, tinted per leaf
    vec3 an = abs(n);
    vec2 lp = (an.y > max(an.x, an.z) ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy)) / 0.24;
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
    float flw = max(fwidth(lp.x), fwidth(lp.y)) * 0.24;
    float det = smoothstep(2.5, 6.0, 0.24 / flw);
    float ed = (sqrt(d2) - sqrt(d1)) * 0.5 * 0.24;
    lines = max(lines, inkCov(ed / flw, Wr * 0.6) * det * 0.45);
    col = mix(base, base * (0.72 + 0.55 * idv), det);
  } else if (kind == 8.0) {
    // cloth stripes (awnings, laundry): alternate the wash with clamshell white
    float cp = vPat.z;
    float s = cover1(fract(q.x / cp), 0.0, 0.5, gu / cp);
    col = mix(base, vec3(0.86, 0.84, 0.78), s * vPat.y);
  }

  // explicit surfaces (Look.surf) and bare stone (kind 9), multiplied under the wash and the ink
  if (pk > 0.0 && kind != 1.0 && kind != 2.0 && kind != 3.0 && kind != 5.0) {
    float s = surf < 0.5 && kind == 9.0 ? 2.0 : surf;
    if (s == 2.0) col *= pInk(paintWall(2, 2, q, 1.7, vPat.w, pk * uPaintK.z * uPaintStone.x), uPaintInk);
    else if (s == 3.0 || s == 6.0) col *= pInk(paintWall(4, 2, q, 6.0, vPat.w, pk * uPaintK.z * uPaintStone.z), uPaintInk);
    else if (s == 4.0) col *= paintFace(6, q, 1.3, vPat.w, pk * uPaintK.w);
    else if (s == 5.0) col *= paintFace(7, q, 1.5, vPat.w, pk * uPaintK.w);
    if (s == 6.0) { vec4 pp = paintPoster(q, uv, vPat.w, 0.35, 2.5); col = mix(col, pp.rgb * 0.5 * uWashTint * mix(vec3(1.0), col / max(base, vec3(1e-3)), 0.7), pp.a * pk); }
  }

  // ── the wash: two hard bands of top light (the sky screens), never black ──
  float ndl = dot(n, uLightDir);
  float lit = smoothstep(-0.04, 0.04, ndl - 0.08);
  vec3 shaded = mix(col * uShade, col, lit);
  shaded *= mix(1.0, mix(0.56, 1.06, step(0.0, n.y)), abs(n.y));
  // watercolour on silk: pooling at every wash's border, rain stains, mottle, stone grain
  float faceMin = min(sz.x / gu, sz.y / gv);
  float poolW = 9.0 * uDpr;
  float pool = (1.0 - smoothstep(0.0, poolW, dEdge)) * smoothstep(poolW * 1.5, poolW * 4.0, faceMin);
  shaded *= 1.0 - uPool * pool;
  float stainN = vnoise(vec2(q.x * 1.1 + vPat.w * 7.0, q.y * 0.045)) * 0.7 + vnoise(vec2(q.x * 3.1, q.y * 0.11 + 5.0)) * 0.3;
  shaded *= 1.0 - uStain * vert * smoothstep(0.35, 0.8, stainN);
  float mot = vnoise(q * 0.45 + vPat.w) * 0.6 + vnoise(q * 1.7) * 0.4;
  shaded *= 1.0 + uMottle * (mot - 0.5) * (kind == 9.0 ? 2.2 : 1.0);
  if (kind == 9.0) shaded *= 1.0 + 0.07 * (vnoise(q * 7.0 + vPat.w) - 0.5) + 0.05 * (vnoise(q * 23.0) - 0.5) * (1.0 - smoothstep(0.005, 0.02, gq));
  // rain-wet stone and decks (vMisc.z): darker, the tops most (the flagstones do their own wet in kind 3)
  if (kind != 3.0 && wet > 0.0) {
    float top = step(0.6, n.y);
    shaded *= (1.0 - wet * mix(0.6, 0.9, top)) * mix(vec3(1.0), vec3(0.88, 0.95, 1.1), wet);
    shaded += uFogBaseCol * 0.2 * wet * top * (0.6 + 0.4 * vnoise(vWorld.xz * 1.7));
    // rain rivulets: thin threads of sheen down wet vertical faces (paint.ts pRivulet, from lab P5)
    shaded += uFogBaseCol * 0.4 * wet * pk * pRivulet(q, vert);
  }
  // the silk weave, world-anchored, octave picked from the pixel footprint (never swims, reads at any distance)
  vec3 an = abs(n);
  vec2 wq = an.y > 0.6 ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy);
  float fp = sqrt(length(dFdx(vWorld)) * length(dFdy(vWorld)));
  float lv = log2(max(fp * 1.9 * 256.0, 1e-4) / 0.35);
  float ko = floor(lv), fo = lv - ko;
  float s0 = 0.35 * exp2(ko);
  float weave = mix(texture(uSilk, wq / s0).r, texture(uSilk, wq / (s0 * 2.0) + 0.37).r, fo);
  float gran = mix(vnoise(wq / (s0 * 0.16)), vnoise(wq / (s0 * 0.32) + 3.1), fo);
  float gk = kind == 3.0 ? 2.0 : 1.0;
  shaded *= 1.0 + ((weave - 0.5) * uWeave * 2.0 + (gran - 0.5) * uWeave * 1.6) * gk;
  // neon spill, baked per vertex at build time (emitters.ts)
  // (capped: the sign masts on the balustrade must not bleach the stone; wet stone shows it as a darker sheen)
  // (lab P6) the blue-hour ambient scales the wash only (spill, pools, emitters and ink keep their value)
  shaded *= uLpAmb;
  shaded += col * min(vSpill, vec3(0.7)) * 1.3 * (kind == 3.0 ? 1.0 : 1.0 - 0.5 * wet);
  // (lab P6) the warm pools: diffuse on the wash; on wet stone a broad glossy sheen of the same light
  vec3 lp = poolLight(vWorld, n);
  shaded += col * lp * uLpGain.x;
  emit += lp * wetPool * uLpGain.y * (0.35 + 0.65 * pow(clamp(1.0 - abs(V.y), 0.0, 1.0), 2.0));
  // the colour script: the deep strata sink into indigo paper (their windows gold) — the sutra's hinge
  float lumC = lum(shaded);
  float deep = (1.0 - smoothstep(-150.0, 70.0, vWorld.y)) * 0.9;
  vec3 deepC = mix(uPaperDeep, uPaper, clamp(lumC * 1.6, 0.0, 1.0)) * mix(0.8, 1.2, lit);
  shaded = mix(shaded, mix(deepC, shaded * 0.5, accent * 0.6), deep * 0.85);
  // 泥金磁青: indigo paper, accents keep a darkened hue, lit windows go gold
  vec3 paper = mix(uPaperDeep, uPaper, clamp(lumC * 1.7, 0.0, 1.0));
  vec3 sut = mix(paper, shaded * 0.5, accent);
  col = mix(shaded, sut, uSutra);
  emit = mix(emit, uSutraWin * dot(emit, vec3(0.33)), max(uSutra, deep * 0.7));
  if (gloss > 0.5) {
    vec3 R = reflect(-V, n);
    float s = max(dot(R, normalize(uLightDir + vec3(-0.3, 0.2, 0.5))), 0.0);
    col += (smoothstep(0.88, 0.92, s) * 0.8 + smoothstep(0.25, 0.95, s) * 0.15) * vec3(1.0, 0.94, 0.78);
  }

  // ── ink: 焦墨 near → 淡墨 by uInkMid → dissolved by uLineFade.y; silver at the Rail Cut hinge, gold below it,
  // gold on the hooks and in the sutra look ──
  float yy = vWorld.y;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  inkC = mix(inkC, uSilver, 1.0 - smoothstep(-80.0, -40.0, yy));
  inkC = mix(inkC, uGold, 1.0 - smoothstep(-160.0, -120.0, yy));
  vec3 goldC = mix(uGold * 1.35, uGoldDim, smoothstep(8.0, 150.0, dist));
  vec3 lineC = mix(inkC, goldC, max(uSutra, goldL));
  vec4 fgc = silkFog(vWorld, uFogScale);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  float li = clamp(lines, 0.0, 1.0) * fade * pow(max(fgc.a, 1e-4), uLineFog - 1.0);
  col = mix(col, lineC, mix(li, fade, forceInk));
  emit += goldL * li * uGold * 0.8;
  emit += li * uGold * 0.9 * (1.0 - smoothstep(-120.0, -20.0, yy)) * (1.0 - uSutra);

  vec3 fogC = fgc.rgb * silkPaper(gl_FragCoord.xy);
  vec3 outc = col * fgc.a + fogC + emit * pow(max(fgc.a, 1e-4), 0.85);
  // alpha = normalised inverse view depth: the MSAA resolve averages it, the post silhouette reads it
  gl_FragColor = vec4(outc, uNear / max(vViewZ, uNear));
}
`;

export function jiehuaMaterial(shared: Shared, opt: { alphaCut?: boolean; viewmodel?: boolean; doubleSide?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = { ...shared.u, uFogScale: { value: 1 } };
  if (opt.viewmodel === true) {
    u['uCam'] = { value: new Vector3() };
    u['uFogScale'] = { value: 0 };
    u['uLightDir'] = { value: new Vector3(0.3, 0.8, 0.5).normalize() };
    u['uLineFade'] = { value: new Vector2(100, 200) };
    u['uPaintK'] = { value: new Vector4(0, 1, 1, 1) }; // the weapon is not painted stone
  }
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: VS_JIEHUA,
    fragmentShader: FS_JIEHUA,
    vertexColors: true,
    defines: opt.alphaCut === true ? { ALPHA_CUT: '' } : {},
  });
  if (opt.doubleSide === true || opt.alphaCut === true) m.side = DoubleSide;
  return m;
}

// ── neon signs: an SDF-free canvas atlas of hand-bent calligraphy; the board shows through where the tubes are not ──
const VS_NEON = /* glsl */ `
attribute vec4 aNeon;
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vColor;
varying vec3 vTint;
flat varying vec4 vNeon;
varying float vViewZ;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vColor = color;
  vTint = aTint;
  vNeon = aNeon;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS_NEON = /* glsl */ `
uniform sampler2D uMono;
uniform sampler2D uColour;
uniform float uTime;
uniform float uSutra;
uniform vec3 uPaperDeep;
uniform float uFogScale;
uniform float uNeonGain;
uniform float uNear;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vColor;
varying vec3 vTint;
flat varying vec4 vNeon;
varying float vViewZ;
${NOISE_GLSL}
${FOG_GLSL}
void main() {
  float mode = floor(vNeon.w + 0.5);
  float fl = 1.0;
  if (vNeon.y > 0.0) {
    float t = uTime * (1.3 + vNeon.y * 2.5) + vNeon.y * 91.7;
    float nn = fract(sin(floor(t) * 12.9898 + vNeon.y * 78.233) * 43758.5453);
    float mm = fract(sin(floor(t * 11.0) * 4.1 + vNeon.y * 3.0) * 31718.13);
    fl = nn < 0.22 ? (mm < 0.55 ? 0.12 : 1.0) : 1.0;
  }
  vec3 E;
  vec3 D;
  if (mode < 0.5) {
    float L = texture(uMono, vUv).r;
    // the tube core carries the full HDR gain; the halo only a little (bloom paints the glow), so strokes stay legible
    float core = smoothstep(0.62, 0.95, L);
    float halo = L * (1.0 - core);
    E = vTint * (core + halo * 0.16) * vNeon.x * fl * uNeonGain;
    D = vColor * (1.0 - L) + vTint * halo * 0.25;
  } else if (mode < 1.5) {
    E = vTint * vNeon.x * fl * uNeonGain;
    D = vec3(0.0);
  } else if (mode < 2.5) {
    float b = step(0.6, fract(uTime * 0.75 + vNeon.y));
    E = vTint * vNeon.x * b;
    D = vTint * 0.05;
  } else {
    vec4 t = texture(uColour, vUv);
    D = mix(vColor, t.rgb, t.a);
    E = t.rgb * t.a * max(vNeon.x - 1.0, 0.0);
  }
  D = mix(D, D * 0.3 + uPaperDeep * 0.55 * step(mode, 0.5), uSutra);
  vec4 fg = silkFog(vWorld, uFogScale);
  vec3 outc = D * fg.a + fg.rgb + E * pow(max(fg.a, 1e-4), vNeon.z);
  gl_FragColor = vec4(outc, uNear / max(vViewZ, uNear));
}
`;

export function neonMaterial(shared: Shared, tex: { mono: Texture; colour: Texture }, opt: { viewmodel?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = { ...shared.u, uMono: { value: tex.mono }, uColour: { value: tex.colour }, uFogScale: { value: 1 }, uNeonGain: { value: 1 } };
  if (opt.viewmodel === true) { u['uCam'] = { value: new Vector3() }; u['uFogScale'] = { value: 0 }; }
  return new ShaderMaterial({ uniforms: u, vertexShader: VS_NEON, fragmentShader: FS_NEON, vertexColors: true });
}

// ── the silk sky (only the Crown's strip of it shows) ──
const VS_SKY = /* glsl */ `
uniform vec3 uCam;
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(position + uCam, 1.0);
  gl_Position = p.xyww;
}
`;
const FS_SKY = /* glsl */ `
uniform float uSutra;
uniform sampler2D uSilk;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 j = mix(uSkyHorizon, uSkyTop, smoothstep(0.05, 0.95, e));
  vec3 s = mix(vec3(0.024, 0.04, 0.085), vec3(0.008, 0.012, 0.03), smoothstep(0.0, 0.9, e));
  vec2 sc = vec2(atan(d.z, d.x) * 90.0, e * 90.0);
  vec2 ci = floor(sc);
  float st = step(0.975, h12(ci)) * (1.0 - smoothstep(0.05, 0.32, length(fract(sc) - 0.5))) * smoothstep(0.05, 0.3, e);
  s += st * vec3(0.95, 0.72, 0.32) * 2.0;
  vec3 col = mix(j, s, uSutra);
  col *= 1.0 + (texture(uSilk, gl_FragCoord.xy / 380.0).r - 0.5) * 0.07;
  gl_FragColor = vec4(col, 0.0);
}
`;
export function skyMaterial(shared: Shared): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uCam: shared.u.uCam, uSutra: shared.u.uSutra, uSilk: shared.u.uSilk, uSkyTop: shared.u.uSkyTop, uSkyHorizon: shared.u.uSkyHorizon },
    vertexShader: VS_SKY, fragmentShader: FS_SKY, side: BackSide, depthWrite: false, depthTest: false,
  });
}

// ── LED sky screens: a pixelated 青绿 landscape (千里江山图) at a visible dot pitch, scan roll and dead pixels ──
const VS_SCREEN = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying float vViewZ;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS_SCREEN = /* glsl */ `
uniform float uTime;
uniform float uSutra;
uniform vec2 uSize;
uniform float uPitch;
uniform float uSeed;
uniform float uFogScale;
uniform float uLinePx;
uniform float uNear;
varying vec2 vUv;
varying vec3 vWorld;
varying float vViewZ;
${NOISE_GLSL}
${FOG_GLSL}
float ridge(float x, float s) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 5; i++) { v += a * vnoise1(x * f + s); f *= 2.07; a *= 0.5; }
  return v;
}
void main() {
  vec2 m = vUv * uSize;
  vec2 cell = floor(m / uPitch);
  vec2 P = (cell + 0.5) * uPitch / uSize;
  P = vec2(P.x * 1.1 + uSeed * 0.1, fract(P.y * 1.3 + 0.1));
  // 千里江山: five layers of blue-green ridges, each with an ink contour on its crest, ochre feet dissolving into a
  // band of pale mist, dotted trees on the near ridges, flat cloud bands, water at the bottom
  float px = fract(P.x);
  vec3 sky = mix(vec3(0.74, 0.83, 0.86), vec3(0.34, 0.54, 0.8), smoothstep(0.4, 1.0, P.y));
  vec3 c = sky;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float far = 1.0 - fi / 4.0;               // 1 = the farthest, pale layer; 0 = the nearest
    float base = 0.62 - fi * 0.12;
    float amp = 0.18 + 0.1 * (1.0 - far);
    float h = base;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float cx = fract(h11(fk * 3.1 + fi * 7.7 + uSeed) + fk * 0.31);
      float w = 0.05 + 0.07 * h11(fk * 5.3 + fi + uSeed);
      float dx = (px - cx) / w;
      h = max(h, base + amp * (0.5 + 0.5 * h11(fk * 9.1 + fi)) * exp(-dx * dx));
    }
    h += 0.05 * (ridge(px * (6.0 + fi * 3.0) + fi * 2.3, fi) - 0.5) + 0.015 * (vnoise(vec2(px * 90.0, fi)) - 0.5);
    if (P.y < h) {
      float t = clamp((h - P.y) / 0.16, 0.0, 1.0);
      vec3 top = mix(vec3(0.03, 0.44, 0.34), vec3(0.05, 0.28, 0.62), step(0.5, fract(fi * 0.5 + uSeed * 0.13)));
      vec3 foot = vec3(0.70, 0.56, 0.36);
      vec3 cc = mix(top, foot, smoothstep(0.3, 1.0, t));
      cc = mix(cc, vec3(0.86, 0.9, 0.9), smoothstep(0.6, 1.0, t) * 0.6);   // the mist at its foot
      cc = mix(cc, sky, far * 0.4);
      float crest = 1.0 - smoothstep(0.0, 0.012, h - P.y);
      cc = mix(cc, vec3(0.08, 0.12, 0.14), crest * (0.7 - far * 0.5));
      float trees = step(0.8, vnoise(vec2(px * 160.0, P.y * 240.0))) * (1.0 - far) * (1.0 - t);
      cc = mix(cc, vec3(0.06, 0.2, 0.14), trees * 0.8);
      c = cc;
    }
  }
  float cl = smoothstep(0.55, 0.72, vnoise(vec2(px * 7.0 + uTime * 0.01, P.y * 16.0)) * 0.75 + vnoise(vec2(px * 21.0, P.y * 40.0)) * 0.25);
  float band = (1.0 - smoothstep(0.0, 0.07, abs(P.y - 0.74))) + (1.0 - smoothstep(0.0, 0.05, abs(P.y - 0.9))) * 0.8;
  c = mix(c, vec3(0.96, 0.96, 0.93), cl * clamp(band, 0.0, 1.0));
  float water = 1.0 - smoothstep(0.08, 0.12, P.y);
  c = mix(c, vec3(0.44, 0.64, 0.66) + 0.1 * step(0.62, vnoise(vec2(px * 60.0, P.y * 120.0))), water);
  vec2 g = m / uPitch;
  vec2 f = fract(g);
  vec2 fw = max(fwidth(g), vec2(1e-5));
  float dotm = cover1(f.x, 0.1, 0.9, fw.x) * cover1(f.y, 0.1, 0.9, fw.y);
  float far = smoothstep(0.3, 0.7, max(fw.x, fw.y));
  float led = mix(mix(0.74, 1.0, dotm), 0.95, far);
  float scan = 1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.03, abs(fract(vUv.y * 0.6 - uTime * 0.07) - 0.5)));
  float dead = step(0.998, h12(cell + uSeed));
  vec2 panel = abs(fract(m / 8.0 + 0.5) - 0.5) * 8.0;
  vec2 fm = max(fwidth(m), vec2(1e-5));
  float seam = max(lineAt(panel.x, fm.x, uLinePx), lineAt(panel.y, fm.y, uLinePx)) * (1.0 - smoothstep(60.0, 180.0, length(vWorld - uCam)));
  c *= led * scan * (1.0 - dead * 0.55);
  c = mix(c, c * vec3(0.55, 0.62, 0.95) * 0.75, uSutra);
  c = mix(c, vec3(0.06, 0.07, 0.09), seam * 0.55);
  vec4 fg = silkFog(vWorld, uFogScale);
  gl_FragColor = vec4(c * 1.25 * sqrt(max(fg.a, 1e-4)) + fg.rgb, uNear / max(vViewZ, uNear));
}
`;
export function screenMaterial(shared: Shared, w: number, h: number, seed: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...shared.u, uSize: { value: new Vector2(w, h) }, uPitch: { value: 0.14 }, uSeed: { value: seed }, uFogScale: { value: 0.12 } },
    vertexShader: VS_SCREEN, fragmentShader: FS_SCREEN, side: DoubleSide,
  });
}

// ── silk fog sheets: soft cloud layers across the Well at each stratum gap (留白) ──
const VS_SHEET = /* glsl */ `
attribute float aBand;
attribute float aAlpha;
varying vec2 vUv;
varying vec3 vWorld;
varying float vBand;
varying float vAlpha;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vBand = aBand;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_SHEET = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
varying float vBand;
varying float vAlpha;
${NOISE_GLSL}
${FOG_GLSL}
void main() {
  vec2 p = vWorld.xz * 0.045 + vec2(uTime * 0.012, vWorld.y * 0.01);
  float nz = vnoise(p) * 0.55 + vnoise(p * 2.3 + 4.0) * 0.3 + vnoise(p * 5.1 + 9.0) * 0.15;
  float edge = smoothstep(0.0, 0.14, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  float a = smoothstep(0.28, 0.72, nz) * edge * vAlpha;
  a *= smoothstep(1.5, 10.0, abs(uCam.y - vWorld.y));
  int bi = int(vBand + 0.5);
  vec3 c = uBandCols[bi] * 1.06;
  vec4 fg = silkFog(vWorld, 1.0);
  c = c * fg.a + fg.rgb;
  gl_FragColor = vec4(c, a);
}
`;
export function sheetMaterial(shared: Shared): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...shared.u }, vertexShader: VS_SHEET, fragmentShader: FS_SHEET,
    transparent: true, depthWrite: false, side: DoubleSide, ...KEEP_ALPHA,
  });
}

// ── steam from the noodle pots: soft rising puffs ──
const VS_STEAM = /* glsl */ `
attribute vec3 aCenter;
attribute vec2 aCorner;
attribute float aSeed;
uniform float uTime;
varying vec2 vC;
varying float vA;
varying vec3 vWorld;
void main() {
  float ph = fract(uTime * 0.16 + aSeed);
  vec3 c = aCenter + vec3(sin(aSeed * 17.0 + uTime * 0.4) * 0.3 * ph, ph * 3.2, cos(aSeed * 9.0) * 0.2 * ph);
  float s = 0.35 + ph * 1.1;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += aCorner * s;
  vC = aCorner;
  vA = smoothstep(0.0, 0.15, ph) * (1.0 - ph);
  vWorld = c;
  gl_Position = projectionMatrix * mv;
}
`;
const FS_STEAM = /* glsl */ `
uniform float uSutra;
varying vec2 vC;
varying float vA;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  float r = length(vC);
  float n = vnoise(vC * 2.5 + vWorld.xz * 0.7) * 0.5 + 0.5;
  float a = (1.0 - smoothstep(0.2, 1.0, r)) * n * vA * 0.42;
  vec3 c = mix(vec3(0.95, 0.95, 0.93), vec3(0.45, 0.48, 0.62), uSutra);
  gl_FragColor = vec4(c, a);
}
`;
export function steamMaterial(shared: Shared): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: shared.u.uTime, uSutra: shared.u.uSutra }, vertexShader: VS_STEAM, fragmentShader: FS_STEAM,
    transparent: true, depthWrite: false, ...KEEP_ALPHA,
  });
}

// ── the Fei Zhua's mono-filament: a glowing ribbon of constant pixel width, sagging a little ──
const VS_LINE = /* glsl */ `
attribute vec2 aT;
uniform vec3 uA;
uniform vec3 uB;
uniform float uSag;
uniform vec2 uRes;
uniform float uWidth;
varying float vT;
varying float vSide;
vec3 at(float t) { return mix(uA, uB, t) - vec3(0.0, uSag * 4.0 * t * (1.0 - t), 0.0); }
void main() {
  float t = aT.x;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(at(t), 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(at(t + 0.01), 1.0);
  vec2 s0 = c0.xy / c0.w, s1 = c1.xy / c1.w;
  vec2 dir = normalize((s1 - s0) * uRes + 1e-5);
  vec2 nrm = vec2(-dir.y, dir.x) / uRes * uWidth;
  c0.xy += nrm * aT.y * c0.w;
  vT = t;
  vSide = aT.y;
  gl_Position = c0;
}
`;
const FS_LINE = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vT;
varying float vSide;
void main() {
  float core = 1.0 - smoothstep(0.0, 1.0, abs(vSide));
  gl_FragColor = vec4(uColor * uGain * (0.35 + core * core), 1.0);
}
`;
export function lineMaterial(shared: Shared): { mat: ShaderMaterial; u: { uA: { value: Vector3 }; uB: { value: Vector3 }; uSag: { value: number } } } {
  const u = {
    uA: { value: new Vector3() }, uB: { value: new Vector3() }, uSag: { value: 0 }, uRes: shared.u.uRes,
    uWidth: { value: 2.5 }, uColor: { value: c(0x7ff3ff) }, uGain: { value: 5 },
  };
  const mat = new ShaderMaterial({
    uniforms: u,
    vertexShader: VS_LINE, fragmentShader: FS_LINE, transparent: true, ...ADD_KEEP_ALPHA, depthWrite: false, side: DoubleSide,
  });
  return { mat, u };
}

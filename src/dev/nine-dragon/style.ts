// 界画霓虹 Jiehua Neon: one program for all architecture (ruled ink lines drawn in the material, flat mineral washes,
// a 2-band top light from the sky screens, banded silk fog that dilutes the lines first) plus the neon, sky, sky-screen,
// fog-sheet, rain and steam programs. The 泥金磁青 gold-on-indigo sutra look is the `uSutra` uniform (0 → 1).
import {
  AdditiveBlending, BackSide, CanvasTexture, Color, DataTexture, DoubleSide, LinearMipmapLinearFilter, Matrix4, NormalBlending,
  RedFormat, RepeatWrapping, ShaderMaterial, type Texture, type IUniform, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three';
import { INK, METAL, Rng, SUTRA } from './util';

const c = (hex: number): Color => new Color(hex);

/** the fog bands down the Well, top to bottom: centre y, half-width (m), density (1/m), then the two looks' colours */
interface Band { y: number; w: number; d: number; jiehua: number; sutra: number }
const BANDS: readonly Band[] = [
  { y: 212, w: 10, d: 0.012, jiehua: 0xd6dbe2, sutra: 0x2a3a62 },
  { y: 152, w: 4, d: 0.004, jiehua: 0xc9d0da, sutra: 0x24345a },
  { y: 101, w: 8, d: 0.024, jiehua: 0x8e9bb5, sutra: 0x223257 },
  { y: 36, w: 8, d: 0.03, jiehua: 0x7f8d86, sutra: 0x1e2c4e },
  { y: -30, w: 9, d: 0.034, jiehua: 0x4f524f, sutra: 0x192644 },
  { y: -110, w: 11, d: 0.034, jiehua: 0x2b3345, sutra: 0x142039 },
  { y: -190, w: 11, d: 0.04, jiehua: 0x261f31, sutra: 0x101b31 },
  { y: -236, w: 7, d: 0.05, jiehua: 0x10213a, sutra: 0x0c1729 },
  { y: -400, w: 1, d: 0, jiehua: 0x000000, sutra: 0x000000 },
];

function silkWeave(): DataTexture {
  const N = 256, data = new Uint8Array(N * N);
  const r = new Rng(77);
  const warp = Array.from({ length: N / 4 }, () => r.range(-1, 1));
  const weft = Array.from({ length: N / 4 }, () => r.range(-1, 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = x >> 2, ty = y >> 2;
    const over = ((tx + ty) & 1) === 0;
    const px = 1 - Math.abs(((x & 3) + 0.5) / 4 - 0.5) * 2, py = 1 - Math.abs(((y & 3) + 0.5) / 4 - 0.5) * 2;
    const thread = over ? (warp[tx] ?? 0) * 0.4 + px * 0.6 - 0.3 : (weft[ty] ?? 0) * 0.4 + py * 0.6 - 0.3;
    const slub = Math.sin((x + (weft[ty] ?? 0) * 9) * 0.21) * 0.15 + Math.sin((y + (warp[tx] ?? 0) * 7) * 0.17) * 0.15;
    data[y * N + x] = Math.max(0, Math.min(255, Math.round(128 + thread * 40 + slub * 50 + r.range(-10, 10))));
  }
  const t = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** a 1×1 black texture bound in place of the reflection while the reflection itself renders (no feedback loop) */
function blank(): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  return new CanvasTexture(cv);
}

export type Uniforms = Record<string, IUniform>;

/** uniforms every world program shares (one object each, so a write reaches every material) */
export class Shared {
  readonly u = {
    uTime: { value: 0 },
    uCam: { value: new Vector3() },
    uSutra: { value: 0 },
    uLinePx: { value: 1.3 },
    uLineFade: { value: new Vector2(55, 190) },
    uInk0: { value: c(INK.scorched) },
    uInk1: { value: c(0x5d626c) },
    uSilver: { value: c(METAL.silver) },
    uGold: { value: c(METAL.gold) },
    uGoldDim: { value: c(0x7a5f2a) },
    uLightDir: { value: new Vector3(0.42, 0.85, 0.32).normalize() },
    uShade: { value: c(0xb5bccb) },
    uWinWarm: { value: c(0xffc877) },
    uWinCool: { value: c(0xcfe8e4) },
    uPaper: { value: c(SUTRA.indigo) },
    uPaperDeep: { value: c(SUTRA.deep) },
    uSutraWin: { value: c(0xe8b85a) },
    uFogBase: { value: 0.0062 },
    uFogBaseCol: { value: c(0xc2cad6) },
    uBands: { value: BANDS.map((b) => new Vector4(b.y, b.w, b.d, 0)) },
    uBandCols: { value: BANDS.map((b) => c(b.jiehua)) },
    uSilk: { value: silkWeave() as Texture },
    uRefl: { value: blank() },
    uReflOn: { value: 0 },
    uReflMat: { value: new Matrix4() },
    uRes: { value: new Vector2(1, 1) },
  };
  readonly blankTex = blank();
  reflTex: Texture | null = null;

  /** the one uniform flip (plus the fog colours it implies) */
  setSutra(s: number): void {
    this.u.uSutra.value = s;
    BANDS.forEach((b, i) => {
      const col = this.u.uBandCols.value[i];
      if (col !== undefined) col.copy(c(b.jiehua)).lerp(c(b.sutra), s);
    });
    this.u.uFogBaseCol.value.copy(c(0xc2cad6)).lerp(c(0x22325a), s);
  }
}

export const FOG_GLSL = /* glsl */ `
uniform vec3 uCam;
uniform float uFogBase;
uniform vec3 uFogBaseCol;
uniform vec4 uBands[9];
uniform vec3 uBandCols[9];
// banded silk fog: each band is a sech² bump in height whose optical depth along the ray is analytic (tanh);
// bands are composited front to back, so looking down the Well you count them: blue, tea, soot, slate, indigo.
vec4 silkFog(vec3 wp, float scale) {
  if (scale <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 d = wp - uCam;
  float L = length(d);
  float dy = d.y;
  float ady = abs(dy);
  float midY = uCam.y + 0.5 * dy;
  vec3 acc = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 9; i++) {
    int k = dy < 0.0 ? i : 8 - i;
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
    float a = 1.0 - exp(-tau * scale);
    acc += T * a * uBandCols[k];
    T *= 1.0 - a;
  }
  float a0 = 1.0 - exp(-uFogBase * L * scale);
  acc += T * a0 * uFogBaseCol;
  T *= 1.0 - a0;
  return vec4(acc, T);
}
`;

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
`;

const VS_JIEHUA = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec4 aMisc;
attribute vec2 aOff;
uniform mat4 uReflMat;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
varying vec4 vRefl;
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
  vRefl = uReflMat * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FS_JIEHUA = /* glsl */ `
uniform float uTime;
uniform float uSutra;
uniform float uLinePx;
uniform vec2 uLineFade;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform vec3 uSilver;
uniform vec3 uGold;
uniform vec3 uGoldDim;
uniform vec3 uLightDir;
uniform vec3 uShade;
uniform vec3 uWinWarm;
uniform vec3 uWinCool;
uniform vec3 uPaper;
uniform vec3 uPaperDeep;
uniform vec3 uSutraWin;
uniform float uFogScale;
uniform sampler2D uSilk;
uniform sampler2D uRefl;
uniform float uReflOn;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
varying vec4 vRefl;
${FOG_GLSL}
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 base = vColor;
  float kind = floor(vPat.x + 0.5);
  float fl = floor(vMisc.w + 0.5);
  float eU0 = mod(fl, 2.0);
  float eU1 = mod(floor(fl * 0.5), 2.0);
  float eV0 = mod(floor(fl * 0.25), 2.0);
  float eV1 = mod(floor(fl * 0.125), 2.0);
  float accent = mod(floor(fl / 16.0), 2.0);
  float gloss = mod(floor(fl / 32.0), 2.0);
  float goldL = mod(floor(fl / 64.0), 2.0);
  vec3 toCam = uCam - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
  vec2 q = vFace.xy + vOff;
  vec2 fq = max(fwidth(q), vec2(1e-6));
  float Wp = uLinePx;
  float lw = uLinePx * vMisc.y;
  vec2 ff = max(fwidth(vFace.xy), vec2(1e-6));
  float lines = 0.0;
  if (vMisc.y > 0.0) {
    lines = max(lines, eU0 * lineAt(vFace.x, ff.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - vFace.x, ff.x, lw));
    lines = max(lines, eV0 * lineAt(vFace.y, ff.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - vFace.y, ff.y, lw));
  }
  vec3 col = base;
  vec3 emit = base * vMisc.x;
  vec3 winE = vec3(0.0);
  float litWin = 0.0;
  float alpha = 1.0;
  float wet = vMisc.z;
  vec3 reflAdd = vec3(0.0);
  float forceInk = 0.0;

  if (kind == 1.0) {
    // facade: slab lips every row, a window per module, lit or dark; sub-pixel modules dissolve into their average
    float rowP = vPat.y, colP = vPat.z, seed = vPat.w;
    vec2 g = q / vec2(colP, rowP);
    vec2 fg2 = max(fwidth(g), vec2(1e-6));
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float det = smoothstep(3.0, 7.0, 1.0 / max(fg2.x, fg2.y));
    float h1 = h12(cell + seed * 13.1);
    float h2 = h12(cell.yx * 1.7 + seed * 5.3 + 11.0);
    float h3 = h12(cell * 0.73 + seed + 3.0);
    float floorH = h12(vec2(cell.y * 0.37, seed * 2.1));
    float litP = 0.07 + 0.3 * floorH * floorH + 0.08 * h12(vec2(seed, 1.0));
    float isLit = step(h1, litP);
    float sv = h12(vec2(seed, 7.0));
    vec2 wa = vec2(0.12 + 0.12 * sv, 0.24 + 0.08 * fract(sv * 7.0)), wb = vec2(0.88 - 0.12 * sv, 0.86);
    float inX = cover1(f.x, wa.x, wb.x, fg2.x), inY = cover1(f.y, wa.y, wb.y, fg2.y);
    float win = inX * inY;
    vec3 warmC = mix(uWinWarm, uWinCool, step(0.8, h2)) * (0.62 + 0.5 * h3);
    vec3 darkC = base * vec3(0.5, 0.55, 0.66);
    float area = (wb.x - wa.x) * (wb.y - wa.y);
    // an air-con box under some windows
    float ac = step(0.62, h2) * step(h2, 0.8) * cover1(f.x, 0.52, 0.8, fg2.x) * cover1(f.y, 0.03, 0.21, fg2.y);
    vec3 cellC = mix(base, darkC, win * (1.0 - isLit));
    cellC = mix(cellC, base * 1.12, ac);
    vec3 avgC = mix(base, darkC, area * (1.0 - litP));
    col = mix(avgC, cellC, det);
    litWin = mix(litP * area, isLit * win, det);
    winE = mix(uWinWarm * litP * area * 0.9, warmC * isLit * win, det);
    float slab = lineAt(min(f.y, 1.0 - f.y) * rowP, fq.y, Wp * 1.25) * smoothstep(2.5, 5.0, 1.0 / fg2.y);
    float inXh = step(wa.x, f.x) * step(f.x, wb.x), inYh = step(wa.y, f.y) * step(f.y, wb.y);
    float fx = min(abs(f.x - wa.x), abs(f.x - wb.x)) * colP;
    float fy = min(abs(f.y - wa.y), abs(f.y - wb.y)) * rowP;
    float frame = max(lineAt(fx, fq.x, Wp * 0.85) * inYh, lineAt(fy, fq.y, Wp * 0.85) * inXh);
    float mull = lineAt(abs(f.x - 0.5) * colP, fq.x, Wp * 0.7) * inYh * step(0.35, h2);
    float cage = step(h3, 0.18) * lineAt(abs(fract((f.x - wa.x) / (wb.x - wa.x) * 7.0) - 0.5) * colP * (wb.x - wa.x) / 7.0, fq.x, Wp * 0.6) * inXh * inYh;
    float acl = step(0.62, h2) * step(h2, 0.8) * max(lineAt(min(abs(f.x - 0.52), abs(f.x - 0.8)) * colP, fq.x, Wp * 0.7) * step(0.03, f.y) * step(f.y, 0.21),
      lineAt(min(abs(f.y - 0.03), abs(f.y - 0.21)) * rowP, fq.y, Wp * 0.7) * step(0.52, f.x) * step(f.x, 0.8));
    lines = max(lines, slab);
    lines = max(lines, max(max(frame, mull), max(cage, acl)) * det);
  } else if (kind == 2.0) {
    // glazed roof tiles: courses down the slope, tile joints across
    float rp = 0.32, cp = 0.26;
    float rows = lineAt(abs(fract(q.y / rp + 0.5) - 0.5) * rp, fq.y, Wp * 0.9) * smoothstep(2.5, 6.0, rp / fq.y);
    float cols = lineAt(abs(fract(q.x / cp + 0.5) - 0.5) * cp, fq.x, Wp * 0.6) * smoothstep(3.0, 7.0, cp / fq.x) * 0.7;
    col *= 0.93 + 0.14 * h12(floor(q / vec2(cp, rp)));
    lines = max(lines, max(rows, cols));
  } else if (kind == 3.0) {
    // wet granite flagstones: ruled joints, puddles, neon falling in as vertical streaks, drizzle rings
    vec2 p = vWorld.xz;
    float rh = 0.74;
    float r = floor(p.y / rh);
    float off = h11(r * 3.7) * 1.3;
    float L = 1.05 + 0.4 * h11(r * 9.1 + 2.0);
    float cx = floor((p.x + off) / L);
    float fxs = fract((p.x + off) / L), fys = fract(p.y / rh);
    vec2 fw2 = max(fwidth(p), vec2(1e-6));
    float joint = max(lineAt(min(fxs, 1.0 - fxs) * L, fw2.x, Wp * 0.8), lineAt(min(fys, 1.0 - fys) * rh, fw2.y, Wp * 0.8));
    joint *= smoothstep(2.5, 6.0, rh / max(fw2.x, fw2.y));
    float hs = h12(vec2(cx, r));
    col = base * (0.9 + 0.17 * hs);
    float puddle = smoothstep(0.45, 0.66, vnoise(p * 0.23) * 0.65 + vnoise(p * 0.9 + 3.0) * 0.35);
    float wAmt = mix(0.5, 1.0, puddle) * wet;
    col *= 1.0 - 0.34 * wAmt;
    if (uReflOn > 0.5) {
      vec2 ruv = vRefl.xy / vRefl.w;
      vec2 rip = (vec2(vnoise(p * 2.6 + uTime * 0.7), vnoise(p * 2.6 - uTime * 0.6 + 7.0)) - 0.5) * 0.014 * (1.0 - puddle * 0.7);
      ruv += rip;
      vec4 acc = vec4(0.0);
      float wsum = 0.0;
      float stretch = 0.0065 * (1.4 - puddle * 0.7);
      for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        float wg = 1.0 - abs(fi) / 5.0;
        acc += texture(uRefl, ruv + vec2(0.0, fi * stretch)) * wg;
        wsum += wg;
      }
      acc /= wsum;
      float fres = 0.3 + 0.7 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
      float k = wAmt * fres;
      col = mix(col, acc.rgb, clamp(acc.a * k * 0.6, 0.0, 1.0));
      reflAdd = acc.rgb * k * (0.35 + 0.65 * puddle) * 0.55;
    }
    vec2 rc = floor(p / 1.3);
    float rp2 = fract(uTime * 0.6 + h12(rc + 5.0));
    vec2 ctr = (rc + 0.2 + 0.6 * vec2(h12(rc + 1.0), h12(rc + 2.0))) * 1.3;
    float rd = abs(length(p - ctr) - rp2 * 0.34);
    float ring = lineAt(rd, max(fw2.x, fw2.y), Wp * 0.8) * (1.0 - rp2) * wAmt * (1.0 - smoothstep(0.012, 0.03, max(fw2.x, fw2.y)));
    col = mix(col, col * 1.35 + 0.04, ring * 0.6);
    lines = max(lines, joint * 0.6);
  } else if (kind == 4.0) {
    // cage / railing: ruled bars (alpha-cut program)
    float cp = vPat.z;
    float bx = abs(fract(q.x / cp + 0.5) - 0.5) * cp;
    float dens = smoothstep(2.5, 5.0, cp / fq.x);
    float bars = lineAt(bx, fq.x, Wp) * dens;
    float mid = lineAt(abs(vFace.y - vFace.w * 0.5), ff.y, Wp) * step(0.5, vPat.y);
    float cov = max(max(bars, mid), lines);
    cov = max(cov, (1.0 - dens) * 0.28);
    lines = cov;
#ifdef ALPHA_CUT
    if (cov < 0.03) discard;
    alpha = cov;
    forceInk = 1.0;
#endif
  } else if (kind == 5.0) {
    // stone / timber panel: a double inset frame (carved field)
    float ins = min(min(vFace.x, vFace.z - vFace.x), min(vFace.y, vFace.w - vFace.y));
    float fwm = max(ff.x, ff.y);
    float l1 = lineAt(abs(ins - 0.07), fwm, Wp * 0.85);
    float l2 = lineAt(abs(ins - 0.13), fwm, Wp * 0.6);
    lines = max(lines, max(l1, l2) * smoothstep(2.0, 5.0, 0.07 / fwm));
    col *= mix(1.0, 0.9, step(0.13, ins));
  } else if (kind == 6.0) {
    // net / wrap: diagonal ruled mesh
    float cp = vPat.z;
    vec2 rq = vec2(q.x + q.y, q.x - q.y) * 0.7071;
    vec2 fr = max(fwidth(rq), vec2(1e-6));
    vec2 dd = abs(fract(rq / cp + 0.5) - 0.5) * cp;
    float dens = smoothstep(2.0, 5.0, cp / max(fr.x, fr.y));
    float cov = max(lineAt(dd.x, fr.x, Wp * 0.8), lineAt(dd.y, fr.y, Wp * 0.8)) * dens;
    cov = max(cov, lines);
#ifdef ALPHA_CUT
    cov = max(cov, (1.0 - dens) * 0.1);
    if (cov < 0.03) discard;
    alpha = cov;
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
    lines = max(lines, lineAt(ed, flw, Wp * 0.7) * det * 0.45);
    col = mix(base, base * (0.72 + 0.55 * idv), det);
  } else if (kind == 8.0) {
    // cloth stripes (awnings, laundry): alternate the wash with clamshell white
    float cp = vPat.z;
    float s = cover1(fract(q.x / cp), 0.0, 0.5, fq.x / cp);
    col = mix(base, vec3(0.86, 0.84, 0.78), s * vPat.y);
  }

  // two hard bands of top light (the sky screens), never black
  float ndl = dot(n, uLightDir);
  float lit = smoothstep(-0.03, 0.03, ndl - 0.05);
  vec3 shaded = mix(col * uShade, col, lit) * (0.95 + 0.05 * n.y);
  // 泥金磁青: indigo paper, accents keep a darkened hue, lit windows turn gold
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 paper = mix(uPaperDeep, uPaper, clamp(lum * 1.7, 0.0, 1.0));
  vec3 sut = mix(paper, col * 0.5, accent);
  sut = mix(sut * 0.7, sut, lit);
  col = mix(shaded, sut, uSutra);
  winE = mix(winE, uSutraWin * litWin * 0.9, uSutra);

  if (gloss > 0.5) {
    vec3 R = reflect(-V, n);
    float s = max(dot(R, normalize(uLightDir + vec3(-0.3, 0.2, 0.5))), 0.0);
    col += (smoothstep(0.88, 0.92, s) * 0.9 + smoothstep(0.25, 0.95, s) * 0.18) * vec3(1.0, 0.94, 0.78);
  }
  vec3 an2 = abs(n);
  vec2 sp = an2.y > 0.6 ? vWorld.xz : (an2.x > an2.z ? vWorld.zy : vWorld.xy);
  col *= 1.0 + (texture(uSilk, sp * 0.8).r - 0.5) * 0.09;

  // line colour: scorched ink near, light ink far; silver at the Rail Cut hinge, gold on the dark strata below
  float yy = vWorld.y;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(6.0, 70.0, dist));
  inkC = mix(inkC, uSilver, 1.0 - smoothstep(-80.0, -40.0, yy));
  inkC = mix(inkC, uGold, 1.0 - smoothstep(-160.0, -120.0, yy));
  vec3 goldC = mix(uGold * 1.35, uGoldDim, smoothstep(8.0, 150.0, dist));
  vec3 lineC = mix(inkC, goldC, max(uSutra, goldL));
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  float li = clamp(lines, 0.0, 1.0) * fade;
  col = mix(col, lineC, mix(li, fade, forceInk));
  emit += goldL * li * uGold * 0.8;

  vec4 fgc = silkFog(vWorld, uFogScale);
  vec3 outc = col * fgc.a + fgc.rgb + (emit + winE + reflAdd) * sqrt(fgc.a);
  gl_FragColor = vec4(outc, alpha);
}
`;

export function jiehuaMaterial(shared: Shared, opt: { alphaCut?: boolean; viewmodel?: boolean; doubleSide?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = { ...shared.u, uFogScale: { value: 1 } };
  if (opt.viewmodel === true) {
    u['uCam'] = { value: new Vector3() };
    u['uFogScale'] = { value: 0 };
    u['uLightDir'] = { value: new Vector3(0.3, 0.8, 0.5).normalize() };
    u['uLineFade'] = { value: new Vector2(100, 200) };
    u['uReflOn'] = { value: 0 };
  }
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: VS_JIEHUA,
    fragmentShader: FS_JIEHUA,
    vertexColors: true,
    defines: opt.alphaCut === true ? { ALPHA_CUT: '' } : {},
  });
  if (opt.doubleSide === true || opt.alphaCut === true) m.side = DoubleSide;
  if (opt.alphaCut === true) m.alphaToCoverage = true;
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
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  vColor = color;
  vTint = aTint;
  vNeon = aNeon;
  gl_Position = projectionMatrix * viewMatrix * wp;
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
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vColor;
varying vec3 vTint;
flat varying vec4 vNeon;
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
    E = vTint * L * vNeon.x * fl * uNeonGain;
    D = vColor * (1.0 - L);
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
  gl_FragColor = vec4(outc, 1.0);
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
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 j = mix(vec3(0.62, 0.66, 0.72), vec3(0.42, 0.47, 0.58), smoothstep(0.05, 0.95, e));
  j = mix(j, vec3(0.70, 0.62, 0.62), (1.0 - smoothstep(0.0, 0.25, abs(e - 0.1))) * 0.25);
  vec3 s = mix(vec3(0.024, 0.04, 0.085), vec3(0.008, 0.012, 0.03), smoothstep(0.0, 0.9, e));
  vec2 sc = vec2(atan(d.z, d.x) * 90.0, e * 90.0);
  vec2 ci = floor(sc);
  float st = step(0.975, h12(ci)) * (1.0 - smoothstep(0.05, 0.32, length(fract(sc) - 0.5))) * smoothstep(0.05, 0.3, e);
  s += st * vec3(0.95, 0.72, 0.32) * 2.0;
  vec3 col = mix(j, s, uSutra);
  col *= 1.0 + (texture(uSilk, gl_FragCoord.xy / 380.0).r - 0.5) * 0.07;
  gl_FragColor = vec4(col, 1.0);
}
`;
export function skyMaterial(shared: Shared): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uCam: shared.u.uCam, uSutra: shared.u.uSutra, uSilk: shared.u.uSilk },
    vertexShader: VS_SKY, fragmentShader: FS_SKY, side: BackSide, depthWrite: false, depthTest: false,
  });
}

// ── LED sky screens: a pixelated 青绿 landscape (千里江山图) at a visible dot pitch, scan roll and dead pixels ──
const VS_SCREEN = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
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
varying vec2 vUv;
varying vec3 vWorld;
${FOG_GLSL}
${NOISE_GLSL}
float ridge(float x, float s) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 5; i++) { v += a * vnoise1(x * f + s); f *= 2.07; a *= 0.5; }
  return v;
}
void main() {
  vec2 m = vUv * uSize;
  vec2 cell = floor(m / uPitch);
  vec2 P = (cell + 0.5) * uPitch / uSize;
  P = vec2(P.x * 1.25 + uSeed * 0.1, fract(P.y * 1.7 + 0.15));
  // 千里江山: a few big blue-green peaks with ochre feet, flat cloud bands, pale sky, water at the bottom
  float px = fract(P.x);
  vec3 sky = mix(vec3(0.52, 0.70, 0.74), vec3(0.16, 0.36, 0.66), smoothstep(0.3, 1.0, P.y));
  vec3 c = sky;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = 0.04 + fi * 0.07;
    float h = base;
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      float cx = fract(h11(fk * 3.1 + fi * 7.7 + uSeed) + fk * 0.27);
      float w = 0.07 + 0.09 * h11(fk * 5.3 + fi + uSeed);
      float amp = (0.86 - fi * 0.16) * (0.55 + 0.45 * h11(fk * 9.1 + fi * 2.0));
      float dx = (px - cx) / w;
      h = max(h, base + amp * exp(-dx * dx) + 0.035 * ridge(px * 9.0 + fk, fi));
    }
    if (P.y < h) {
      float t = clamp((h - P.y) / max(h - base + 0.1, 0.05), 0.0, 1.0);
      vec3 top = mix(vec3(0.05, 0.36, 0.30), vec3(0.06, 0.24, 0.55), smoothstep(0.05, 0.4, t));
      vec3 bot = vec3(0.66, 0.50, 0.30);
      vec3 cc = mix(top, bot, smoothstep(0.55, 1.0, t));
      cc = mix(cc, sky, fi * 0.28);
      c = cc;
    }
  }
  float cl = smoothstep(0.55, 0.72, vnoise(vec2(px * 7.0 + uTime * 0.01, P.y * 16.0)) * 0.75 + vnoise(vec2(px * 21.0, P.y * 40.0)) * 0.25);
  float band = (1.0 - smoothstep(0.0, 0.1, abs(P.y - 0.3))) + (1.0 - smoothstep(0.0, 0.08, abs(P.y - 0.66))) * 0.8;
  c = mix(c, vec3(0.96, 0.96, 0.93), cl * clamp(band, 0.0, 1.0));
  float water = 1.0 - smoothstep(0.03, 0.06, P.y);
  c = mix(c, vec3(0.44, 0.64, 0.66) + 0.1 * step(0.62, vnoise(vec2(px * 60.0, P.y * 120.0))), water);
  vec2 g = m / uPitch;
  vec2 f = fract(g);
  vec2 fw = max(fwidth(g), vec2(1e-5));
  float dotm = cover1(f.x, 0.1, 0.9, fw.x) * cover1(f.y, 0.1, 0.9, fw.y);
  float far = smoothstep(0.3, 0.7, max(fw.x, fw.y));
  float led = mix(mix(0.5, 1.0, dotm), 0.92, far);
  float scan = 1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.03, abs(fract(vUv.y * 0.6 - uTime * 0.07) - 0.5)));
  float dead = step(0.998, h12(cell + uSeed));
  vec2 panel = abs(fract(m / 8.0 + 0.5) - 0.5) * 8.0;
  vec2 fm = max(fwidth(m), vec2(1e-5));
  float seam = max(lineAt(panel.x, fm.x, uLinePx), lineAt(panel.y, fm.y, uLinePx)) * (1.0 - smoothstep(60.0, 180.0, length(vWorld - uCam)));
  c *= led * scan * (1.0 - dead * 0.55);
  c = mix(c, c * vec3(0.55, 0.62, 0.95) * 0.75, uSutra);
  c = mix(c, vec3(0.06, 0.07, 0.09), seam * 0.85);
  vec4 fg = silkFog(vWorld, uFogScale);
  gl_FragColor = vec4(c * 1.35 * sqrt(max(fg.a, 1e-4)) + fg.rgb, 1.0);
}
`;
export function screenMaterial(shared: Shared, w: number, h: number, seed: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...shared.u, uSize: { value: new Vector2(w, h) }, uPitch: { value: 0.42 }, uSeed: { value: seed }, uFogScale: { value: 0.22 } },
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
${FOG_GLSL}
${NOISE_GLSL}
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
    transparent: true, depthWrite: false, side: DoubleSide, blending: NormalBlending,
  });
}

// ── drizzle: fine ruled streaks, constant pixel width, wrapped around the camera ──
const VS_RAIN = /* glsl */ `
attribute vec3 aSeed;
attribute vec2 aCorner;
uniform float uTime;
uniform vec3 uCam;
uniform vec2 uRes;
uniform float uLinePx;
varying float vA;
varying vec3 vWorld;
void main() {
  vec3 box = vec3(36.0, 26.0, 36.0);
  vec3 fall = vec3(0.9, -11.0, 0.5);
  vec3 p = aSeed * box + fall * uTime;
  p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
  vec3 a = p;
  vec3 b = p - normalize(fall) * 0.55;
  vec4 ca = projectionMatrix * viewMatrix * vec4(a, 1.0);
  vec4 cb = projectionMatrix * viewMatrix * vec4(b, 1.0);
  vec2 sa = ca.xy / ca.w, sb = cb.xy / cb.w;
  vec2 dir = normalize((sb - sa) * uRes + 1e-5);
  vec2 nrm = vec2(-dir.y, dir.x) / uRes * uLinePx * 0.9;
  vec4 cp = mix(ca, cb, aCorner.y);
  cp.xy += nrm * aCorner.x * cp.w;
  vA = 1.0 - smoothstep(4.0, 17.0, length(p - uCam));
  vA *= smoothstep(0.5, 2.0, length(p - uCam));
  vWorld = mix(a, b, aCorner.y);
  gl_Position = cp;
}
`;
const FS_RAIN = /* glsl */ `
uniform float uSutra;
varying float vA;
varying vec3 vWorld;
void main() {
  vec3 c = mix(vec3(0.94, 0.96, 1.0), vec3(0.85, 0.72, 0.45), uSutra);
  gl_FragColor = vec4(c, vA * 0.32);
}
`;
export function rainMaterial(shared: Shared): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: shared.u.uTime, uCam: shared.u.uCam, uRes: shared.u.uRes, uLinePx: shared.u.uLinePx, uSutra: shared.u.uSutra },
    vertexShader: VS_RAIN, fragmentShader: FS_RAIN, transparent: true, depthWrite: false, blending: NormalBlending,
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
    transparent: true, depthWrite: false,
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
    vertexShader: VS_LINE, fragmentShader: FS_LINE, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
  });
  return { mat, u };
}

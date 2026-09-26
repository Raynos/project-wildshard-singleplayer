// Lab P1 "ink" (E169): the 界画 surface look as ONE program for all architecture — ruled ink on every built edge,
// flat pale washes painted like watercolour on silk, and silk fog that dissolves the lines first, then the washes.
//
// Everything is a uniform (one program, constant cache key, the painterly.ts rule); the only define is BARY, the
// barycentric line technique kept for the comparison. Vertex contract = the clean room's kit (see ./kit.ts).
//
// Output alpha is NOT opacity: it carries near / viewZ (1 = at the near plane, 0 = infinitely far), so the MSAA resolve
// averages it by coverage and the post silhouette (./post.ts) reads an antialiased inverse depth.
import {
  BackSide, Color, DataTexture, DoubleSide, LinearMipmapLinearFilter, type IUniform, RedFormat, RepeatWrapping, ShaderMaterial,
  type Texture, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three';

const c = (hex: number): Color => new Color(hex);

/** mulberry32, so the silk is the same every build */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a 256² plain-weave silk: over/under threads with slubs, value ±; one red channel, mipmapped */
export function silkWeave(): DataTexture {
  const N = 256, data = new Uint8Array(N * N), raw = new Float32Array(N * N);
  const r = rng(77);
  const warp = Array.from({ length: N / 2 }, () => r() * 2 - 1);
  const weft = Array.from({ length: N / 2 }, () => r() * 2 - 1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = x >> 1, ty = y >> 1;
    const over = ((tx + ty) & 1) === 0;
    const thread = over ? (warp[tx] ?? 0) * 0.5 : (weft[ty] ?? 0) * 0.5;
    const slub = Math.sin((x + (weft[ty] ?? 0) * 11) * 0.13) * 0.18 + Math.sin((y + (warp[tx] ?? 0) * 9) * 0.11) * 0.18;
    raw[y * N + x] = thread * 36 + slub * 44 + (r() - 0.5) * 22;
  }
  // stretch to the full 0..255 range (p1..p99), so uWeave means the same thing whatever the generator's contrast
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

/** a fog band: centre height, half-width (m), density (1/m), silk colour */
export interface Band { y: number; w: number; d: number; col: number }
export const BAND_COUNT = 6;

export type Uniforms = Record<string, IUniform>;

/** the uniforms every jiehua program shares (one object each, so one write reaches every material) */
export class Shared {
  readonly u = {
    uTime: { value: 0 },
    uCam: { value: new Vector3() },
    uRes: { value: new Vector2(1, 1) },
    /** device pixels per CSS pixel / 3: line widths are authored at 3× DPR */
    uDpr: { value: 1 },
    uFar: { value: 1500 },
    uNear: { value: 0.1 },
    // ── lines ──
    uLineMode: { value: 0 }, // 0 = face-edge attribute, 1 = barycentric (needs BARY), 2 = none (fat lines / post only)
    uLinePx: { value: 2.4 }, // world ruling width, px at 3×
    uGroundPx: { value: 4.2 }, // ground line (walkable lips), px at 3×
    uLineFade: { value: new Vector2(120, 330) }, // lines gone between these distances (m)
    uInkMid: { value: 110 }, // 焦墨 → 淡墨 by this distance
    uInk0: { value: c(0x1c1a19) },
    uInk1: { value: c(0x5f5e5c) },
    uLineFog: { value: 1.7 }, // line opacity × T^k: fog dissolves lines before washes
    // ── washes ──
    uWashMode: { value: 1 }, // 0 = flat 2-band, 1 = painted (pooling, stains, mottle)
    uLightDir: { value: new Vector3(0.35, 0.86, 0.38).normalize() },
    uShade: { value: c(0xadb2bf) },
    uPool: { value: 0.06 },
    uStain: { value: 0.1 },
    uMottle: { value: 0.12 },
    uWeave: { value: 0.08 },
    uSilkPaper: { value: 0.12 }, // the silk's weave + blotch on the fog and the sky (screen space: they have no surface)
    uWashTint: { value: new Vector3(1, 1, 1) }, // a grade on the washes only (not ink, not neon, not accents)
    uWinWarm: { value: c(0xeaa95c) },
    uWinCool: { value: c(0xd8ece6) },
    uWinDark: { value: c(0x5a6068) },
    // ── fog ──
    uFogBase: { value: 0.005 },
    uFogStart: { value: 16 }, // the air is clear this far out: near ink stays black, the silk swallows the distance
    uFogBaseCol: { value: c(0xbbbab6) },
    uBands: { value: Array.from({ length: BAND_COUNT }, () => new Vector4(0, 1, 0, 0)) },
    uBandCols: { value: Array.from({ length: BAND_COUNT }, () => new Color()) },
    uSilk: { value: silkWeave() as Texture },
    // ── output ──
    uHardLines: { value: 0 },
    // 1 = alpha carries near/viewZ (the post silhouette reads it) · 2 = alpha 1 (coverage: set it around a mirror /
    // reflection render whose alpha is read as coverage) · 0 = a normal hash (technique E's crease test)
    uDepthAlpha: { value: 1 },
    // ── the 泥金磁青 flip, kept so the clean room's `uSutra` still works after the swap ──
    uSutra: { value: 0 },
    uGold: { value: c(0xc9a24a) },
    uGoldDim: { value: c(0x7a5f2a) },
    uPaper: { value: c(0x1d2b4a) },
    uPaperDeep: { value: c(0x0e1a2c) },
    uSutraWin: { value: c(0xe8b85a) },
  };

  setBands(bands: readonly Band[]): void {
    for (let i = 0; i < BAND_COUNT; i++) {
      const b = bands[i];
      const v = this.u.uBands.value[i];
      const col = this.u.uBandCols.value[i];
      if (v === undefined || col === undefined) continue;
      if (b === undefined) { v.set(0, 1, 0, 0); continue; }
      v.set(b.y, b.w, b.d, 0);
      col.setHex(b.col);
    }
  }
}

export const NOISE_GLSL = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
// metres per pixel of a scalar field (the gradient length, isotropic — fwidth over-thins 45° lines by √2)
float mpp(float x) { return max(length(vec2(dFdx(x), dFdy(x))), 1e-6); }
// coverage of a ruled line of full width w px whose centre is dpx pixels away: box-filtered, so it never aliases;
// below 1 px the line keeps 1 px of coverage and fades instead of thinning (ink dilution)
uniform float uHardLines; // lab only: 1 = unfiltered step lines, the aliasing reference for the shimmer test
float inkCov(float dpx, float w) {
  if (uHardLines > 0.5) return step(dpx, w * 0.5);
  float wc = max(w, 1.0);
  return clamp(wc * 0.5 + 0.5 - dpx, 0.0, 1.0) * min(w, 1.0);
}
// a repeating ruling (pitch p metres) along coordinate x: distance to the nearest ruled line, in px
float ruleDist(float x, float p, float g) { return abs(fract(x / p + 0.5) - 0.5) * p / g; }
// a ruling of width w px whose lines are sp px apart: crisp above 6 px spacing, its average coverage below 3 px
float ruled(float dpx, float w, float sp) { return mix(clamp(w / sp, 0.0, 1.0), inkCov(dpx, w), smoothstep(3.0, 6.0, sp)); }
// 1-D box coverage of the interval [a, b] by a pixel of footprint g at x (window panes, bars)
float cover1(float x, float a, float b, float g) { return clamp((min(x + 0.5 * g, b) - max(x - 0.5 * g, a)) / g, 0.0, 1.0); }
`;

/** the silk ground under the fog and the sky: weave + slow blotches, in screen space (needs uSilk, uDpr, NOISE_GLSL) */
export const PAPER_GLSL = /* glsl */ `
uniform float uSilkPaper;
float silkPaper(vec2 fc) {
  float sw = texture(uSilk, fc / (486.0 * uDpr)).r;
  float bl = vnoise(fc / (110.0 * uDpr)) * 0.6 + vnoise(fc / (330.0 * uDpr) + 7.0) * 0.4;
  return 1.0 + (sw - 0.5) * uSilkPaper + (bl - 0.5) * uSilkPaper * 0.7;
}
`;

export const FOG_GLSL = /* glsl */ `
uniform vec3 uCam;
uniform float uFogBase;
uniform float uFogStart;
uniform vec3 uFogBaseCol;
uniform vec4 uBands[${BAND_COUNT}];
uniform vec3 uBandCols[${BAND_COUNT}];
// banded silk fog: every band is a sech² bump in height whose optical depth along the ray is analytic (tanh), so
// looking down a Well you count the bands; composited front to back, then the base exponential air. rgb = inscatter,
// a = transmittance T. Each band billows: its depth is scaled by a noise read where the ray crosses the band's
// centre plane (world-anchored, so the clouds stay put while you move). Needs NOISE_GLSL first.
vec4 silkFogK(vec3 wp, float baseK) {
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
    // far crossings are grazing: the noise would stretch into stripes and crawl, so the billows calm with distance
    bil = mix(bil, 0.5, smoothstep(50.0, 160.0, length(d.xz) * clamp(tc, 0.0, 1.0)));
    tau *= 0.35 + 1.3 * bil;
    float a = 1.0 - exp(-tau);
    // the billows are painted: their cores a shade deeper (淡墨 wash in the cloud), their thin parts the bare silk
    acc += T * a * uBandCols[k] * (1.1 - 0.34 * smoothstep(0.4, 1.0, bil));
    T *= 1.0 - a;
  }
  float a0 = 1.0 - exp(-uFogBase * baseK * max(L - uFogStart, 0.0));
  acc += T * a0 * uFogBaseCol;
  T *= 1.0 - a0;
  return vec4(acc, T);
}
vec4 silkFog(vec3 wp) { return silkFogK(wp, 1.0); }
`;

const VS = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec4 aMisc;
attribute vec2 aOff;
#ifdef BARY
attribute vec3 aBary;
varying vec3 vBary;
#endif
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
varying float vViewZ;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
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
#ifdef BARY
  vBary = aBary;
#endif
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

const FS = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform float uDpr;
uniform float uNear;
uniform float uLineMode;
uniform float uLinePx;
uniform float uGroundPx;
uniform vec2 uLineFade;
uniform float uInkMid;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uLineFog;
uniform float uWashMode;
uniform vec3 uLightDir;
uniform vec3 uShade;
uniform float uPool;
uniform float uStain;
uniform float uMottle;
uniform float uWeave;
uniform vec3 uWinWarm;
uniform vec3 uWinCool;
uniform vec3 uWinDark;
uniform sampler2D uSilk;
uniform float uDepthAlpha;
uniform float uSutra;
uniform vec3 uGold;
uniform vec3 uGoldDim;
uniform vec3 uPaper;
uniform vec3 uPaperDeep;
uniform vec3 uSutraWin;
uniform float uFogScale;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec4 vFace;
varying float vViewZ;
flat varying vec4 vPat;
flat varying vec4 vMisc;
varying vec2 vOff;
#ifdef BARY
varying vec3 vBary;
#endif
${NOISE_GLSL}
${FOG_GLSL}
${PAPER_GLSL}
uniform vec3 uWashTint;
float bit(float f, float b) { return mod(floor(f / b), 2.0); }
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float kind = floor(vPat.x + 0.5);
  float fl = floor(vMisc.w + 0.5);
  float accent = bit(fl, 16.0), gloss = bit(fl, 32.0), goldL = bit(fl, 64.0);
  vec3 base = vColor * mix(uWashTint, vec3(1.0), accent);
  vec3 toCam = uCam - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);

  // ── face-local metres and their pixel rates ──
  vec2 uv = vFace.xy;
  vec2 sz = vFace.zw;
  float gu = mpp(uv.x), gv = mpp(uv.y);
  vec2 q = uv + vOff; // world-aligned pattern coordinate (continuous across faces of one wall)
  float gq = max(gu, gv);
  // edge distances in px: u0, u1, v0, v1
  vec4 dpx = vec4(uv.x / gu, (sz.x - uv.x) / gu, uv.y / gv, (sz.y - uv.y) / gv);
  float dEdge = min(min(dpx.x, dpx.y), min(dpx.z, dpx.w));

  // line width: authored at 3× DPR, thins a little with distance (淡墨 lines are finer), weight per quad
  float thin = mix(1.0, 0.62, smoothstep(8.0, 70.0, dist));
  float Wr = uLinePx * uDpr * thin;   // the ruling width (patterns)
  float W = Wr * vMisc.y;             // this quad's own border lines (0 = no borders)
  float Wg = uGroundPx * uDpr * mix(1.0, 0.55, smoothstep(6.0, 60.0, dist));
  float lines = 0.0;
  if (vMisc.y > 0.0 && uLineMode < 0.5) {
    // technique A: the face knows its own borders (aFace), each ruled border is a box-filtered line
    vec4 e = vec4(bit(fl, 1.0), bit(fl, 2.0), bit(fl, 4.0), bit(fl, 8.0));
    vec4 g = vec4(bit(fl, 256.0), bit(fl, 512.0), bit(fl, 1024.0), bit(fl, 2048.0));
    vec4 w4 = mix(vec4(W), vec4(Wg), g);
    e = max(e, g);
    lines = max(max(e.x * inkCov(dpx.x, w4.x), e.y * inkCov(dpx.y, w4.y)), max(e.z * inkCov(dpx.z, w4.z), e.w * inkCov(dpx.w, w4.w)));
  }
#ifdef BARY
  if (vMisc.y > 0.0 && uLineMode > 0.5 && uLineMode < 1.5) {
    // technique B: barycentric distance to the triangle's real borders (the quad diagonal is pushed to 1e3)
    vec3 bw = vec3(mpp(vBary.x), mpp(vBary.y), mpp(vBary.z));
    vec3 bd = vBary / bw;
    float d = min(bd.x, min(bd.y, bd.z));
    lines = inkCov(d, W);
  }
#endif

  vec3 col = base;
  vec3 emit = base * vMisc.x;
  float wet = vMisc.z;
  float vert = 1.0 - abs(n.y);

  if (kind == 1.0) {
    // ── facade: a storey per row, a window module per column ──
    float rowP = vPat.y, colP = vPat.z, seed = vPat.w;
    vec2 g2 = q / vec2(colP, rowP);
    vec2 cell = floor(g2);
    vec2 f = fract(g2);
    float cellPx = min(colP / gu, rowP / gv);
    float blk = smoothstep(3.0, 7.0, cellPx);    // the window blocks themselves
    float h1 = h12(cell + seed * 13.1), h2 = h12(cell.yx * 1.7 + seed * 5.3 + 11.0), h3 = h12(cell * 0.73 + seed + 3.0);
    float floorH = h12(vec2(cell.y * 0.37, seed * 2.1));
    float litP = 0.16 + 0.26 * floorH;
    float isLit = step(h1, litP);
    float sv = h12(vec2(seed, 7.0));
    // window rect in the cell (u: 0..1 across, v: 0..1 up); one shape per building, a few variants per cell
    vec2 wa = vec2(0.16 + 0.1 * sv, 0.26), wb = vec2(0.84 - 0.1 * sv, 0.8);
    float wide = step(0.72, h2);
    wa.x = mix(wa.x, 0.07, wide); wb.x = mix(wb.x, 0.93, wide);
    float inX = cover1(f.x, wa.x, wb.x, gu / colP), inY = cover1(f.y, wa.y, wb.y, gv / rowP);
    float win = inX * inY;
    // under-slab shadow: the top of every storey sits in the lip's shade, a soft wash band (painted, not lit)
    float under = smoothstep(0.72, 0.97, f.y) * 0.45;
    vec3 wall = base * (1.0 - under * blk);
    vec3 glass = mix(uWinDark, uWinDark * 1.35, smoothstep(0.26, 0.8, 1.0 - f.y) * 0.6) * mix(0.85, 1.1, h3) * uWashTint;
    vec3 warm = mix(uWinWarm, uWinCool, step(0.85, h2)) * (0.55 + 0.5 * h3);
    float curtain = step(0.5, h3) * isLit * cover1(f.x, wa.x, mix(wa.x, wb.x, 0.35 + 0.3 * h2), gu / colP);
    vec3 cellC = mix(wall, glass, win);
    cellC = mix(cellC, vec3(0.78, 0.66, 0.5) * 0.9, curtain * win);
    // the far average, so a facade too small for its windows dissolves into its mean tone, never into moiré
    float area = (wb.x - wa.x) * (wb.y - wa.y);
    vec3 avgC = mix(base * (1.0 - 0.11), glass, area * 0.85);
    col = mix(avgC, cellC, blk);
    float litMask = isLit * win * (1.0 - curtain * 0.6);
    emit += mix(uWinWarm * litP * area * 0.5, warm * litMask, blk) * 0.72;
    // ruled work: slab lip (heavier), window frame, mullion + transom, sill. Every ruling family fades to its AVERAGE
    // coverage as its spacing falls under ~6 px → 3 px (Golus's grid rule): a grazing facade turns into an even ink
    // tone, never moiré, and never pops lighter with distance.
    float wpx = Wr;
    float colPx = colP / gu, rowPx = rowP / gv;
    float lipCov = inkCov(ruleDist(q.y, rowP, gv), wpx * 1.35);
    float lip = mix(clamp(wpx * 1.35 / rowPx, 0.0, 1.0), lipCov, smoothstep(3.0, 6.0, rowPx));
    float inXh = step(wa.x, f.x) * step(f.x, wb.x), inYh = step(wa.y, f.y) * step(f.y, wb.y);
    float dfx = min(abs(f.x - wa.x), abs(f.x - wb.x)) * colPx;
    float dfy = min(abs(f.y - wa.y), abs(f.y - wb.y)) * rowPx;
    float mullOn = step(0.3, h2), tranOn = step(0.45, h3);
    // across u: two frame jambs (+ a mullion) per cell; across v: frame head + sill (+ a transom) per storey
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

    // ── the clutter a jiehua painter rules into every bay (only where a cell is ≥ ~12 px: below that it is wash) ──
    float det = smoothstep(11.0, 24.0, cellPx);
    if (det > 0.0) {
      float t4 = h12(cell * 1.31 + seed * 3.7 + 19.0), t5 = h12(cell * 2.17 + seed * 1.9 + 7.0);
      vec2 m = f * vec2(colP, rowP);            // metres inside the cell
      vec2 A = wa * vec2(colP, rowP), B = wb * vec2(colP, rowP);
      float gx = gu, gy = gv;
      float clut = 0.0;
      vec3 clutC = col;
      // a cage grille (铁笼) proud of the window: bars every 0.13 m, three rails, a darker shadowed inside
      if (t4 > 0.7 && t4 <= 0.82) {
        vec2 ca = A - vec2(0.06, 0.05), cb = B + vec2(0.06, 0.1);
        float inC = cover1(m.x, ca.x, cb.x, gx) * cover1(m.y, ca.y, cb.y, gy);
        float bars = ruled(ruleDist(q.x, 0.13, gx), wpx * 0.6, 0.13 / gx);
        float rails = inkCov(min(min(abs(m.y - ca.y), abs(m.y - cb.y)), abs(m.y - mix(ca.y, cb.y, 0.55))) / gy, wpx * 0.8);
        float box = max(inkCov(min(abs(m.x - ca.x), abs(m.x - cb.x)) / gx, wpx * 0.9), rails);
        clut = max(clut, max(bars, box) * inC);
        clutC = mix(clutC, clutC * 0.82, inC);
      }
      // rolled shutter: horizontal slats over the glass, a lighter wash
      if (t4 > 0.82 && t4 <= 0.9) {
        float inW = cover1(m.x, A.x, B.x, gx) * cover1(m.y, A.y, B.y, gy);
        clutC = mix(clutC, base * 1.04, inW);
        clut = max(clut, ruled(ruleDist(q.y, 0.1, gy), wpx * 0.5, 0.1 / gy) * inW);
        emit *= 1.0 - inW;
      }
      // laundry on a pole over the sill: three cloths in muted mineral colours, each outlined
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
      // an air-con box under a third of the windows: a pale box, outlined, a ruled grille
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
      // a shop / clinic board across the head of the bay: a dark mineral field, ruled frame
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
    // module seams + a drain pipe pair down some column lines: long verticals, the ruled rhythm of the facade
    float pipeOn = step(0.8, h12(vec2(cell.x, seed * 5.7)));
    float xm = f.x * colP;
    float pipe = pipeOn * max(inkCov(abs(xm - 0.1) / gu, wpx * 0.6), inkCov(abs(xm - 0.24) / gu, wpx * 0.6));
    col = mix(col, base * 1.08, pipeOn * cover1(xm, 0.1, 0.24, gu) * blk);
    lines = max(lines, ruled(min(xm, colP - xm) / gu, wpx * 0.45, colPx) * 0.6 * step(0.5, fract(seed * 7.3)));
    lines = max(lines, pipe * smoothstep(4.0, 9.0, 0.14 / gu));
  } else if (kind == 2.0) {
    // glazed roof tiles: courses down the slope, joints across
    float rp = 0.3, cp = 0.24;
    float rows = ruled(ruleDist(q.y, rp, gv), Wr * 0.8, rp / gv);
    float cols = ruled(ruleDist(q.x, cp, gu), Wr * 0.55, cp / gu) * 0.8;
    col *= 0.93 + 0.14 * h12(floor(q / vec2(cp, rp)));
    lines = max(lines, max(rows, cols));
  } else if (kind == 3.0) {
    // flagstones: ruled joints in world xz, each stone its own wash, wet darkens the silk
    vec2 p = vWorld.xz;
    float gx = mpp(p.x), gz = mpp(p.y);
    float rh = 0.8;
    float r = floor(p.y / rh);
    float off = h11(r * 3.7) * 1.3;
    float L = 1.1 + 0.4 * h11(r * 9.1 + 2.0);
    float cx = floor((p.x + off) / L);
    float jx = ruleDist(p.x + off - 0.5 * L, L, gx);
    float jz = ruleDist(p.y - 0.5 * rh, rh, gz);
    float joint = max(ruled(jx, Wr * 0.75, L / gx), ruled(jz, Wr * 0.75, rh / gz));
    float hs = h12(vec2(cx, r));
    col = base * (0.92 + 0.14 * hs);
    float puddle = smoothstep(0.3, 0.66, vnoise(p * 0.13) * 0.55 + vnoise(p * 0.5 + 3.0) * 0.3 + vnoise(p * 2.1 + 9.0) * 0.15);
    col *= 1.0 - 0.56 * wet * mix(0.25, 1.0, puddle);
    // a watercolour back-run: the pigment dries darker along the edge of each wet bloom
    float pv = vnoise(p * 0.13) * 0.55 + vnoise(p * 0.5 + 3.0) * 0.3 + vnoise(p * 2.1 + 9.0) * 0.15;
    col *= 1.0 - 0.14 * wet * (1.0 - smoothstep(0.0, 0.035, abs(pv - 0.55)));
    // wet stone mirrors the verticals: streaks that run radially from the eye (= vertical on screen), warm where the
    // lit windows would fall in, the silk's pale sky elsewhere. A cheap stand-in; the real mirror is another lab's.
    vec2 rel = p - uCam.xz;
    float along = length(rel);
    vec2 dirH = rel / max(along, 1e-3);
    float across = dot(p, vec2(-dirH.y, dirH.x));
    float streak = vnoise(vec2(across * 2.2, along * 0.12)) * 0.7 + vnoise(vec2(across * 7.0, along * 0.3 + 4.0)) * 0.3;
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
    float sheen = smoothstep(0.5, 0.9, streak) * wet * puddle;
    col = mix(col, uFogBaseCol * 0.95, fres * wet * 0.28 * puddle);
    emit += mix(uFogBaseCol * 0.1, uWinWarm * 0.08, step(0.62, vnoise(vec2(across * 0.9, 3.0)))) * sheen * (0.3 + 0.7 * fres);
    lines = max(lines, joint * 0.7);
  } else if (kind == 4.0) {
    // railing infill drawn on a panel: ruled balusters over a shadowed void (no alpha, so no A2C / depth-alpha clash)
    float cp = vPat.z;
    float dens = smoothstep(3.0, 7.0, cp / gu);
    float bars = ruled(ruleDist(q.x, cp, gu), Wr * 0.9, cp / gu);
    float voidM = 1.0 - cover1(fract(q.x / cp + 0.5), 0.35, 0.65, gu / cp);
    col = mix(base, base * 0.62, 0.55 * voidM * dens + 0.25 * (1.0 - dens));
    float mid = inkCov(abs(uv.y - sz.y * 0.5) / gv, Wr * 0.8) * step(0.5, vPat.y);
    lines = max(lines, max(bars, mid));
  } else if (kind == 5.0) {
    // carved stone / timber panel: a double inset frame, the field a shade deeper
    float ins = min(min(uv.x, sz.x - uv.x), min(uv.y, sz.y - uv.y));
    float l1 = inkCov(abs(ins - 0.06) / gq, Wr * 0.8);
    float l2 = inkCov(abs(ins - 0.12) / gq, Wr * 0.55);
    float dens = smoothstep(3.0, 7.0, 0.06 / gq);
    lines = max(lines, max(l1, l2) * dens);
    col *= mix(1.0, 0.9, step(0.12, ins) * dens);
    // carved ruyi clouds along the field: per motif two half-scrolls (ruled arcs) joined by a ruled stroke, the carved
    // band a shade deeper — drawn only while a motif is ≥ ~14 px, then it is the field's wash
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
    lines = max(lines, inkCov(carve, Wr * 0.55) * inField * dm * 0.9);
    col *= 1.0 - 0.07 * (1.0 - smoothstep(0.0, fh * 0.1, min(min(s1, s2), join))) * inField * dm;
  }

  // ── the wash: two hard bands of top light (the sky screens), never black ──
  float ndl = dot(n, uLightDir);
  float lit = smoothstep(-0.04, 0.04, ndl - 0.08);
  vec3 shaded = mix(col * uShade, col, lit);
  // tops a touch paler, soffits a deeper ink wash (重墨), never black
  shaded *= mix(1.0, mix(0.56, 1.06, step(0.0, n.y)), abs(n.y));
  if (uWashMode > 0.5) {
    // watercolour on silk: pigment pools at the border of each wash (a soft darker rim inside every face)
    float faceMin = min(sz.x / gu, sz.y / gv);
    float poolW = 9.0 * uDpr;
    float pool = (1.0 - smoothstep(0.0, poolW, dEdge)) * smoothstep(poolW * 1.5, poolW * 4.0, faceMin);
    shaded *= 1.0 - uPool * pool;
    // rain stains: long vertical streaks down the walls, low contrast
    vec2 sp = q;
    float stain = vnoise(vec2(sp.x * 1.1 + vPat.w * 7.0, sp.y * 0.045)) * 0.7 + vnoise(vec2(sp.x * 3.1, sp.y * 0.11 + 5.0)) * 0.3;
    shaded *= 1.0 - uStain * vert * smoothstep(0.35, 0.8, stain);
    // mottle: the wash was laid by a brush, not a spray can
    float mot = vnoise(q * 0.45 + vPat.w) * 0.6 + vnoise(q * 1.7) * 0.4;
    shaded *= 1.0 + uMottle * (mot - 0.5) * (kind == 9.0 ? 2.2 : 1.0);
    // stone is granular: a finer speckle on the balustrade and the curbs
    if (kind == 9.0) shaded *= 1.0 + 0.07 * (vnoise(q * 7.0 + vPat.w) - 0.5) + 0.05 * (vnoise(q * 23.0) - 0.5) * smoothstep(0.02, 0.005, gq);
  }
  // silk weave, world-anchored on the dominant plane, at a near-constant SCREEN frequency: the octave of the weave is
  // picked from the pixel footprint and the two nearest octaves are blended (Bénard-style fractal texture), so the silk
  // reads on a wall 80 m away as on the balustrade at 2 m — and never swims like a screen-space overlay would
  vec3 an = abs(n);
  vec2 wq = an.y > 0.6 ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy);
  float fp = sqrt(length(dFdx(vWorld)) * length(dFdy(vWorld))); // metres per pixel here (any mesh, not only kit quads)
  float lv = log2(max(fp * 1.9 * 256.0, 1e-4) / 0.35);  // a texel ≈ 1.9 px (a thread ≈ 3.8 px); octave 0 = 0.35 m
  float ko = floor(lv), fo = lv - ko;
  float s0 = 0.35 * exp2(ko);
  float wv0 = texture(uSilk, wq / s0).r, wv1 = texture(uSilk, wq / (s0 * 2.0) + 0.37).r;
  float weave = mix(wv0, wv1, fo);
  // granulation: the pigment settles in the silk's slubs — a blotchy mid-frequency mottle, also octave-picked
  float g0 = vnoise(wq / (s0 * 0.16)), g1 = vnoise(wq / (s0 * 0.32) + 3.1);
  float gran = mix(g0, g1, fo);
  float gk = kind == 3.0 ? 2.0 : 1.0; // the wet ground drinks the pigment: its grain shows twice as much
  shaded *= 1.0 + ((weave - 0.5) * uWeave * 2.0 + (gran - 0.5) * uWeave * 1.6) * gk;

  // 泥金磁青 (the clean room's sutra flip): indigo paper, accents keep a darkened hue, lit windows go gold
  float lum = dot(shaded, vec3(0.2126, 0.7152, 0.0722));
  vec3 paper = mix(uPaperDeep, uPaper, clamp(lum * 1.7, 0.0, 1.0));
  vec3 sut = mix(paper, shaded * 0.5, accent);
  col = mix(shaded, sut, uSutra);
  emit = mix(emit, uSutraWin * dot(emit, vec3(0.33)), uSutra);
  if (gloss > 0.5) {
    vec3 R = reflect(-V, n);
    float s = max(dot(R, normalize(uLightDir + vec3(-0.3, 0.2, 0.5))), 0.0);
    col += smoothstep(0.88, 0.92, s) * 0.6 * vec3(1.0, 0.94, 0.78);
  }

  // ── ink: 焦墨 near → 淡墨 by uInkMid → dissolved by uLineFade.y; gold on the hooks and in the sutra look ──
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  vec3 goldC = mix(uGold * 1.35, uGoldDim, smoothstep(8.0, 150.0, dist));
  vec3 lineC = mix(inkC, goldC, max(uSutra, goldL));
  vec4 fgc = silkFog(vWorld);
  fgc = mix(vec4(0.0, 0.0, 0.0, 1.0), fgc, uFogScale);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  float li = clamp(lines, 0.0, 1.0) * fade * pow(fgc.a, uLineFog - 1.0);
  col = mix(col, lineC, li);
  emit += goldL * li * uGold * 0.8;

  // fog: silk, with the silk's weave in screen space (the fog has no surface to swim against)
  vec3 fogC = fgc.rgb * silkPaper(gl_FragCoord.xy);
  vec3 outc = col * fgc.a + fogC + emit * pow(fgc.a, 0.85);
  // alpha = normalised inverse view depth (the MSAA resolve averages it by coverage), or a normal hash for the crease test
  float a = uDepthAlpha > 1.5 ? 1.0 : uDepthAlpha > 0.5 ? uNear / max(vViewZ, uNear) : 0.5 + 0.5 * dot(n, vec3(0.2673, 0.8018, 0.5345));
  gl_FragColor = vec4(outc, a);
}
`;

export function jiehuaMaterial(shared: Shared, opt: { bary?: boolean; doubleSide?: boolean; fog?: boolean } = {}): ShaderMaterial {
  const u: Uniforms = { ...shared.u, uFogScale: { value: opt.fog === false ? 0 : 1 } };
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
    defines: opt.bary === true ? { BARY: '' } : {},
  });
  if (opt.doubleSide === true) m.side = DoubleSide;
  return m;
}

const VS_SKY = /* glsl */ `
varying vec3 vDir;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FS_SKY = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform sampler2D uSilk;
uniform float uDpr;
varying vec3 vDir;
varying vec3 vWorld;
${NOISE_GLSL}
${FOG_GLSL}
${PAPER_GLSL}
void main() {
  float y = vDir.y;
  vec3 col = y > 0.0 ? mix(uHorizon, uZenith, smoothstep(0.0, 0.9, y)) : mix(uHorizon, uNadir, smoothstep(0.0, 0.6, -y));
  // the void below: the bands' billows seen from above, the stacked silk of the scroll (bands only, no distance air)
  vec4 fg = silkFogK(uCam + normalize(vDir) * 700.0, 0.0);
  col = col * fg.a + fg.rgb;
  col *= silkPaper(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 0.0);
}
`;

/** the blank silk behind everything (留白): alpha 0 = "infinitely far" for the post silhouette */
export function skyMaterial(shared: Shared, zenith: number, horizon: number, nadir: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: c(zenith) }, uHorizon: { value: c(horizon) }, uNadir: { value: c(nadir) }, uSilk: shared.u.uSilk, uDpr: shared.u.uDpr,
      uSilkPaper: shared.u.uSilkPaper, uCam: shared.u.uCam, uFogBase: shared.u.uFogBase, uFogStart: shared.u.uFogStart,
      uFogBaseCol: shared.u.uFogBaseCol, uBands: shared.u.uBands, uBandCols: shared.u.uBandCols,
    },
    vertexShader: VS_SKY,
    fragmentShader: FS_SKY,
    side: BackSide,
    depthWrite: false,
  });
}

// 界画霓虹 Jiehua Neon: one program for all architecture (the neon signs are the 'nine-neon' graph). The
// architecture program is the ink lab's (the dev labs (deleted in E357 F7), round-7-lab-ink), merged:
//  - ruled ink on every built border, box-filtered at a fixed px width from the gradient length (`inkCov`, `mpp`), a
//    heavier ground line on walkable lips; every repeated ruling fades to its AVERAGE tone when crowded (`ruled`);
//  - one fade per job: 焦墨 until ~110 m, clear air for the first 16 m, lines gone 120–330 m, fog dissolves lines first
//    (T^0.7);
//  - a painted wash: two hard bands of top light, soffits a deeper ink, pooling, rain stains, mottle, a world-anchored
//    fractal silk weave and granulation; the fog carries a screen-space silk;
//  - alpha = near / viewZ, so the MSAA resolve gives the post silhouette an antialiased inverse depth.
// Kept from the clean room: the wet flagstones shared with the streak cards (kind 3), nets, leaves, cloth, baked neon
// spill, the colour script down the Well and gold lines on the deep strata. One look: blue hour (Jake's round-6 pick).
//
// SHARD-PLATFORM M3 (look-family rows): this file is the look as data for the SDK shader family
// (@wildshard/game/systems/looks/shaderFamily): the shared uniforms as rows, every program's GLSL and its row.
// `@{name}` splices what the shard passes the family (look/style.ts): the datum height (y0), the flagstones' course
// height (flagRh), the painted surfaces' GLSL (paint) and the baked light volume's (lightvol).
import type { ShaderProgramRow, UniformRows } from '@wildshard/game/plugin/shaderFamily';

/** the fog bands down the Well (centre y, half-width m, density /m) and their silk: thin dense bands with clear air
 *  between read as counted bands (ink lab learning 6); deeper = bluer, to indigo */
export interface Band { y: number; w: number; d: number; col: number; puff?: number }
export const BANDS: readonly Band[] = [
  { y: 212, w: 6, d: 0.022, col: 0xd6dbe2 },
  { y: 152, w: 3, d: 0.008, col: 0xc9ced6 },
  // (round 14, the layered Well: Jake's "looking down the Well is flat, there's nothing") the strata bands under the
  // square are THIN silk — a crossing leaves 60–90 % of the light, so each level reads a step paler, not a white slab
  // (F5, the Well's strata: Jake's "down the Well is the weakest … not layered and complex") the Well's bands are CLOUD
  // (puff 1): dense puffs lying across the shaft with clear holes, a stratum every ~20 m, so looking down each level
  // reads through the holes a step deeper and paler; the lowest is the cloud sea the temple's terrace (+48) floats on.
  // Thin (τ ≈ 0.2 a stratum): at twice this, D2's views from inside the Well (its look-down, its aerial from below) went
  // to a white slab — a stratum 5 m under the eye is one puff across the whole frame
  // (render, E281: the coordinator's D eye-check — 50–80 m down the mist passed a quarter of the light, the deep levels
  // and the temple a pale floor) the strata at half their depth
  { y: 103, w: 2.5, d: 0.015, col: 0xc2cad6, puff: 1 },
  { y: 84, w: 3, d: 0.0175, col: 0xbec6d3, puff: 1 },
  { y: 64, w: 3, d: 0.0175, col: 0xb8c2d0, puff: 1 },
  { y: 44, w: 4, d: 0.05, col: 0xb3becc, puff: 1 },
  { y: -30, w: 5, d: 0.045, col: 0x9eabbe },
  { y: -110, w: 5, d: 0.06, col: 0x5d6a86 },
  { y: -190, w: 5, d: 0.1, col: 0x2c3a5e },
  { y: -236, w: 5, d: 0.12, col: 0x16223c },
  { y: -400, w: 1, d: 0, col: 0x000000 },
];
export const BAND_COUNT = 11;

/** uniforms every world program shares, as rows (one live object each, so a write reaches every material); the silk
 *  weave, the metals, the deep strata's paper and the paint's and light volume's textures are added by look/style.ts.
 *  (render, E281) blue hour, high key (the four mockups: a bright silver-blue silk, a pale sky, mid-grey wet stone under
 *  bright reflections — not night): the sky a soft cerulean, the air a pale silver silk, the shaded faces a cool ink-blue */
export const SHARED_UNIFORMS = {
  uTime: 0,
  uCam: { v3: [0, 0, 0] },
  /**
   * the world's frame in the page: its root's world translation (0 standalone; a grid cell's render offset, SF63). The
   * programs shade in the world's own frame (uCam and every vWorld are root-local, so its rects, bands, light volume and
   * flagstones line up wherever the root stands); only the projection adds it back
   */
  uRootAt: { v3: [0, 0, 0] },
  uRes: { v2: [1, 1] },
  /** device px per CSS px / 3: line widths are authored at 3× */
  uDpr: 1,
  uNear: 0.1,
  // lines
  uLinePx: 2.1,
  uGroundPx: 4.2,
  uLineFade: { v2: [120, 330] },
  uInkMid: 110,
  uInk0: { rgb: 0x1c1a19 },
  uInk1: { rgb: 0x5f5e5c },
  uLineFog: 1.7,
  uGoldDim: { rgb: 0x7a5f2a },
  // washes
  uLightDir: { v3: [0.35, 0.86, 0.38], normalize: true },
  uShade: { rgb: 0x8f9ab4 },
  uPool: 0.06,
  uStain: 0.1,
  uMottle: 0.12,
  uWeave: 0.08,
  uSilkPaper: 0.12,
  uWashTint: { v3: [0.9, 0.93, 1.0] },
  uWinWarm: { rgb: 0xeaa95c },
  uWinCool: { rgb: 0xd8ece6 },
  uWinDark: { rgb: 0x5a6068 },
  uSutraWin: { rgb: 0xe8b85a },
  // fog
  // (render, E281) the silk twice as dense (0.0052): the mockups' distance dissolves into pale silk layer by layer
  uFogBase: 0.01,
  uFogStart: 16,
  uFogBaseCol: { rgb: 0xb8c2d2 },
  uBands: { v4s: BANDS.map((b) => [b.y, b.w, b.d, b.puff ?? 0] as const) },
  uBandCols: { rgbs: BANDS.map((b) => b.col) },
  // (E283) the bands a ray from the eye can reach (bandWindow(), from uCam): x the first going down, y the last going
  // up, z 1 = use it (0: every band tested, the old loop)
  uBandWin: { v3: [0, BAND_COUNT - 1, 0] },
  // (render, E281) the wet nosings' glints: x gain, y the share of the sparkle cells lit
  // z: how much of the baked neon spill (vSpill) the glints take (round 2: the targets' treads glint in the neon's
  // colours), w: the sparkle cell's length (m)
  uGlint: { v4: [3, 0.28, 2, 0.1] },
  // (render, E281) how much of the silk the mineral accents take (T^x; 1 = as any wash)
  uAccentFog: 0.35,
  // (render, E281) the flagstones: x the per-stone value swing, y the speckle's contrast, w the granite paint's
  // strength on wet stone
  // (the square lane's ask: big wet granite slabs with clear joints, A1·8)
  uFlag: { v4: [0.5, 0.8, 0, 0.3] },
  // (render, E281) the flagstones' joint: at least this wide (m), so the slabs read as slabs up close
  uFlagJoint: 0.012,
  uGroundY: 0,
  // the painted surfaces (paint.ts, merged from lab P5): the texture array and its strengths; the glazed tiles' pitch
  uTilePitch: { v2: [0.24, 0.22] },
  // the clean room's paint strengths per surface (round 9 repair): flagstones (dry areas only), and
  // x: bare stone (balustrade rails, posts, the Well lip), y: the carved frieze, z: concrete walls
  uPaintFlag: 0.18,
  uPaintStone: { v3: [0.2, 0.0, 0.65] },
  // the Well's shaft mist: its box (x0, z0, x1, z1) (set by build.ts from well-plan.ts SHAFT); x the depth silk's (E281: 0.05 → 0.02)
  // density (0.085 = round 14's profile), y the rim height (build.ts), z the along-canyon air (1/m), w its ceiling over the rim (m)
  uShaft: { v4: [0, 0, 0, 0] },
  // (round 2: the shaft's silk and the base air under the datum thinner — the Well lane's eye-check: 50–80 m down the
  // mist still blanked every level; the levels now separate by their own light over a darker shaft, uDeepAmb)
  uShaftK: { v4: [0.01, 0, 0.003, 30] },
  // (render, E281) how far the shaft's silk takes the strata's pale colour script over the blue base air (0 = round 14)
  uShaftLit: 0.8,
  // (render, E281) the base air's height profile: under the square's datum x its thickening's cap, y its e-fold depth
  // (m); over it z its thinning's e-fold height (m), w its floor (45 m / 0.35 until pass 4: with pass 3's denser silk
  // the aerials over the square went a pale haze; the eye-level views keep theirs)
  uFogDeep: { v4: [0.3, 70, 18, 0.2] },
  // (render, E281 round 2: mockup D reads level after level in BLUE air, darker going down, pale cloud strata between
  // the levels) the air under the square's datum takes this deep blue (rgb, linear) by w, ramping in over the first
  // 60 m down; the shaft's depth silk too. The strata (the bands) keep their pale silk, so each level separates from
  // the next through a pale band over dark blue air, not one pale floor
  uDeepAir: { v4: [0.08, 0.13, 0.25, 0] },
  // (round 2) the deep air's own density: x σ (1/m) on the ray's stretch more than y m under the datum, reaching full
  // σ z m further down. It is what darkens the Well level by level (the fragment's washes are pale under the high key:
  // the base air alone never took more than a tenth of them); lights punch through it like any silk (EMIT_FOG)
  uDeepAir2: { v4: [0, 8, 30, 0] },
  // (round 2) the cloud strata's puff density and hole sharpness (FOG_GLSL silkFog; 1, 2 = F5's)
  uPuff: { v2: [1, 2] },
  // (round 2) the Well's washes under the datum: x the ambient's floor, y / z where it starts / is full (m under the
  // square's datum; smoothstep from z up to y), w its strength (0 = off)
  uDeepAmb: { v4: [0.45, 4, 50, 1] },
  // (round 2, the stair lane: pale pink landings) the silk sky's share of the wet reflection: x the flagstones' fresnel
  // sheen, y the wet tops' (decks, treads, landings) film. The lights' and neon's share (pools, cards, glints) is apart
  uWetSky: { v2: [0.15, 0.08] },
  // (E315) how dry the rain-wet washes are drawn: 0 in the world; the Model Explorer's studio (specimenLight.ts) dries its
  // specimens (a program without it reads 0: the world's)
  uDry: 0,
} as const satisfies UniformRows;

/** (round 14, dome B2: the run north's lit crossings 60–110 m off read grey) how far a light punches through the silk:
 *  an emitter's colour is × T^EMIT_FOG where a wash is × T (0.5 = √T, the lab's; 0.35 lets lit rails, neon strips and
 *  windows read as lines of light down the Well's runs) */
/** (E283, Jake's pick from the before / after stills) the architecture program's painted detail fades out between these
 *  distances (m): near only */
export const JLOD = { near: 15, far: 30 } as const;

export const EMIT_FOG = '0.25';

export const NOISE_GLSL = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
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
uniform vec4 uShaftK;
uniform float uShaftLit;
uniform vec4 uFogDeep;
uniform vec4 uDeepAir;
uniform vec4 uDeepAir2;
uniform vec2 uPuff;
uniform vec4 uDeepAmb;
uniform vec2 uWetSky;
uniform float uDry;
uniform vec4 uBands[${BAND_COUNT}];
uniform vec3 uBandCols[${BAND_COUNT}];
uniform vec3 uBandWin;
// the colour script: the silk's tint at an altitude, interpolated between the bands
vec3 scriptCol(float y) {
  vec3 c = uBandCols[0];
  for (int i = 0; i < ${BAND_COUNT - 2}; i++) {
    vec4 a = uBands[i];
    vec4 b = uBands[i + 1];
    // (E283) the intervals only touch at their ends, where both give the same colour: the first match is the answer
    if (y <= a.x && y >= b.x) { c = mix(uBandCols[i + 1], uBandCols[i], (y - b.x) / max(a.x - b.x, 1.0)); if (uBandWin.z > 0.5) break; }
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
  float yLo = min(uCam.y, wp.y), yHi = max(uCam.y, wp.y);
  // (E283) the band window (Shared.bandWindow): start at the first band this ray can reach, stop at the first its far
  // end cannot (every later one is further from the eye still); off, every band in order as before
  bool bw = uBandWin.z > 0.5;
  int kS = bw ? int(dy < 0.0 ? uBandWin.x : uBandWin.y) : (dy < 0.0 ? 0 : ${BAND_COUNT - 1});
  int kD = dy < 0.0 ? 1 : -1;
  for (int i = 0; i < ${BAND_COUNT}; i++) {
    int k = kS + kD * i;
    if (k < 0 || k > ${BAND_COUNT - 1}) break;
    vec4 b = uBands[k];
    if (bw && (dy < 0.0 ? wp.y > b.x + 3.0 * b.y : wp.y < b.x - 3.0 * b.y)) break;
    if (b.z <= 0.0) continue;
    // (render, the phone's cost) a band the ray never comes within 3 widths of holds < 0.5 % of its depth: skip its
    // tanh / cosh and billow noise — from the square only one or two of the nine are ever in reach
    if (yLo > b.x + 3.0 * b.y || yHi < b.x - 3.0 * b.y) continue;
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
    // (round 14, dome D2) clear air round the eye wherever it is: inside a band (gliding down the Well) the galleries
    // 10 m away stay crisp. (F5, the Well's strata) a band's w is its puff: 0 the soft billow, 1 clouds — dense puffs
    // with clear holes between them, so a stratum reads as cloud lying across the shaft, not a veil over everything
    // (round 2) the cloud strata's puffs: × uPuff.x, their holes sharpened by uPuff.y — dense cloud lying across the shaft
    // between two levels with clear holes onto the next, so each level separates from the next (mockup D)
    tau *= mix(0.35 + 1.3 * bil, (0.03 + 2.8 * pow(bil, uPuff.y)) * uPuff.x, b.w) * scale * smoothstep(4.0, 22.0, L);
    float a = 1.0 - exp(-tau);
    acc += T * a * uBandCols[k] * (1.1 - 0.34 * smoothstep(0.4, 1.0, bil));
    T *= 1.0 - a;
  }
  // the base air thins above the square's datum and thickens down the Well (read at the ray's mid height): the
  // aerials see lamp-lit depth, the shaft fills with silk. Looking up (from inside the Well) the ray is read nearer
  // its top: the shaft opens toward the lit sky instead of greying out
  float hy = dy > 0.0 ? mix(midY, max(uCam.y, wp.y), 0.8) : midY;
  float hk = hy < @{y0}.0 ? min(exp((@{y0}.0 - hy) / uFogDeep.y), uFogDeep.x) : max(exp(-(hy - @{y0}.0) / uFogDeep.z), uFogDeep.w);
  float a0 = 1.0 - exp(-uFogBase * hk * max(L - uFogStart, 0.0) * scale);
  vec3 baseC = mix(uFogBaseCol, scriptCol(wp.y), clamp((uCam.y - wp.y) / 150.0, 0.0, 1.0));
  baseC = mix(baseC, uDeepAir.rgb, uDeepAir.w * clamp((@{y0}.0 - min(wp.y, uCam.y)) / 60.0, 0.0, 1.0));
  acc += T * a0 * baseC;
  T *= 1.0 - a0;
  // (round 2) the deep air: the part of the ray below yd, its density ramping in with its mean depth under yd
  if (uDeepAir2.x > 0.0) {
    float yd = @{y0}.0 - uDeepAir2.y;
    float y0 = uCam.y, y1 = wp.y;
    float fb = y0 < yd && y1 < yd ? 1.0 : (y0 >= yd && y1 >= yd ? 0.0 : (yd - min(y0, y1)) / max(abs(y1 - y0), 1e-3));
    if (fb > 0.0) {
      float hm = yd - 0.5 * (min(min(y0, y1), yd) + min(max(y0, y1), yd));
      float tauD = uDeepAir2.x * clamp(hm / uDeepAir2.z, 0.0, 1.0) * fb * L * scale * smoothstep(4.0, 22.0, L);
      float aD = 1.0 - exp(-tauD);
      acc += T * aD * uDeepAir.rgb;
      T *= 1.0 - aD;
    }
  }
  // the Well's own silk: the stretch of the ray inside the shaft (a slab test on its box). Round 14 (the layered Well):
  // its density grows with the depth h under the rim (or under the eye, whichever is lower: the mist lies below you) as
  // σ(h) = a·h + b·h², integrated exactly along the straight stretch (h is linear in it): clear for the first ~30 m,
  // looking straight down 50 m keeps ~75 % of the light, 100 m ~30 %, and below ~150 m everything dissolves into silk.
  // (It was a flat 0.085 /m from 25 m down: a white slab under the first crossing.)
  // (F5 / F4, the Well from the rim) two more terms. The depth silk is lighter (uShaftK.x 0.085 → 0.05: D2's finding,
  // 50–90 m down the old curve erased every level) and the strata's cloud bands (BANDS, puff) carry the steps instead.
  // And aerial perspective ALONG the canyon: z per metre on the ray's stretch inside the shaft's footprint up to w m over
  // the rim, weighted to level rays ((1 − |dy|)², so looking down stays clear) and after the first uFogStart metres —
  // mockup B's crossings step paler rung by rung into the run north, the far end lost in the silk.
  // (E283) a ray with both ends on one side of the shaft's footprint (west, east, north or south of it) cannot cross the
  // shaft: the slab test below would find nothing; skip it (with the band window: uBandWin.z)
  bool shaftMiss = uBandWin.z > 0.5 && (max(uCam.x, wp.x) < uShaft.x || min(uCam.x, wp.x) > uShaft.z || max(uCam.z, wp.z) < uShaft.y || min(uCam.z, wp.z) > uShaft.w);
  if ((uShaftK.x > 0.0 || uShaftK.z > 0.0) && L > 1e-3 && !shaftMiss) {
    vec3 dn = d / L;
    vec3 inv = vec3(abs(dn.x) > 1e-5 ? 1.0 / dn.x : 1e5, abs(dn.y) > 1e-5 ? 1.0 / dn.y : 1e5, abs(dn.z) > 1e-5 ? 1.0 / dn.z : 1e5);
    vec3 t0 = (vec3(uShaft.x, -260.0, uShaft.y) - uCam) * inv, t1 = (vec3(uShaft.z, uShaftK.y + uShaftK.w, uShaft.w) - uCam) * inv;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float ta = max(max(tn.x, tn.y), max(tn.z, 0.0)), tb = min(min(tf.x, tf.y), min(tf.z, L));
    if (tb > ta) {
      // the depth silk lies below the rim: the part of [ta, tb] under it
      float tr = abs(dn.y) > 1e-5 ? (uShaftK.y - uCam.y) / dn.y : (uCam.y < uShaftK.y ? 1e9 : -1e9);
      float da = dn.y < 0.0 ? max(ta, tr) : ta, db = dn.y < 0.0 ? tb : min(tb, tr);
      float tauS = 0.0;
      if (db > da) {
        float ref = min(uShaftK.y, uCam.y);
        float ha = max(ref - (uCam.y + dn.y * da), 0.0), hb = max(ref - (uCam.y + dn.y * db), 0.0);
        float k = uShaftK.x / 0.085; // 0.085 was the tuned profile's density
        tauS = k * (db - da) * (1.87e-4 * 0.5 * (ha + hb) + 8.0e-7 * (ha * ha + ha * hb + hb * hb) / 3.0);
      }
      float lv = 1.0 - abs(dn.y);
      tauS += uShaftK.z * max(tb - max(ta, uFogStart), 0.0) * lv * lv;
      tauS *= scale * smoothstep(4.0, 22.0, L);
      float as = 1.0 - exp(-tauS);
      float my = uCam.y + dn.y * 0.5 * (ta + tb);
      vec3 sc = scriptCol(min(my, uShaftK.y));
      vec3 shC = mix(mix(uFogBaseCol * 1.12, sc, 0.45), sc * 1.08, uShaftLit);
      acc += T * as * mix(shC, uDeepAir.rgb, uDeepAir.w * clamp((uShaftK.y - min(my, uCam.y)) / 60.0, 0.0, 1.0));
      T *= 1.0 - as;
    }
  }
  return vec4(acc, T);
}
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
uniform float uFlagJoint;
// (needs PAINT_GLSL before it: the layout is paint.ts FLAG, shared with the paint's per-stone windows)
// (render) stoneFw: the same with the pixel footprint passed in (a caller that discards first takes its derivatives
// while the whole quad is still alive)
vec4 stoneFw(vec2 p, float px, vec2 fwIn) {
  vec4 fc = flagCell(p);
  float cx = fc.x, r = fc.y;
  float L = flagLen(r), rh = @{flagRh};
  float fx = fc.z / L, fy = fc.w / rh;
  vec2 fw = max(fwIn, vec2(1e-5));
  vec2 lw = max(min(fw * px, vec2(0.012)), vec2(uFlagJoint));
  float jx = 1.0 - smoothstep(lw.x, lw.x + fw.x, min(fx, 1.0 - fx) * L);
  float jy = 1.0 - smoothstep(lw.y, lw.y + fw.y, min(fy, 1.0 - fy) * rh);
  float joint = max(jx * smoothstep(4.0, 9.0, L / fw.x), jy * smoothstep(4.0, 9.0, rh / fw.y));
  float id = h12(vec2(cx, r));
  float puddle = smoothstep(0.42, 0.72, vnoise(p * 0.21 + 3.0) * 0.6 + vnoise(p * 0.83) * 0.4);
  return vec4(joint, id, puddle, h12(vec2(cx, r) + 17.0) * 2.0 - 1.0);
}
vec4 stone(vec2 p, float px) { return stoneFw(p, px, fwidth(p)); }
`;

export const VS_JIEHUA = /* glsl */ `
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
uniform vec3 uRootAt;
void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  // the world's own frame (uRootAt: SHARED_UNIFORMS)
  m[3].xyz -= uRootAt;
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
  vec4 vp = viewMatrix * vec4(wp.xyz + uRootAt, 1.0);
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

export const FS_JIEHUA = /* glsl */ `
uniform float uTime;
uniform float uNear;
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
uniform vec4 uGlint;
uniform float uAccentFog;
uniform vec4 uFlag;
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
@{paint}
${STONES_GLSL}
@{lightvol}
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
  // (E283, Jake's pick: stone & wall detail near only) the far LOD: the painted grain, the stains and mottle, the silk
  // weave, the paper's grain on the fog and the lamplight's gloss / rim fade out from JLOD.near to JLOD.far m and are not
  // computed past it — detail the silk has mostly swallowed by then. 1 = far
  float jl = smoothstep(${JLOD.near.toFixed(1)}, ${JLOD.far.toFixed(1)}, dist);
  pk *= 1.0 - jl;
  // (render) the silk fog once per pixel: the wet ground's two sheen terms read its colour from it (fogCol() re-ran the
  // 9-band march twice more on every ground pixel)
  vec4 fgc = silkFog(vWorld, uFogScale);
  vec3 fogHere = fgc.rgb / max(1.0 - fgc.a, 1e-3);

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
  float wet = vMisc.z * (1.0 - uDry);
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
    kf = max(kf, pk * uPaintK.y * uFlag.w);
    col = base * (1.0 - 0.6 * uFlag.x + uFlag.x * st.y) * (1.0 - 0.5 * uFlag.y + uFlag.y * speck) * pInk(mix(vec3(1.0), pf.rgb, kf), uPaintInk);
    float wAmt = wet * mix(0.55, 1.0, wLoc);
    wetPool = wAmt * (1.0 - st.x);
    // (render, E281) wet granite at blue hour is dark slate: the lights live in its reflections, not in its wash
    col *= 1.0 - 0.6 * wAmt;
    float ndv = clamp(V.y, 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(clamp(1.0 - ndv, 0.0, 1.0), 5.0);
    emit += fogHere * fres * wAmt * uWetSky.x * (1.0 - st.x);
    // (lab P6) + the water film's reflection of the blue-hour sky: fogCol() is ~black inside the first 16 m of clear
    // air, so the near ground never got a sheen; a broader lobe than Schlick; uLpSky 0 = off
    emit += uFogBaseCol * (0.35 + 0.65 * pow(clamp(1.0 - ndv, 0.0, 1.0), 3.0)) * wAmt * uLpSky * (1.0 - st.x);
    vec2 rc = floor(p / 1.1);
    float rp2 = fract(uTime * 0.7 + h12(rc + 5.0));
    vec2 ctr = (rc + 0.2 + 0.6 * vec2(h12(rc + 1.0), h12(rc + 2.0))) * 1.1;
    float rd = abs(length(p - ctr) - rp2 * 0.3);
    float fwr = max(fwidth(rd), 1e-5);
    float ring = (1.0 - smoothstep(0.004, 0.004 + fwr * 1.2, rd)) * (1.0 - rp2) * wAmt * (1.0 - smoothstep(0.01, 0.03, fwr));
    emit += fogHere * ring * 0.35;
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
  if (jl < 1.0) {
    float nk = 1.0 - jl;
    float stainN = vnoise(vec2(q.x * 1.1 + vPat.w * 7.0, q.y * 0.045)) * 0.7 + vnoise(vec2(q.x * 3.1, q.y * 0.11 + 5.0)) * 0.3;
    shaded *= 1.0 - uStain * vert * smoothstep(0.35, 0.8, stainN) * nk;
    float mot = vnoise(q * 0.45 + vPat.w) * 0.6 + vnoise(q * 1.7) * 0.4;
    shaded *= 1.0 + uMottle * (mot - 0.5) * (kind == 9.0 ? 2.2 : 1.0) * nk;
    if (kind == 9.0) shaded *= 1.0 + (0.07 * (vnoise(q * 7.0 + vPat.w) - 0.5) + 0.05 * (vnoise(q * 23.0) - 0.5) * (1.0 - smoothstep(0.005, 0.02, gq))) * nk;
  }
  // rain-wet stone and decks (vMisc.z): darker, the tops most (the flagstones do their own wet in kind 3)
  if (kind != 3.0 && wet > 0.0) {
    float top = step(0.6, n.y);
    shaded *= (1.0 - wet * mix(0.6, 0.9, top)) * mix(vec3(1.0), vec3(0.88, 0.95, 1.1), wet);
    shaded += uFogBaseCol * uWetSky.y * wet * top * (0.6 + 0.4 * vnoise(vWorld.xz * 1.7));
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
  float gk = kind == 3.0 ? 2.0 : 1.0;
  if (jl < 1.0) {
    float weave = mix(texture(uSilk, wq / s0).r, texture(uSilk, wq / (s0 * 2.0) + 0.37).r, fo);
    float gran = mix(vnoise(wq / (s0 * 0.16)), vnoise(wq / (s0 * 0.32) + 3.1), fo);
    shaded *= 1.0 + ((weave - 0.5) * uWeave * 2.0 + (gran - 0.5) * uWeave * 1.6) * gk * (1.0 - jl);
  }
  // neon spill, baked per vertex at build time (emitters.ts)
  // (capped: the sign masts on the balustrade must not bleach the stone; wet stone shows it as a darker sheen)
  // (lab P6) the blue-hour ambient scales the wash only (spill, pools, emitters and ink keep their value)
  shaded *= uLpAmb;
  // (render, E281 round 2: mockup D) the Well's levels sink into shadow going down — the sky light falls off in the shaft
  // under the square, the washes darken and cool, and only their own lights (windows, lanterns, neon: the emitters,
  // unscaled) stay bright: level after level of lit galleries over deep blue. Not on the viewmodel (uFogScale 0)
  float dk = smoothstep(@{y0}.0 - uDeepAmb.y, @{y0}.0 - uDeepAmb.z, vWorld.y) * step(0.5, uFogScale);
  shaded *= mix(vec3(1.0), vec3(0.78, 0.88, 1.12) * uDeepAmb.x, (1.0 - dk) * uDeepAmb.w);
  // (round 14, dome B: the paifang's lacquer read #d95d46 against style-A's #904536 — its lanterns' spill and pools
  // lit the cinnabar pale) the accent surfaces take 40 % of the spill and the pools' diffuse; their gloss glint stays
  float lacq = mix(1.0, 0.4, accent);
  shaded += col * min(vSpill, vec3(0.7)) * 1.3 * (kind == 3.0 ? 1.0 : 1.0 - 0.5 * wet) * lacq;
  // (lab P6) the warm pools: diffuse on the wash; on wet stone a broad glossy sheen of the same light
  vec3 lp = poolLight(vWorld, n);
  // (a wet film reflects rather than scatters: on the wet flagstones the pool's diffuse share drops, its gloss —
  // the lobe below — carries the light, so the ground stays dark and glossy)
  shaded += poolAlbedo(col) * lp * uLpGain.x * (1.0 - 0.85 * wetPool) * lacq;
  // (round 14: a wet tread seen from above read beige-lit) the flat sheen is a grazing-angle thing: looking down, wet
  // stone stays dark and only the gloss lobe below shows the lights
  emit += lp * wetPool * uLpGain.y * (0.08 + 0.92 * pow(clamp(1.0 - abs(V.y), 0.0, 1.0), 2.0));
  // (render, E281) the warm pools: in front of a lit shop, a stall or under a lamp the wet stone carries the light's own
  // amber as a soft glow (lpAmberness: the lanterns' red and the neon stay out, so the gate's floor does not go salmon)
  // (round 2: spread over a landing ringed with shops it painted the whole wet floor salmon, C2·4) only the bright core of
  // the pool, close to its light: the split streak cards (streaks.ts) carry the long runs
  emit += lp * lpAmb * smoothstep(0.35, 1.0, max(lp.r, max(lp.g, lp.b))) * max(wetPool, wet * 0.5) * step(0.6, n.y) * uLpAmber.y;
  // (render, E281) the wet treads' glints: a step's tread (a narrow wet top, under 0.6 m deep) catches light along its
  // long edges — the nosing, and the wet inside corner — just inside the ruled ground line: broken cells of light that
  // twinkle, the lamps' and the sky's reflection; far off they average into one bright line
  // Looking up a flight the treads hide behind their risers: a riser's top edge (a low, long wet face, v up) is the
  // nosing seen from below and takes the same glints
  bool tread = n.y > 0.9 && min(sz.x, sz.y) < 0.6;
  bool riser = abs(n.y) < 0.3 && sz.y < 0.5 && sz.x > 2.0 * sz.y;
  if (uGlint.x > 0.0 && wet > 0.3 && (tread || riser)) {
    bool acrossU = tread && sz.x < sz.y;
    float dE = riser ? dpx.w : (acrossU ? min(dpx.x, dpx.y) : min(dpx.z, dpx.w));
    float along = acrossU ? uv.y : uv.x;
    float ga = acrossU ? gv : gu;
    float edgeW = Wg * 0.5;
    float band = smoothstep(edgeW - 0.5, edgeW + 0.5, dE) * (1.0 - smoothstep(edgeW + 1.5, edgeW + 3.0, dE));
    float cellL = uGlint.w;
    float gc = floor(along / cellL);
    float hc = h12(vec2(gc, vPat.w * 7.0 + floor(vWorld.y * 5.0) + floor((acrossU ? vWorld.x : vWorld.z) * 3.0)));
    float tw = 0.55 + 0.45 * sin(uTime * (1.5 + 3.0 * hc) + hc * 40.0);
    float spark = step(1.0 - uGlint.y, hc) * tw * (1.0 - smoothstep(0.2, 0.45, abs(fract(along / cellL) - 0.5)));
    float gk = mix(uGlint.y * 0.45, spark, smoothstep(0.7, 2.5, cellL / max(ga, 1e-5))) * band;
    vec3 Rg = reflect(-V, n);
    emit += (lpRaw(vWorld + Rg * 1.5) * 1.5 + uFogBaseCol * 0.45 + min(vSpill, vec3(1.0)) * uGlint.z) * gk * uGlint.x * wet;
  }
  // (render) the lamplight's glossy lobe (lightvol.ts poolSpec): lacquer and gilt glint, wet stone and decks shine
  // toward the lanterns; Schlick on the film, a lacquer's own sheen a little broader
  {
    vec3 Rr = reflect(-V, n);
    float cv = clamp(dot(n, V), 0.0, 1.0);
    float fr = 0.04 + 0.96 * pow(1.0 - cv, 5.0);
    // (the lacquer's lobe is Fresnel-only: its flat 6 % base lit the whole paifang from its own lanterns — dome B)
    float gk = max(gloss * 0.45 * fr, max(wetPool, wet * 0.5 * step(0.6, n.y)) * fr);
    if (jl < 1.0) {
      if (gk > 0.002) emit += poolSpec(vWorld, Rr) * gk * (1.0 - jl);
      // the rim: edges turned from the eye catch what is lit behind them (wetter edges, a brighter rim)
      emit += poolRim(vWorld, n, V) * (0.6 + 0.4 * max(gloss, wet)) * lacq * (1.0 - jl);
    }
  }
  // the colour script: the deep strata sink into indigo paper (their windows gold)
  float lumC = lum(shaded);
  float deep = (1.0 - smoothstep(-150.0, 70.0, vWorld.y)) * 0.9;
  vec3 deepC = mix(uPaperDeep, uPaper, clamp(lumC * 1.6, 0.0, 1.0)) * mix(0.8, 1.2, lit);
  shaded = mix(shaded, mix(deepC, shaded * 0.5, accent * 0.6), deep * 0.85);
  col = shaded;
  emit = mix(emit, uSutraWin * dot(emit, vec3(0.33)), deep * 0.7);
  if (gloss > 0.5) {
    vec3 R = reflect(-V, n);
    float s = max(dot(R, normalize(uLightDir + vec3(-0.3, 0.2, 0.5))), 0.0);
    col += (smoothstep(0.88, 0.92, s) * 0.8 + smoothstep(0.25, 0.95, s) * 0.15) * vec3(1.0, 0.94, 0.78);
  }

  // ── ink: 焦墨 near → 淡墨 by uInkMid → dissolved by uLineFade.y; silver at the Rail Cut hinge, gold below it,
  // gold on the hooks ──
  float yy = vWorld.y;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  inkC = mix(inkC, uSilver, 1.0 - smoothstep(-80.0, -40.0, yy));
  inkC = mix(inkC, uGold, 1.0 - smoothstep(-160.0, -120.0, yy));
  vec3 goldC = mix(uGold * 1.35, uGoldDim, smoothstep(8.0, 150.0, dist));
  vec3 lineC = mix(inkC, goldC, goldL);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  float li = clamp(lines, 0.0, 1.0) * fade * pow(max(fgc.a, 1e-4), uLineFog - 1.0);
  col = mix(col, lineC, mix(li, fade, forceInk));
  emit += goldL * li * uGold * 0.8;
  emit += li * uGold * 0.9 * (1.0 - smoothstep(-120.0, -20.0, yy));

  vec3 fogC = fgc.rgb * (jl < 1.0 ? mix(silkPaper(gl_FragCoord.xy), 1.0, jl) : 1.0);
  // (round 14) a light punches through the silk further than the wash it sits on (√T, as the facade windows do):
  // the lanterns and lit shops of the lower strata glow through the bands
  // (render, E281) the mineral accents (the paifang's cinnabar, the malachite roofs) hold their colour through the silk
  // like a pigment on the scroll: they take T^uAccentFog of the fog, the silk's inscatter scaled to match
  float Ta = pow(max(fgc.a, 1e-4), mix(1.0, uAccentFog, accent));
  vec3 outc = col * Ta + fogC * ((1.0 - Ta) / max(1.0 - fgc.a, 1e-4)) + emit * pow(max(fgc.a, 1e-4), ${EMIT_FOG});
  // alpha = normalised inverse view depth: the MSAA resolve averages it, the post silhouette reads it
  gl_FragColor = vec4(outc, uNear / max(vViewZ, uNear));
}
`;

/** every program's row */
export const PROGRAMS = {
  jiehua: { vertex: VS_JIEHUA, fragment: FS_JIEHUA, vertexColors: true, uniforms: { uFogScale: 1 } },
} as const satisfies Readonly<Record<string, ShaderProgramRow>>;

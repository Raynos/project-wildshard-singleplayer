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
import type { UniformRows } from '@wildshard/game/plugin/shaderFamily';

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


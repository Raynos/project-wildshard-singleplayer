// The final Effect still uses the silk-fog splice; all material draws use graphs.
const BAND_COUNT = 11;

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

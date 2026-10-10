// Nine Dragon's light (the light lab's P6, merged into the clean room) as data (SHARD-PLATFORM M3, look-family rows):
// the light volume's uniforms as rows and its GLSL (spliced into the world programs, `@{lightvol}`), the window glow's
// uniforms and GLSL (the bleed pyramid's prefilter and the composite), the grade's GLSL, the pools' and halos' tuning,
// the phone's halo program and the lab's settings. look/light/* bakes the volume, gathers the pools, builds the halos and
// installs the light; the lab's notes are there.
import type { ShaderProgramRow, UniformRows } from '@wildshard/sdk/looks/shaderFamily';
import { EMIT_FOG, FOG_GLSL } from './look';

// ── the light volume (look/light/lightvol.ts) ──
/** E is stored as √(E / MAX): MAX is the brightest irradiance the volume holds */
export const LP_MAX = 12;

/** the light volume's uniforms as rows (look/light/lightvol.ts adds its two textures, uLpVolA / uLpVolB) */
export const LIGHTVOL_UNIFORMS = {
  uLpMinA: { v3: [0, 0, 0] }, uLpInvA: { v3: [0, 0, 0] },
  uLpMinB: { v3: [0, 0, 0] }, uLpInvB: { v3: [0, 0, 0] },
  /** x: diffuse gain on the wash, y: wet sheen gain, z: underside keep (0 = light from above never reaches an underside), w: on / off */
  uLpGain: { v4: [1.0, 0.5, 0.35, 1] },
  /** the wet film's reflection of the blue-hour sky, added to the clean room's own fresnel term (0 = off): the
   *  targets' wet ground is a lit blue-grey (L* 33 at the FP frames) */
  uLpSky: 0,
  /** the blue-hour AMBIENT: the sky light on every non-emissive wash (1 = the clean room). Emitters, pools and ink
   *  are not scaled, so a lower ambient makes the lights read as light */
  uLpAmb: 1,
  /** (render) the lamplight's glossy lobe: the light field read along the reflection (x gain, y / z the two read
   *  distances, m) on lacquer, wet stone and wet decks; w: how far the diffuse pool keeps its warmth off a grey wash
   *  (0 = albedo × light as the clean room, 1 = the light's own colour at the wash's brightness) */
  uLpSpec: { v4: [1, 0.9, 2.6, 0.45] },
  /** (render) the rim: an edge turned away from the eye catches the light BEHIND it (x gain, y how far behind, m,
   *  z the rim's power) — the crowd against the lit stall, the posts against the lanterns, wet lips against neon */
  uLpRim: { v4: [0.8, 1.2, 3, 0] },
  /** (render, E281) the pools' knee: E → E² / (E + x) + … so the faint field every lantern of the square adds up to
   *  (the median cell holds ~0.1: a flat salmon wash on the whole floor) drops away and the pools read as pools round
   *  their lights; y: how much of the rim an up-facing surface keeps (a floor's "rim" was the field under it, a warm
   *  band toward the horizon); z: how much of the diffuse pool an up-facing surface keeps (wet stone under a cluster of
   *  lanterns shows them as reflections — the streaks, the gloss lobe — not as a salmon fill: the gate's floor); w: the
   *  soft ceiling (lpKnee) */
  uLpCut: { v4: [0.4, 0.15, 0.3, 0.8] },
  /** (render, E281) warm pools on the wet floor. The floor keeps only uLpCut.z of the pools (the lanterns' red-orange
   *  field washed the gate's floor salmon), but the lit shops', stalls' and lamps' amber light (g / r ≥ z…w: a lantern's
   *  pool sits at ~0.25, a shop's at ~0.47) lies on the stone in front of them: x the floor's keep of amber light, y a
   *  warm sheen of it on wet stone (the light's own colour, not the dark wet albedo × it) */
  uLpAmber: { v4: [0.8, 1.4, 0.28, 0.42] },
} as const satisfies UniformRows;

/**
 * poolLight(wp, n): the baked irradiance at a world point, shaped by the surface normal. `a` holds where the light
 * comes from (0 = below, 0.5 = level, 1 = above): a floor under a lantern takes all of it, a wall facing it most, an
 * underside only uLpGain.z of the light that comes from above (an awning over a lit shop still glows from below).
 */
export const LIGHTVOL_GLSL = /* glsl */ `
uniform highp sampler3D uLpVolA;
uniform highp sampler3D uLpVolB;
uniform vec3 uLpMinA;
uniform vec3 uLpInvA;
uniform vec3 uLpMinB;
uniform vec3 uLpInvB;
uniform vec4 uLpGain;
uniform float uLpSky;
uniform float uLpAmb;
uniform vec4 uLpSpec;
uniform vec4 uLpRim;
uniform vec4 uLpCut;
uniform vec4 uLpAmber;
// (render, E281) how amber a light is (a shop's, a lamp's: 1; a lantern's red-orange, the neon: 0), judged on the raw
// irradiance (the knee shifts the ratio); poolLight leaves the last read's in lpAmb
float lpAmberness(vec3 E) { return smoothstep(uLpAmber.z, uLpAmber.w, E.g / max(E.r, 1e-4)) * step(E.b, E.g); }
float lpAmb = 0.0;
// (render, E281) the knee: E² / (E + k) keeps a lantern's pool (E ≫ k) and drops the faint field between them
vec3 lpKnee(vec3 E) {
  if (uLpCut.x > 0.0) E = E * E / (E + vec3(uLpCut.x));
  // w: a soft ceiling (E / (1 + E / w)): under the gate's ~20 lanterns every face went one flat orange
  if (uLpCut.w > 0.0) E = E / (1.0 + max(E.r, max(E.g, E.b)) / uLpCut.w);
  return E;
}
vec4 lpSample(highp sampler3D v, vec3 wp, vec3 mn, vec3 iv) {
  vec3 t = (wp - mn) * iv;
  if (any(lessThan(t, vec3(0.0))) || any(greaterThan(t, vec3(1.0)))) return vec4(0.0, 0.0, 0.0, 0.5);
  return texture(v, t);
}
vec3 poolLight(vec3 wp, vec3 n) {
  if (uLpGain.w < 0.5) return vec3(0.0);
  vec4 s = wp.y > uLpMinA.y ? lpSample(uLpVolA, wp, uLpMinA, uLpInvA) : lpSample(uLpVolB, wp, uLpMinB, uLpInvB);
  vec3 E0 = s.rgb * s.rgb * ${LP_MAX.toFixed(1)};
  lpAmb = lpAmberness(E0);
  vec3 E = lpKnee(E0);
  float fromUp = s.a * 2.0 - 1.0;
  // facing: the light's mean direction is mostly vertical (up / down) with a level share; walls take the level share
  float fUp = max(fromUp, 0.0), fDown = max(-fromUp, 0.0), fLevel = 1.0 - abs(fromUp);
  float face = fUp * mix(uLpGain.z, 1.0, clamp(n.y * 0.5 + 0.5, 0.0, 1.0))
             + fDown * clamp(0.6 - n.y * 0.6, 0.15, 1.0)
             + fLevel * (abs(n.y) < 0.5 ? 1.0 : 0.85);
  float keep = mix(uLpCut.z, max(uLpCut.z, uLpAmber.x), lpAmb);
  return E * face * mix(1.0, keep, smoothstep(0.5, 0.9, n.y));
}
// (render) the raw irradiance at a point (no facing): what a glossy surface sees of the pools along its reflection
vec3 lpRaw(vec3 wp) {
  vec4 s = wp.y > uLpMinA.y ? lpSample(uLpVolA, wp, uLpMinA, uLpInvA) : lpSample(uLpVolB, wp, uLpMinB, uLpInvB);
  return lpKnee(s.rgb * s.rgb * ${LP_MAX.toFixed(1)});
}
// (render) the lamplight's glossy lobe: the light field read at two points along the reflection vector R. A lantern
// above a wet flagstone lights the stone's sheen where the reflection points at it (the view-dependent specular the
// diffuse pool lacks); on the paifang's lacquer the lanterns in front of it glint along its posts and beams
vec3 poolSpec(vec3 wp, vec3 R) {
  if (uLpGain.w < 0.5 || uLpSpec.x <= 0.0) return vec3(0.0);
  return (lpRaw(wp + R * uLpSpec.y) * 0.6 + lpRaw(wp + R * uLpSpec.z) * 0.4) * uLpSpec.x;
}
// (render) the rim light: at a grazing edge the light field just behind the surface (away from the eye) wraps it
vec3 poolRim(vec3 wp, vec3 n, vec3 V) {
  if (uLpGain.w < 0.5 || uLpRim.x <= 0.0) return vec3(0.0);
  float e = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), uLpRim.z);
  if (e < 0.01) return vec3(0.0);
  return lpRaw(wp - V * uLpRim.y + n * 0.2) * e * uLpRim.x * mix(1.0, uLpCut.y, smoothstep(0.5, 0.9, n.y));
}
// (render) the diffuse pool's albedo: the wash's colour pulled toward its own brightness so a warm light on grey stone
// reads warm (albedo × amber on a blue-grey wash was a dull brown)
vec3 poolAlbedo(vec3 col) {
  float mx = max(col.r, max(col.g, col.b)), sat = (mx - min(col.r, min(col.g, col.b))) / max(mx, 1e-4);
  // only the grey washes: a lacquer's red stays its own deep red under the lanterns
  return mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))) * 1.15, uLpSpec.w * (1.0 - smoothstep(0.2, 0.5, sat)));
}
`;

// ── the window glow (look/light/glow.ts): it rides in the bleed pyramid's alpha ──
export const GLOW_UNIFORMS = {
  /** x: source gain, y: threshold on the brightest channel, z / w: distance ramp (m) where the glow starts / is full
   *  (the lab's pick: 0.22, 6, 40 — lab.ts DEFAULTS) */
  uGlow: { v4: [1, 0.22, 6, 40] },
  /** x: halo (the ¼-res mip), y: veil (the summed pyramid), z: near cut (m), w: on / off (the pick: 0.6, 0.15) */
  uGlow2: { v4: [0.6, 0.15, 10, 1] },
  uGlowCol: { rgb: 0xffa45c },
} as const satisfies UniformRows;

/** in the prefilter: `float glowSrc(vec4 s, float near)` for one tap (rgb HDR, a = near / viewZ) */
export const GLOW_PRE_GLSL = /* glsl */ `
uniform vec4 uGlow;
uniform vec4 uGlow2;
float glowSrc(vec4 s, float near) {
  if (uGlow2.w < 0.5 || s.a <= 1e-6) return 0.0;
  float z = near / s.a;
  float far = smoothstep(uGlow.z, uGlow.w, z);
  float mx = max(s.r, max(s.g, s.b));
  // amber only: a lit room's g / r sits at ~0.55–0.85; cinnabar, lanterns and red / pink neon sit under ~0.45 and
  // keep their own RGB bloom (the paifang must not smoke orange)
  float gr = s.g / max(s.r, 1e-4);
  float amber = smoothstep(0.42, 0.56, gr) * (1.0 - smoothstep(0.9, 1.0, gr));
  float warm = clamp(((s.r - s.b) / max(s.r, 1e-4)) * 1.7 - 0.35, 0.0, 1.0) * amber;
  return min(max(mx - uGlow.y, 0.0), 2.0) * warm * far * uGlow.x;
}
`;

/** in the composite: `vec3 glowAdd(float tightA, float wideA, float zPixel)` */
export const GLOW_COMP_GLSL = /* glsl */ `
uniform vec4 uGlow2;
uniform vec3 uGlowCol;
vec3 glowAdd(float tightA, float wideA, float zPixel) {
  if (uGlow2.w < 0.5) return vec3(0.0);
  float keep = smoothstep(uGlow2.z * 0.6, uGlow2.z, zPixel);
  return uGlowCol * (tightA * uGlow2.x + wideA * uGlow2.y) * keep;
}
`;

// ── the grade (look/light/grade.ts) ──
/** the composite's last colour step: `vec3 gradeLut(vec3 srgb)`, one trilinear fetch of the learned LUT; `@{lutScale}` /
 *  `@{lutBias}` are the LUT size's texel-centre mapping (look/light/grade.ts) */
export const GRADE_GLSL = /* glsl */ `
uniform highp sampler3D uLut;
uniform float uLutAmt;
vec3 gradeLut(vec3 srgb) {
  if (uLutAmt <= 0.0) return srgb;
  vec3 g = texture(uLut, clamp(srgb, 0.0, 1.0) * @{lutScale} + @{lutBias}).rgb;
  return mix(srgb, g, uLutAmt);
}
`;

/**
 * The blue-hour ramp, tuned on the round-8 loop-2 clean room (whose LOOKS.jiehua sky read #707c93 against the targets'
 * #7d93af, ΔE 8.4 → 1.1 with this ramp): a lighter, bluer zenith and horizon, a denser, darker blue fog, and the Well's
 * +101 / +36 m bands darkened so the shaft reads deep. HEAD 3c39b36f retuned LOOKS.jiehua itself (sky ΔE 1.6 with its
 * height fog), so the lab leaves this OFF there (`sky: 0`); keep it for a look that has not been retuned.
 */
export interface SkyRamp { fog: number; fogDensity: number; skyTop: number; skyHorizon: number; bands: readonly number[] }
export const BLUE_HOUR: SkyRamp = {
  fog: 0x7585a0,
  fogDensity: 0.009,
  skyTop: 0x7890ae,
  skyHorizon: 0x98acc0,
  /** the four top fog bands (+212, +152, +101, +36 m): the +101 band sits under the square and was a pale #c4c7cc */
  bands: [0xb8c4d4, 0xa3afc1, 0x56617a, 0x4a5670],
};

// ── the light pools (look/light/pools.ts): colours are hex ──
/** per source kind: strength k, radius r (m, scaled by the source's size where noted), reach in r, colour pull */
export const POOL = {
  /** paper lanterns: the candle light is amber, the paper's red only tints it */
  // (render, round 14: Jake's "warm and deep around the gate" — the lanterns' pools ×1.4 and wider, a deeper amber)
  lantern: { k: 0.5, r: 2.6, cut: 3.0, tint: 0xff9448, redShare: 0.25 },
  /** a lit shop interior (the emitter sits 0.1 m inside the shop's glazing, 1.6 m up) */
  shop: { k: 2.3, rPerW: 0.5, rMin: 2.0, cut: 3.0, out: 0.9, tint: 0xffa850 },
  /** the square's street lamps (a warm sodium head 4.2 m up) */
  lamp: { k: 3.8, r: 3.0, cut: 3.4, tint: 0xffb468 },
  /** neon signs and lightboxes: coloured, weaker, short */
  sign: { k: 0.45, rPerSize: 0.55, rMin: 0.8, cut: 2.4 },
  /** a lit window: warm light on its sill, the balcony floor under it and the wall around it */
  window: { k: 0.2, r: 0.8, cut: 2.4, out: 0.45 },
} as const;

// ── the phone's halos (look/light/halos.ts) ──
/** per source kind: the disc's radius (m; signs: + a share of the board's size) and its gain */
export const HALO = {
  // (round 2 fix: the Well's new lantern rows under ×3 halos read as dozens of soft orange bokeh blobs) a lantern's glow is
  // tight: ~2× its own radius (the body's R 0.27 m at scale 1), not a 1.3 m soft disc
  lantern: { r: 0.5, k: 0.16 },
  lamp: { r: 1.6, k: 0.3 },
  shop: { r: 0.0, rPerW: 0.45, rMin: 1.2, rMax: 2.6, k: 0.07 },
  sign: { r: 0.5, rPerSize: 0.45, k: 0.1 },
} as const;

/** the knobs: x gain, y radius scale, z the near fade's end (m), w the screen-size cap (share of the view's height) */
export const HALO_DEFAULTS = [2, 1.2, 5, 0.12] as const;
/** (E281) the gain per kind: lanterns, lamps, shops, signs */
export const HALO_KIND = [3, 1, 2, 1] as const;
/** (round 2 fix) the distance fade: from x to y m the glow goes to z of its gain and w of its radius */
export const HALO_FAR = [12, 28, 0.12, 0.5] as const;

/** (render) the derivative-free part of NOISE_GLSL (what silkFog needs) for a vertex stage: the halos' and the streak cards' */
export const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const VS_HALO = /* glsl */ `
attribute vec2 aCorner;
attribute vec3 aAt;
attribute vec4 aCol;
attribute float aR;
uniform vec4 uHalo;
uniform vec4 uHaloKind;
uniform vec4 uHaloFar;
${NOISE_VS}
${FOG_GLSL}
varying vec2 vC;
varying vec3 vCol;
void main() {
  vec3 toEye = uCam - aAt;
  float d = length(toEye);
  // with distance the glow shrinks and dims (uHaloFar: from x to y m, to z of its gain and w of its radius): past ~25 m
  // a lantern is its own bright point with at most a faint rim
  float far = smoothstep(uHaloFar.x, uHaloFar.y, length(uCam - aAt));
  float R = aR * uHalo.y * mix(1.0, uHaloFar.w, far);
  // pulled toward the eye by its radius: the wall behind a lantern does not cut the disc
  vec3 c = aAt + toEye / max(d, 1e-3) * min(R, d * 0.5);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  // the screen-size cap: R never spans more than uHalo.w of the view's height (projectionMatrix[1][1] = 1 / tan(fov/2))
  float cap = uHalo.w * 2.0 * max(-mv.z, 0.01) / projectionMatrix[1][1];
  float Rs = min(R, cap);
  mv.xy += aCorner * Rs;
  vC = aCorner;
  float T = silkFog(aAt, 1.0).a;
  // a capped disc keeps its energy per pixel, not its total: a close lantern glows as hard, just not as wide
  // (E281) a gain per kind (aCol.w: 0 lantern, 1 lamp, 2 shop, 3 sign): the lanterns read as lit red globes at 20–40 m
  float kg = aCol.w < 0.5 ? uHaloKind.x : aCol.w < 1.5 ? uHaloKind.y : aCol.w < 2.5 ? uHaloKind.z : uHaloKind.w;
  vCol = aCol.rgb * kg * uHalo.x * mix(1.0, uHaloFar.z, far) * pow(max(T, 1e-4), ${EMIT_FOG}) * smoothstep(1.2, uHalo.z, d) * step(0.0, -mv.z);
  gl_Position = projectionMatrix * mv;
  if (max(vCol.r, max(vCol.g, vCol.b)) < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;


const FS_HALO = /* glsl */ `
varying vec2 vC;
varying vec3 vCol;
void main() {
  float r2 = dot(vC, vC);
  if (r2 >= 1.0) discard;
  // a tight core over a short skirt, zero at the rim
  float a = (exp(-r2 * 9.0) * 0.7 + exp(-r2 * 3.5) * 0.3) * (1.0 - r2);
  gl_FragColor = vec4(vCol * a, 0.0);
}
`;


export const HALO_PROGRAMS = {
  halo: {
    vertex: VS_HALO, fragment: FS_HALO, uniforms: { uHalo: { v4: HALO_DEFAULTS }, uHaloKind: { v4: HALO_KIND }, uHaloFar: { v4: HALO_FAR } },
    transparent: true, depthWrite: false, blend: 'addKeepAlpha',
  },
} as const satisfies Readonly<Record<string, ShaderProgramRow>>;

// ── the lab's settings (look/light/install.ts) ──
export interface LightSettings {
  /** the light volume on / off, its diffuse gain on the wash, the wet stone's glossy sheen of it */
  pools: number;
  poolGain: number;
  sheen: number;
  /** the window glow in the fog (bloom alpha) on / off, its halo / veil gains, threshold and distance ramp (m) */
  glow: number;
  halo: number;
  veil: number;
  glowThr: number;
  glowNear: number;
  glowFar: number;
  /** the learned LUT's strength (0 = off) */
  grade: number;
  /** the wet film's sky reflection on top of the fresnel term (0 = off) */
  wetSky: number;
  /** the blue-hour ambient on every non-emissive wash (1 = none) */
  ambient: number;
}

/** the lab's tuning on the clean room at 3c39b36f (round-9-lab-light/README.md §What won); round 14: the pools are
 *  stronger (pools.ts), so the flat wet sheen 1.0 → 0.55 (the view-dependent lobe, lightvol.ts poolSpec, carries the gloss) */
// (render, E281) the ambient 0.78 → 0.9: the mockups are high key (blue hour, not night). The wet film's sky sheen
// 0.1 → 0.3 (pass 3) → 0.15 (round 2, the stair lane: the landings read pale pink from the sky; the targets' wet stone is
// dark and carries the lights and the neon)
export const LIGHT_DEFAULTS: LightSettings = { pools: 1, poolGain: 1, sheen: 0.55, glow: 1, halo: 0.6, veil: 0.15, glowThr: 0.22, glowNear: 6, glowFar: 40, grade: 1, wetSky: 0.15, ambient: 0.9 };

// refitted on the clean room's own frames after the merge (round 11; LOOK-LOOP.md step 6), not the lab's 3c39b36f fit
export const LUT_URL = '/assets/nine-dragon/grade-lut-cleanroom.bin';

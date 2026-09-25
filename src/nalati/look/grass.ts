/**
 * Look v2 — the grass (port-v2.md step 5; the user: "the grass is not bad"): the clean-room prototype's GPU blade rings
 * and shader flowers, on the engine's own field, wind, trample and senses.
 *
 * Blades carry NO per-blade data: a ring is a grid of world-snapped square tiles round the camera, and a blade's root
 * is `tile origin + (gl_InstanceID's cell) × spacing + hash jitter`. Each ring is ONE instanced draw: the CPU culls the
 * ring's tiles against the frustum every frame and writes the visible tiles' origins into a small float texture; the
 * vertex shader finds its tile as `gl_InstanceID / bladesPerTile`. Three rings, finer near (phone 4 / 8 / 16 m tiles,
 * 0.085 / 0.20 / 0.45 m spacing, 3 / 2 / 1 segments); each ring skips the inner ring's square per blade (the tile
 * straddling it too) and the last ring fades out radially. Flowers are a fourth draw: camera-facing SDF heads
 * (buttercup, daisy, lupine spike, edelweiss) — no texture bytes. The near field (0 – ~3 m, where a blade is a big dark
 * spike on the phone's 94° lens) is a fifth draw: the painted card atlas (GRASS_CARDS) as clumps of 3 crossed quads on a
 * 2 m-tile ring, same field / wind / trample; under it ring 0 keeps only 40 % of its blades (slimmer) and the SDF heads
 * stand down (the cards carry the flowers). Short turf (< ~0.3 m) stays blades.
 *
 * Where it grows and how tall, baked once from the same functions the CPU senses read (so stealth, the wolves and
 * `grassHeightAt` see exactly the grass that is drawn):
 *   tField  the GrassField 4 m lattice itself (height, tone, bloom, drift species), GPU-bilinear = the CPU's bilinear
 *   tGround the painted ground colour under it (the roots sink into it)
 *   tMask   1 m: road beds + verges (`trailGrass`), yurt floors, the exact painted splat, × (1 − `dressingCover`),
 *           0 on spruce trunks — rebuilt when the dressing lands (`reseedGrassV2()`)
 *   tHeight 1 m: the terrain height (half float) the blades stand on
 * Bent by the one Wind (`windGust`, WIND_GLSL) and the trample map + live movers (`trampleBend`, TRAMPLE_GLSL) —
 * `update()` drives `wind.update` / `trample.push` / `trample.update`.
 *
 * Lit like the prototype: wrap diffuse from the key (the cheat key, painterly uPSunDir / uPSunRef), a sky / ground
 * hemisphere, translucency looking into the sun, self-occlusion toward the roots; fogged by the v2 fog; graded by the
 * v2 chain. Budget (phone): 5 draws, ~0.3 M submitted triangles (the cards ~16 k).
 */
import * as THREE from 'three';
import { TIER } from '../../core/tier';
import { CHUNK_HALF } from '../../core/config';
import { heightAt, trailDistance, splatAt } from '../../world/Heightfield';
import { grassBaseHeightAt, trailGrass, grassToneAt, groundColorAt, grassBloomAt, flowerSpeciesAt } from '../../world/GrassField';
import { wind, WIND_GLSL } from '../../world/steppeWind';
import { trample, TRAMPLE_GLSL } from '../../world/GrassTrample';
import { painterlyUniforms } from '../../world/painterly';
import { fogUniforms, paintedAir } from '../../world/Atmosphere';
import { dressingCover } from '../../world/nalati/dressing';
import type { Sky } from '../../world/Sky';
import type { Forest } from '../../world/Forest';
import { macrotask } from '../../boot/plan';
import { LOOK_BAKE_GLSL, bakeUniforms } from './bake';
import { GRASS_CARDS, loadGrassCardAtlas } from '../../world/nalatiTextures';
import { setSlot, stateSlot } from '../../core/shardState';

const PHONE = TIER === 'phone';

interface RingCfg { T: number; G: number; s: number; w: number; seg: number }
const RINGS: RingCfg[] = PHONE
  ? [{ T: 4, G: 8, s: 0.085, w: 0.047, seg: 3 }, { T: 8, G: 12, s: 0.2, w: 0.1, seg: 2 }, { T: 16, G: 14, s: 0.45, w: 0.2, seg: 1 }]
  : [{ T: 4, G: 8, s: 0.06, w: 0.034, seg: 3 }, { T: 8, G: 14, s: 0.15, w: 0.08, seg: 3 }, { T: 16, G: 18, s: 0.34, w: 0.16, seg: 2 }];
const FLOWERS = PHONE ? { T: 8, G: 10, s: 0.3 } : { T: 8, G: 14, s: 0.22 };
/** the near field (0 – ~3 m): painted card clumps (GRASS_CARDS), 3 crossed quads each; the blades thin out under them */
const CARDS = PHONE ? { T: 2, G: 4, s: 0.2 } : { T: 2, G: 4, s: 0.17 };
/** where the cards hand over to the blades (m from the camera): cards full inside NEAR[0], gone past NEAR[1] */
const NEAR = [2.3, 3.4] as const;
const MAX_TILES = 256;

// the baked maps' extents
const HN = 512, H_ORG = -256;                            // tHeight / tMask: 1 m texels over [−256, 256]
const LAT = 4, LN = Math.ceil((CHUNK_HALF * 2) / LAT) + 1; // tField / tGround: the GrassField lattice

/** the day gain of the grass light */
const GRASS_GAIN = 1.8;
/** shared uniforms (the look's updater sets the sun + hemi each frame) */
export const grassV2Uniforms = {
  uSunView: { value: new THREE.Vector3(0, 0.4, 1).normalize() },
  uHemiSky: { value: new THREE.Color(0.4, 0.46, 0.62) },
  uHemiGround: { value: new THREE.Color(0.3, 0.3, 0.16) },
  uHemiI: { value: 0.4 },
  uGrassGain: { value: GRASS_GAIN },
  /** the grass's own saturation (1 by day; the hour / storm pull it down — `grassMood`) */
  uGrassSat: { value: 1 },
  /** …and its tint (white by day; moonlit blue at night, slate in the storm) */
  uGrassTint: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
};

if (typeof window !== 'undefined') Object.assign(window, { __grassV2: grassV2Uniforms }); // live tuning, like __gradeV2

/**
 * The grass's mood for the hour and the storm (step 2 of the polish: dusk, night and storms stay painterly and dark).
 * The blades are lit with a gain (the painted-meadow read by day) that over-lights them against the terrain once the key
 * is the moon or the storm's flat fill, and their olive / lime reads neon under a slate sky. So the gain drops and the
 * colour greys with the hour and the overcast; flashes still light them (the key carries the flash).
 * `night` 0..1 (sun well down), `dusk` 0..1 (the low sun), `overcast` 0..1 (the storm).
 */
export function grassMood(night: number, dusk: number, overcast: number): void {
  const g = GRASS_GAIN * (1 - 0.18 * dusk) * (1 - 0.5 * night) * (1 - 0.52 * overcast);
  grassV2Uniforms.uGrassGain.value = g;
  grassV2Uniforms.uGrassSat.value = (1 - 0.25 * dusk) * (1 - 0.5 * night) * (1 - 0.42 * overcast);
  grassV2Uniforms.uGrassTint.value.setRGB(1 - 0.22 * night - 0.08 * overcast, 1 - 0.12 * night - 0.04 * overcast, 1 + 0.12 * night + 0.04 * overcast);
}

const COMMON = /* glsl */`
uniform sampler2D tHeight; uniform sampler2D tMask; uniform sampler2D tField; uniform sampler2D tGround; uniform sampler2D tTiles;
uniform vec4 uHXf;   // x, z origin (m), 1 / size (1/m), texel count
uniform vec4 uFXf;   // lattice origin x, z (m), 1 / cell (1/m), corner count
float gHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 gHash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(gHash12(i), gHash12(i + vec2(1, 0)), u.x), mix(gHash12(i + vec2(0, 1)), gHash12(i + vec2(1, 1)), u.x), u.y); }
float gFbm(vec2 p) { return gNoise(p) * .5 + gNoise(p * 2.03 + 17.1) * .25 + gNoise(p * 4.1 - 9.3) * .125; }
vec2 hUV(vec2 xz) { return (xz - uHXf.xy) * uHXf.z; }
vec2 fUV(vec2 xz) { return ((xz - uFXf.xy) * uFXf.z + 0.5) / uFXf.w; }
float groundH(vec2 xz) { return texture(tHeight, hUV(xz)).r; }
`;

const LIGHT = /* glsl */`
uniform vec3 uPSunDir; uniform vec3 uPSunRef; uniform vec3 uSunView;
uniform vec3 uHemiSky; uniform vec3 uHemiGround; uniform float uHemiI; uniform float uGrassGain; uniform float uGrassSat; uniform vec3 uGrassTint;
vec3 gMood(vec3 c) { return mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uGrassSat) * uGrassTint; }
vec3 gLight(vec3 n, float wrap, float sh) {
  float ndl = clamp((dot(n, uPSunDir) + wrap) / (1. + wrap), 0., 1.) * sh;
  vec3 amb = mix(uHemiGround, uHemiSky, n.y * .5 + .5) * uHemiI * 1.75;
  return (uPSunRef * (0.78 / 2.8) * ndl + amb) * uGrassGain;
}
`;

const BLADE_VS = /* glsl */`
${COMMON}
${LOOK_BAKE_GLSL}
${WIND_GLSL}
${TRAMPLE_GLSL}
attribute float aT; attribute float aSide;
uniform float uSpacing; uniform float uPerSide; uniform float uWidth; uniform float uFade0; uniform float uFade1;
uniform vec4 uHole;       // inner ring square: centre x, z, half size, on
uniform vec3 uNear;       // the card ring's hand-over: r0, r1, the share of blades kept under the cards (1 = no cards)
uniform float uTime;
varying float vT; varying vec3 vFogWorldPos; varying float vFogDepth; varying vec3 vN; varying vec3 vCol; varying float vSelf; varying float vSh;
void main() {
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 1.731) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float r = gHash12(cell + 7.13);
  float patchN = gFbm(xz * .09);
  // the field's height (m), through the road verge (tMask.g) and the fine cut-outs (tMask.r)
  float H0 = fld.r * 1.5;
  H0 = mix(min(H0, 0.22), H0, msk.g) * msk.r;
  // tufty, not a hedge: most blades well under the field height, a few reach it (the field height is what hides you)
  float h = H0 * mix(.32, 1.08, r * r) * mix(.75, 1.15, patchN);
  vec2 dh = abs(xz - uHole.xy);
  if (uHole.w > .5 && max(dh.x, dh.y) < uHole.z) h = 0.;
  float dist = length(xz - cameraPosition.xz);
  h *= 1. - smoothstep(uFade0, uFade1, dist);
  // under the painted near cards most blades stand down (the few left are slim), so no big dark spikes at the feet
  float nearK = max(smoothstep(uNear.x, uNear.y, dist), 1. - smoothstep(.24, .4, H0)); // short turf keeps its blades (no cards there)
  h *= step(gHash12(cell + 2.21), mix(uNear.z, 1., nearK));
  if (h < .04) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // facing: random, half turned toward the camera so no blade goes edge-on
  float ang = gHash12(cell + 3.3) * 6.2831;
  vec2 f = vec2(cos(ang), sin(ang));
  vec2 toCam = normalize(cameraPosition.xz - xz + 1e-4);
  f = normalize(mix(f, toCam, .55));
  vec2 side = vec2(-f.y, f.x);
  // one bend vector (radians × direction): a lean of its own + the Wind's gusts and flutter + the trample
  vec2 B = (gHash22(cell + 9.1) - .5) * .7 + f * .12;
  float g = windGust(xz);
  float push = (0.04 + uWindSpeed * 0.03) * (0.35 + 1.25 * g * uWindGustiness + (1.0 - uWindGustiness) * 0.3);
  float flut = sin(uWindTime * (3.5 + 3.0 * r) + xz.x * 2.1 + xz.y * 1.7 + r * 6.28) * (0.03 + uWindSpeed * 0.007);
  B += uWindDir * push + vec2(-uWindDir.y, uWindDir.x) * flut;
  B += trampleBend(xz);
  float bl = length(B), th = min(bl, 1.55);
  vec2 bd = B / max(bl, 1e-4);
  float t = aT;
  float a = th * t;
  float along = th < 1e-3 ? 0. : (1. - cos(a)) / th * h;
  float up = th < 1e-3 ? t * h : sin(a) / th * h;
  vec3 root = vec3(xz.x, groundH(xz) - .03, xz.y);
  float wdt = uWidth * mix(.7, 1.3, gHash12(cell + 1.7)) * (1. - t * .85) * mix(.55, 1., nearK);
  vec3 p = root + vec3(bd.x * along, up, bd.y * along) + vec3(side.x, 0., side.y) * aSide * wdt * .5;
  vec3 fn = normalize(vec3(f.x, 0., f.y) + vec3(side.x, 0., side.y) * aSide * .6);
  vN = normalize(mix(fn, vec3(0., 1., 0.), .35));
  // colour: the root sunk into the painted ground → the tip, olive / green / gold by patch and the field's tone
  vec3 gnd = texture(tGround, fUV(xz)).rgb;
  float tone = fld.g;
  // the valley (low tone) is lush: a deeper, cooler green and few gold patches; the plateau keeps its olive / gold
  float lush = 1. - smoothstep(.3, .55, tone);
  vec3 tipA = mix(vec3(.5, .56, .1), vec3(.3, .5, .11), lush), tipB = vec3(.74, .6, .15), tipC = mix(vec3(.22, .36, .08), vec3(.12, .29, .07), lush);
  float gold = clamp(smoothstep(.42, .78, gFbm(xz * .21 + 11.)) * .85 + tone * .45, 0., 1.) * (1. - .7 * lush);
  vec3 tip = mix(mix(tipC, tipA, smoothstep(.2, .6, patchN)), tipB, gold);
  tip = mix(tip, vec3(.72, .62, .32), step(.92 + .06 * lush, gHash12(cell + 4.4)) * .8);     // a dry straw blade here and there
  tip *= mix(.65, 1.2, r);
  vec3 rootC = mix(vec3(.02, .04, .012), gnd * .35, .35);
  vCol = mix(rootC, tip, smoothstep(0., .85, t));
  vSelf = mix(.3, 1., pow(t, .9)) * mix(.6, 1., r);
  vT = t;
  vFogWorldPos = p;
  vSh = bakedShadow(p + vec3(0., .12, 0.));   // the static bake
  vSelf *= mix(bakedContact(root), 1., t * .5);   // the contact shade under the yurts / rocks / trunks, most at the roots
  vec4 mv = viewMatrix * vec4(p, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const BLADE_FS = /* glsl */`
${LIGHT}
#include <fog_pars_fragment>
varying float vT; varying vec3 vN; varying vec3 vCol; varying float vSelf; varying float vSh;
void main() {
  vec3 v = normalize(vFogWorldPos - cameraPosition);
  float back = pow(clamp(dot(v, uSunView), 0., 1.), 4.) * vT * vT;      // translucent against the sun
  vec3 lit = vCol * gLight(normalize(vN), .25, vSh) * .8 + uPSunRef * (0.78 / 2.8) * back * vec3(.55, .5, .08) * .9 * uGrassGain * vSh;
  gl_FragColor = vec4(gMood(lit * vSelf), 1.);
  #include <fog_fragment>
}`;

const FLOWER_VS = /* glsl */`
${COMMON}
${LOOK_BAKE_GLSL}
uniform float uSpacing; uniform float uPerSide; uniform float uFade0; uniform float uFade1; uniform float uTime; uniform vec3 uNear;
varying vec2 vUv; varying float vType; varying vec3 vFogWorldPos; varying float vFogDepth; varying float vSeed; varying float vSh;
void main() {
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 2.917) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float H0 = fld.r * 1.5 * msk.r * msk.g;
  float r = gHash12(cell + 5.1), r2 = gHash12(cell + 8.7);
  // which flower (if any): drifts from the field's bloom, the drift's own species, a third strays
  float keep = step(r, 0.16 + 0.84 * fld.b) * step(0.18, H0);
  bool plateau = fld.g > 0.5;
  float sp = fld.a;
  float own = plateau ? (sp < .3 ? 1. : sp < .75 ? 2. : 3.) : (sp < .5 ? 3. : sp < .85 ? 2. : 1.);
  float kind = r2 < .65 ? own : 1. + mod(floor((r2 - .65) / .35 * 3.), 3.);
  // 1 sage → the lupine spike · 2 white → daisy (edelweiss on the plateau) · 3 buttercup
  float type = kind < 1.5 ? 2. : kind < 2.5 ? (plateau ? 3. : 1.) : 0.;
  float dist = length(xz - cameraPosition.xz);
  float s = keep * (1. - smoothstep(uFade0, uFade1, dist)) * smoothstep(uNear.x, uNear.y, dist); // the near cards carry the flowers at the feet
  if (s < .05) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // the heads ride just above the grass (a drift reads from afar), smaller in short turf
  float h = (type == 2. ? mix(.3, .5, r) : mix(.18, .34, r)) * clamp(H0 * 1.1, .5, 1.1);
  h *= 1.25;
  float w = type == 2. ? h * .34 : h * .55;
  w *= 1. + dist * .006 * step(type, 1.5); h *= 1. + dist * .003;
  vec2 toCam = normalize(cameraPosition.xz - xz); vec2 right = vec2(toCam.y, -toCam.x);
  float sway = sin(uTime * 2. + r * 30.) * .03 * position.y;
  vec3 p = vec3(xz.x, groundH(xz) - .02, xz.y) + vec3(right.x, 0., right.y) * (position.x * w + sway) + vec3(0., position.y * h * s, 0.);
  vUv = position.xy + vec2(.5, 0.); vType = type; vFogWorldPos = p; vSeed = r;
  vSh = bakedShadow(p + vec3(0., .12, 0.)) * bakedContact(p) + 0.001;
  vec4 mv = viewMatrix * vec4(p, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FLOWER_FS = /* glsl */`
${LIGHT}
#include <fog_pars_fragment>
varying vec2 vUv; varying float vType; varying float vSeed; varying float vSh;
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
void main() {
  vec2 p = vUv;
  vec3 col; float a = 0.;
  float stem = 1. - smoothstep(.02, .045, sdSeg(p, vec2(.5, 0.), vec2(.5 + (vSeed - .5) * .1, .8)));
  vec3 stemC = vec3(.13, .3, .06);
  if (vType < .5) {            // buttercup
    vec2 q = p - vec2(.5 + (vSeed - .5) * .1, .82); float ang = atan(q.y, q.x); float rr = length(q);
    float petal = .15 + .04 * cos(ang * 5.);
    float head = 1. - smoothstep(petal - .02, petal + .02, rr);
    col = mix(vec3(1., .78, .06), vec3(1., .92, .35), 1. - smoothstep(0., .12, rr)); a = max(head, stem * .9);
    col = mix(stemC, col, head);
  } else if (vType < 1.5) {    // daisy
    vec2 q = p - vec2(.5 + (vSeed - .5) * .1, .8); float ang = atan(q.y, q.x); float rr = length(q);
    float petal = .2 + .06 * cos(ang * 11.);
    float head = 1. - smoothstep(petal - .02, petal + .02, rr);
    float eye = 1. - smoothstep(.05, .07, rr);
    col = mix(vec3(.97, .96, .9), vec3(1., .78, .1), eye); a = max(head, stem * .9);
    col = mix(stemC, col, head);
  } else if (vType < 2.5) {    // lupine spike: a staggered column of florets tapering to the tip
    float rows = 9.; float ry = (p.y - .45) / .5 * rows; float ri = floor(ry);
    float taper = mix(.2, .07, clamp(ri / rows, 0., 1.));
    float off = mod(ri, 2.) < .5 ? -.07 : .07;
    vec2 c1 = vec2(.5 + off * (1. - ri / rows), .45 + (ri + .5) / rows * .5);
    float fl = 1. - smoothstep(taper * .55, taper * .55 + .03, length((p - c1) * vec2(1., 1.6)));
    vec2 c2 = vec2(.5 - off * (1. - ri / rows), c1.y);
    fl = max(fl, 1. - smoothstep(taper * .55, taper * .55 + .03, length((p - c2) * vec2(1., 1.6))));
    fl *= step(.45, p.y) * step(p.y, .95);
    col = mix(vec3(.16, .10, .45), vec3(.45, .34, .80), smoothstep(.45, 1., p.y) * .7 + fract(ry) * .3);
    a = max(fl, stem);
    col = mix(stemC, col, fl);
  } else {                     // edelweiss
    vec2 q = p - vec2(.5, .78); float ang = atan(q.y, q.x); float rr = length(q);
    float star = 1. - smoothstep(.0, .03, rr - (.1 + .1 * pow(abs(cos(ang * 3.)), 3.)));
    col = mix(vec3(.95, .95, .88), vec3(.9, .85, .45), 1. - smoothstep(.03, .06, rr)); a = max(star, stem);
    col = mix(stemC, col, star);
  }
  if (a < .5) discard;
  gl_FragColor = vec4(gMood(col * gLight(vec3(0., 1., 0.), .5, vSh) * .6), 1.);
  #include <fog_fragment>
}`;

const CARD_VS = /* glsl */`
${COMMON}
${LOOK_BAKE_GLSL}
${WIND_GLSL}
${TRAMPLE_GLSL}
attribute float aQ;       // which of the 3 crossed quads (0, 1, 2 → 0°, 60°, 120° round the clump's own turn)
uniform float uSpacing; uniform float uPerSide; uniform vec3 uNear; uniform vec4 uCells[16]; uniform float uTime;
varying vec2 vUv; varying vec3 vFogWorldPos; varying float vFogDepth; varying vec3 vN; varying vec3 vTint; varying float vT; varying float vSh; varying float vSelf;
void main() {
  float per = uPerSide * uPerSide;
  float tile = floor(float(gl_InstanceID) / per);
  float id = float(gl_InstanceID) - tile * per;
  vec2 origin = texelFetch(tTiles, ivec2(int(tile), 0), 0).xy;
  vec2 cell = origin + vec2(mod(id, uPerSide), floor(id / uPerSide)) * uSpacing;
  vec2 xz = cell + gHash22(cell * 1.377) * uSpacing;
  vec4 fld = texture(tField, fUV(xz));
  vec4 msk = texture(tMask, hUV(xz));
  float H0 = fld.r * 1.5;
  H0 = mix(min(H0, 0.22), H0, msk.g) * msk.r;
  float r = gHash12(cell + 7.77), r2 = gHash12(cell + 3.91), r3 = gHash12(cell + 1.19);
  float patchN = gFbm(xz * .09);
  float dist = length(xz - cameraPosition.xz);
  // a clump the field's height (a painted clump is a tuft: its tallest stems reach the field height)
  float h = clamp(H0 * mix(.62, 1.05, r) * mix(.8, 1.12, patchN), 0., 1.);   // capped: a taller painted clump is all giant leaves at the lens
  h *= smoothstep(.24, .4, H0);                              // short turf is the blades' (they are no spikes there)
  h *= 1. - smoothstep(uNear.x, uNear.y, dist);
  if (h < .06) { gl_Position = vec4(0., 0., -2., 1.); return; }
  // which card: a flower where the field blooms (its drift species, as the SDF heads choose), else one of the 8 grass clumps
  bool plateau = fld.g > 0.5;
  float sp = fld.a;
  float flower = step(r2, (0.02 + 0.2 * fld.b) * step(0.2, H0));
  float own = plateau ? (sp < .3 ? 0. : sp < .75 ? 1. : 2.) : (sp < .5 ? 2. : sp < .85 ? 1. : 0.);  // 0 sage/lupine · 1 white · 2 buttercup
  float c = flower > .5
    ? (own < .5 ? floor(r3 * 3.) : own < 1.5 ? 3. + floor(r3 * 2.) : 5. + floor(r3 * 3.)) + 8.
    : floor(r3 * 7.999);
  c = c == 2. && r > .3 ? 7. : c;                     // the feather plume: a rare accent, not a carpet
  c = plateau && flower < .5 && r3 > .7 ? 5. : c;  // the plateau's gold: more dry clumps
  vec4 uvr = uCells[int(c)];
  // the clump's own turn; the three quads cross at 60°
  float ang = gHash12(cell + 5.55) * 3.1416 + aQ * 1.0472;
  vec2 f = vec2(cos(ang), sin(ang));
  float t = position.y;
  // wind + trample, as the blades (the top bends, the root stays)
  vec2 B = (gHash22(cell + 9.1) - .5) * .35;
  float g = windGust(xz);
  float push = (0.04 + uWindSpeed * 0.03) * (0.35 + 1.25 * g * uWindGustiness + (1.0 - uWindGustiness) * 0.3);
  float flut = sin(uWindTime * (2.5 + 2.0 * r) + xz.x * 2.1 + xz.y * 1.7 + r * 6.28) * (0.02 + uWindSpeed * 0.005);
  B += uWindDir * push + vec2(-uWindDir.y, uWindDir.x) * flut;
  B += trampleBend(xz) * 1.2;
  float th = min(length(B), 1.3);
  vec2 bd = B / max(length(B), 1e-4);
  float a = th * t;
  float along = th < 1e-3 ? 0. : (1. - cos(a)) / th * h;
  float up = th < 1e-3 ? t * h : sin(a) / th * h;
  h *= flower > .5 ? .8 : 1.;
  float w = h * 0.62 * mix(.85, 1.2, r2);
  vec3 root = vec3(xz.x, groundH(xz) - .04, xz.y);
  vec3 p = root + vec3(f.x, 0., f.y) * position.x * w + vec3(bd.x * along, up, bd.y * along);
  vec2 nrm = vec2(-f.y, f.x);
  vN = normalize(vec3(nrm.x, 0.9, nrm.y));
  vUv = vec2(mix(uvr.x, uvr.z, position.x + .5), mix(uvr.y, uvr.w, t));
  // the tint: the card's painted colour, pulled toward the field's gold / green patch and the ground under it
  float lush = 1. - smoothstep(.3, .55, fld.g);   // the valley: greener, cooler clumps (the plateau keeps its gold)
  float gold = clamp(smoothstep(.42, .78, gFbm(xz * .21 + 11.)) * .85 + fld.g * .45, 0., 1.) * (1. - .7 * lush);
  vTint = mix(mix(vec3(.86, .98, .78), vec3(.68, .92, .7), lush), vec3(1.12, .98, .7), gold) * mix(.78, 1.08, r) * mix(.85, 1.05, patchN);
  vT = t;
  vSelf = mix(.42, 1., smoothstep(0., .8, t)) * mix(bakedContact(root), 1., t * .5);
  vFogWorldPos = p;
  vSh = bakedShadow(p + vec3(0., .12, 0.));
  vec4 mv = viewMatrix * vec4(p, 1.);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const CARD_FS = /* glsl */`
${LIGHT}
#include <fog_pars_fragment>
uniform sampler2D tCards; uniform float uA2C;
varying vec2 vUv; varying vec3 vN; varying vec3 vTint; varying float vT; varying float vSh; varying float vSelf;
void main() {
  vec4 tx = texture(tCards, vUv);
  float a = tx.a;
  if (uA2C > .5) { a = clamp((a - .5) / max(fwidth(a), 1e-4) + .5, 0., 1.); if (a < .02) discard; }
  else if (a < .5) discard;
  vec3 n = normalize(gl_FrontFacing ? vN : vec3(-vN.x, vN.y, -vN.z));
  vec3 v = normalize(vFogWorldPos - cameraPosition);
  float back = pow(clamp(dot(v, uSunView), 0., 1.), 4.) * vT;
  vec3 alb = tx.rgb * vTint;
  vec3 lit = alb * gLight(n, .35, vSh) * 1.05 + alb * uPSunRef * (0.78 / 2.8) * back * .9 * uGrassGain * vSh;
  gl_FragColor = vec4(gMood(lit * vSelf), uA2C > .5 ? a : 1.);
  #include <fog_fragment>
}`;

/** 3 crossed quads, 2 rows each (the top row bends): position.x −0.5 … 0.5 across, position.y 0 … 1 up; aQ = the quad */
function cardGeometry(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const pos: number[] = [], q: number[] = [], idx: number[] = [];
  for (let k = 0; k < 3; k++) {
    const b = k * 6;
    for (const y of [0, 0.5, 1]) { pos.push(-0.5, y, 0, 0.5, y, 0); q.push(k, k); }
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2, b + 2, b + 3, b + 5, b + 2, b + 5, b + 4);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aQ', new THREE.Float32BufferAttribute(q, 1));
  g.setIndex(idx);
  g.instanceCount = 0;
  return g;
}

function bladeGeometry(seg: number): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const t: number[] = [], s: number[] = [], idx: number[] = [];
  for (let i = 0; i < seg; i++) { const tt = i / seg; t.push(tt, tt); s.push(-1, 1); }
  t.push(1); s.push(0);
  for (let i = 0; i < seg - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const a = (seg - 1) * 2; idx.push(a, a + 1, a + 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(t.length * 3), 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(s, 1));
  g.setIndex(idx);
  g.instanceCount = 0;
  return g;
}

function flowerGeometry(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = 0;
  return g;
}

function tileTexture(): { tex: THREE.DataTexture; data: Float32Array } {
  const data = new Float32Array(MAX_TILES * 4);
  const tex = new THREE.DataTexture(data, MAX_TILES, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return { tex, data };
}

interface Ring {
  T: number; G: number; per: number; mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry;
  tiles: { tex: THREE.DataTexture; data: Float32Array }; hole: THREE.Vector4; half: number;
}

const smooth01 = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let heightTex: THREE.DataTexture | null = null;
/** the terrain height at 1 m over [−256, 256] (half float, linear) — the blades stand on it, the bake reads it */
export function terrainHeightTexture(): THREE.DataTexture {
  if (heightTex) return heightTex;
  const hd = new Uint16Array(HN * HN);
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) hd[j * HN + i] = THREE.DataUtils.toHalfFloat(heightAt(H_ORG + i + 0.5, H_ORG + j + 0.5));
  const t = new THREE.DataTexture(hd, HN, HN, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  heightTex = t;
  return t;
}

const instances = new Set<GrassV2>();
/** the dressing landed: every v2 carpet re-bakes its mask (wireNalati calls it once the dressing is built) */
export function reseedGrassV2(): void { for (const g of instances) g.reseed(); }

const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _box = new THREE.Box3();

export class GrassV2 {
  readonly group = new THREE.Group();
  private readonly maps: { tHeight: THREE.DataTexture; tMask: THREE.DataTexture; tField: THREE.DataTexture; tGround: THREE.DataTexture };
  private readonly maskData = new Uint8Array(HN * HN * 4);
  private rings: Ring[] = [];
  private flowers: Ring | null = null;
  private cards: Ring | null = null;
  private lastPX = Number.NaN;
  private lastPZ = Number.NaN;
  private baking = 0;
  /** live tunables */
  readonly params = { playerRadius: 0.55 };

  constructor(private readonly sky: Sky, private readonly forest: Forest) {
    instances.add(this);
    const tHeight = terrainHeightTexture();
    // the field: GrassField's own 4 m lattice (height, tone, bloom, species) and the painted ground colour
    const fd = new Uint8Array(LN * LN * 4), gd = new Uint8Array(LN * LN * 4);
    const rgb: [number, number, number] = [0, 0, 0];
    for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
      const x = i * LAT - CHUNK_HALF, z = j * LAT - CHUNK_HALF, k = (j * LN + i) * 4;
      // the field's own height (no trail: tMask carries the roads at 1 m)
      fd[k] = Math.round(Math.min(1, grassBaseHeightAt(x, z, Infinity) / 1.5) * 255);
      fd[k + 1] = Math.round(Math.min(1, Math.max(0, grassToneAt(x, z))) * 255);
      fd[k + 2] = Math.round(Math.min(1, Math.max(0, grassBloomAt(x, z))) * 255);
      fd[k + 3] = Math.round(Math.min(1, Math.max(0, flowerSpeciesAt(x, z))) * 255);
      groundColorAt(x, z, rgb);
      gd[k] = Math.round(Math.min(1, rgb[0]) * 255); gd[k + 1] = Math.round(Math.min(1, rgb[1]) * 255); gd[k + 2] = Math.round(Math.min(1, rgb[2]) * 255); gd[k + 3] = 255;
    }
    const tField = new THREE.DataTexture(fd, LN, LN, THREE.RGBAFormat); tField.magFilter = tField.minFilter = THREE.LinearFilter; tField.needsUpdate = true;
    const tGround = new THREE.DataTexture(gd, LN, LN, THREE.RGBAFormat); tGround.magFilter = tGround.minFilter = THREE.LinearFilter; tGround.needsUpdate = true;
    this.maskData.fill(255);
    const tMask = new THREE.DataTexture(this.maskData, HN, HN, THREE.RGBAFormat); tMask.magFilter = tMask.minFilter = THREE.LinearFilter; tMask.needsUpdate = true;
    this.maps = { tHeight, tMask, tField, tGround };
  }

  build(): this {
    const m = this.maps;
    const shared = {
      tHeight: { value: m.tHeight }, tMask: { value: m.tMask }, tField: { value: m.tField }, tGround: { value: m.tGround },
      uHXf: { value: new THREE.Vector4(H_ORG, H_ORG, 1 / HN, HN) },
      uFXf: { value: new THREE.Vector4(-CHUNK_HALF, -CHUNK_HALF, 1 / LAT, LN) },
      uPSunDir: painterlyUniforms.uPSunDir, uPSunRef: painterlyUniforms.uPSunRef, ...bakeUniforms,
      ...grassV2Uniforms,
      ...THREE.UniformsLib.fog, ...fogUniforms, ...paintedAir,
    };
    RINGS.forEach((cfg, ri) => {
      const per = Math.round(cfg.T / cfg.s);
      const geo = bladeGeometry(cfg.seg);
      const last = ri === RINGS.length - 1;
      const half = (cfg.G * cfg.T) / 2;
      const tiles = tileTexture();
      const hole = new THREE.Vector4(0, 0, 0, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          ...shared, ...wind.uniforms, ...trample.uniforms, tTiles: { value: tiles.tex },
          uSpacing: { value: cfg.s }, uPerSide: { value: per }, uWidth: { value: cfg.w },
          uFade0: { value: last ? half * 0.6 : 1e4 }, uFade1: { value: last ? half * 0.95 : 1e4 }, uHole: { value: hole },
          uNear: { value: ri === 0 ? new THREE.Vector3(NEAR[0], NEAR[1], 0.4) : new THREE.Vector3(-1, 0, 1) },
        },
        vertexShader: BLADE_VS, fragmentShader: BLADE_FS, side: THREE.DoubleSide, fog: true,
      });
      mat.name = `grass-v2-ring${ri}`;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.name = mat.name;
      mesh.onBeforeRender = (renderer, _s, camera) => { this.place(renderer, camera); };
      this.group.add(mesh);
      this.rings.push({ T: cfg.T, G: cfg.G, per: per * per, mesh, geo, tiles, hole, half });
    });
    {
      const cfg = FLOWERS, per = Math.round(cfg.T / cfg.s), geo = flowerGeometry(), tiles = tileTexture(), half = (cfg.G * cfg.T) / 2;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          ...shared, tTiles: { value: tiles.tex },
          uSpacing: { value: cfg.s }, uPerSide: { value: per }, uFade0: { value: half * 0.6 }, uFade1: { value: half * 0.96 },
          uNear: { value: new THREE.Vector3(NEAR[0] - 0.4, NEAR[1] - 0.2, 0) },
        },
        vertexShader: FLOWER_VS, fragmentShader: FLOWER_FS, side: THREE.DoubleSide, fog: true,
      });
      mat.name = 'grass-v2-flowers';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.name = mat.name;
      mesh.onBeforeRender = (renderer, _s, camera) => { this.place(renderer, camera); };
      this.group.add(mesh);
      this.flowers = { T: cfg.T, G: cfg.G, per: per * per, mesh, geo, tiles, hole: new THREE.Vector4(), half };
    }
    this.buildCards(shared);
    void this.bakeMask();
    return this;
  }

  /**
   * The near field: the painted grass / flower card atlas as clumps of 3 crossed quads (not camera-facing — they hold
   * up walked round), on the same field, mask, wind and trample as the blades; alpha-to-coverage under MSAA (desktop),
   * alpha test on the phone. Built at once with a clear 1×1 stand-in (so it compiles with the rest), the atlas swapped
   * in when it lands.
   */
  private buildCards(shared: Record<string, THREE.IUniform>): void {
    const cfg = CARDS, per = Math.round(cfg.T / cfg.s), geo = cardGeometry(), tiles = tileTexture(), half = (cfg.G * cfg.T) / 2;
    const clear = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); clear.needsUpdate = true;
    const a2c = !PHONE;
    const cells = GRASS_CARDS.map((c) => new THREE.Vector4(c.u0 + 0.004, c.v0 + 0.004, c.u1 - 0.004, c.v1 - 0.01));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared, ...wind.uniforms, ...trample.uniforms, tTiles: { value: tiles.tex }, tCards: { value: clear },
        uSpacing: { value: cfg.s }, uPerSide: { value: per }, uNear: { value: new THREE.Vector3(NEAR[0], NEAR[1], 0) },
        uCells: { value: cells }, uA2C: { value: a2c ? 1 : 0 },
      },
      vertexShader: CARD_VS, fragmentShader: CARD_FS, side: THREE.DoubleSide, fog: true, alphaToCoverage: a2c,
    });
    mat.name = 'grass-v2-cards';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.name = mat.name;
    mesh.onBeforeRender = (renderer, _s, camera) => { this.place(renderer, camera); };
    this.group.add(mesh);
    this.cards = { T: cfg.T, G: cfg.G, per: per * per, mesh, geo, tiles, hole: new THREE.Vector4(), half };
    void (async (): Promise<void> => {
      try { const t = await loadGrassCardAtlas(); const u = mat.uniforms['tCards']; if (u) u.value = t; } catch (e: unknown) { console.warn('[grass v2] no card atlas', e); }
    })();
  }

  /** the dressing landed (`reseedGrassV2`): bake the fine mask again with its cover */
  reseed(): void { void this.bakeMask(); }

  /**
   * tMask at 1 m: R = the cut-outs (road bed, yurt floor, the exact painted splat, 1 − dressing cover, spruce trunks),
   * G = the verge (0 = capped at the grazed 0.22 m, 1 = the full field). A few rows per task.
   */
  private async bakeMask(): Promise<void> {
    const run = ++this.baking;
    const d = new Uint8Array(HN * HN * 4);
    for (let j = 0; j < HN; j++) {
      const z = H_ORG + j + 0.5;
      for (let i = 0; i < HN; i++) {
        const x = H_ORG + i + 0.5, k = (j * HN + i) * 4;
        const td = trailDistance(x, z);
        // trailGrass(h, td) = mix(min(h, 0.22), h, s1) · s2 — read s1 (the verge growing back) and s2 (the bed's edge) off it
        const full = trailGrass(1, td), capped = trailGrass(0.22, td);
        const s2 = Math.min(1, capped / 0.22);
        let cut = s2;
        const verge = s2 <= 1e-4 ? 0 : Math.max(0, Math.min(1, (full - capped) / (0.78 * s2)));
        if (cut > 0) {
          const base = grassBaseHeightAt(x, z, Infinity);
          if (base <= 0) cut = 0;                                          // water, yurt floors, off-chunk
          else cut *= smooth01(0.35, 0.6, splatAt(x, z)[0]);          // the exact painted ground (a gravel bar's edge)
          if (cut > 0) cut *= 1 - dressingCover(x, z);
        }
        d[k] = Math.round(cut * 255); d[k + 1] = Math.round(verge * 255); d[k + 2] = 0; d[k + 3] = 255;
      }
      if ((j & 31) === 31) { await macrotask(); if (run !== this.baking) return; }
    }
    // spruce trunks: no blades inside a trunk
    for (const t of this.forest.trees) {
      const r = t.r;
      const i0 = Math.floor(t.x - H_ORG - r - 0.5), j0 = Math.floor(t.z - H_ORG - r - 0.5);
      for (let j = j0; j <= j0 + Math.ceil(2 * r + 1); j++) for (let i = i0; i <= i0 + Math.ceil(2 * r + 1); i++) {
        if (i < 0 || j < 0 || i >= HN || j >= HN) continue;
        if (Math.hypot(H_ORG + i + 0.5 - t.x, H_ORG + j + 0.5 - t.z) < r + 0.35) d[(j * HN + i) * 4] = 0;
      }
    }
    if (run !== this.baking) return;
    this.maskData.set(d);
    this.maps.tMask.needsUpdate = true;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // the player parts the grass and leaves a trail; the wind and the trample advance
    const vx = Number.isNaN(this.lastPX) || dt <= 0 ? 0 : (playerPos.x - this.lastPX) / dt;
    const vz = Number.isNaN(this.lastPZ) || dt <= 0 ? 0 : (playerPos.z - this.lastPZ) / dt;
    this.lastPX = playerPos.x; this.lastPZ = playerPos.z;
    if (vx * vx + vz * vz < 900) trample.push(playerPos.x, playerPos.z, this.params.playerRadius, 1, vx, vz);
    wind.update(dt);
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, wind.speed / 5);
    trample.update(dt, playerPos);
    grassV2Uniforms.uTime.value += dt;
    // the hemisphere the fill comes from (the rig + the look retune it every frame)
    const hemi = this.sky.hemi;
    grassV2Uniforms.uHemiSky.value.copy(hemi.color); grassV2Uniforms.uHemiGround.value.copy(hemi.groundColor); grassV2Uniforms.uHemiI.value = hemi.intensity;
  }

  private placedFrame = -1;
  /**
   * As the frame renders (the camera is final — the first of the four draws calls it, once per render): snap the rings
   * to the camera, cull their tiles against its frustum, fill the tile lists and the instance counts.
   */
  private place(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    const frame = renderer.info.render.frame;
    if (frame === this.placedFrame) return;
    this.placedFrame = frame;
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    const cx = camera.position.x, cz = camera.position.z;
    // seen from high up the fine rings are wasted (their blades are sub-pixel): a ring stands down once the camera is
    // higher above the ground than the ring reaches, and the next ring fills its square
    const above = camera.position.y - heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cx)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, cz)));
    let prev: { cx: number; cz: number; half: number } | null = null;
    this.rings.forEach((R, i) => {
      if (i < this.rings.length - 1 && above > R.half * 0.9) { R.geo.instanceCount = 0; return; }
      prev = this.fill(R, cx, cz, prev);
    });
    if (this.flowers) this.fill(this.flowers, cx, cz, null);
    if (this.cards) { if (above > 6) this.cards.geo.instanceCount = 0; else this.fill(this.cards, cx, cz, null); }
  }

  private fill(R: Ring, camX: number, camZ: number, prev: { cx: number; cz: number; half: number } | null): { cx: number; cz: number; half: number } {
    const { T, G } = R;
    const ox = Math.round(camX / T) * T - (G / 2) * T, oz = Math.round(camZ / T) * T - (G / 2) * T;
    if (prev) R.hole.set(prev.cx, prev.cz, prev.half, 1); else R.hole.set(0, 0, 0, 0);
    let n = 0;
    const data = R.tiles.data;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x0 = ox + i * T, z0 = oz + j * T;
      if (prev && x0 >= prev.cx - prev.half && x0 + T <= prev.cx + prev.half && z0 >= prev.cz - prev.half && z0 + T <= prev.cz + prev.half) continue;
      if (x0 + T < -CHUNK_HALF || z0 + T < -CHUNK_HALF || x0 > CHUNK_HALF || z0 > CHUNK_HALF) continue;
      const y = heightAt(Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, x0 + T / 2)), Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, z0 + T / 2)));
      _box.min.set(x0, y - T * 0.35 - 2, z0); _box.max.set(x0 + T, y + T * 0.35 + 2, z0 + T);
      if (!_frustum.intersectsBox(_box)) continue;
      if (n >= MAX_TILES) break;
      data[n * 4] = x0; data[n * 4 + 1] = z0;
      n++;
    }
    R.tiles.tex.needsUpdate = true;
    R.geo.instanceCount = n * R.per;
    return { cx: ox + (G / 2) * T, cz: oz + (G / 2) * T, half: (G / 2) * T };
  }
}

// E155 (src/core/shardState.ts): a rebuilt Nalati starts from these
stateSlot('nalati.grassV2', grassV2Uniforms);

// E155 (src/core/shardState.ts): the running shard's carpets (a rebuilt Nalati's, not the evicted one's)
setSlot('nalati.grassV2', instances);

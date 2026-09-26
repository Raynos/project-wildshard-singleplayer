// Wet-ground streaks, merged from the neon lab (src/dev/nd-lab/neon/wetground.ts, "cards"): one instanced additive
// card per emitter, lying where optics puts its reflection — between the mirror points of the emitter's top and bottom,
// c / (c + h) of the way from the eye — stretched along the view ray by the gloss, broken on the same flagstone joints
// as the ground (STONES_GLSL, shared with the Jiehua ground), with a jagged two-octave ripple edge, striation, dashes and
// grain. It replaces the quarter-res mirror pass. The reflecting plane is the square's floor at `uGroundY` (the square and
// its street), or (round 14, dome C1's stair-street) a stair flight's slope: `stairStreaks` lays a card set on each flight's
// plane half a rise under its nosing line, so the depth test shows each card on the back half of every tread only — the
// per-step broken reflection — and a flat set on each landing.
import {
  Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial,
  Uint16BufferAttribute, Vector3, Vector4,
} from 'three';
import type { Emitter } from './emitters';
import { FLAG_GLSL } from './paint'; // (the flag layout: flagCell)
import { ADD_KEEP_ALPHA, FOG_GLSL, NOISE_GLSL, STONES_GLSL, type Shared } from './style';

/** (render) the derivative-free part of NOISE_GLSL — what silkFog needs — for the vertex stage */
const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const VS_CARD = /* glsl */ `
attribute vec2 aCorner;
attribute vec3 aE;
attribute vec3 aCol;
attribute vec3 aSize;
${NOISE_VS}
${FOG_GLSL}
varying float vFogT;
// (render) the reflecting plane (the square's floor, or a stair flight's slope): a point on it, its axis along x (tilted
// with a slope) and its normal. The optics below run in the plane's own frame, where it is the horizontal y = 0
uniform vec3 uPlaneO;
uniform vec3 uPlaneU;
uniform vec3 uPlaneN;
uniform vec4 uSpread; // x: tail toward the eye, y: tail away, z: width scale, w: min distance
uniform float uCardOn;
varying vec2 vC;
varying vec3 vWorld;
varying vec3 vCol;
varying float vS;
varying vec4 vSeg;
varying vec2 vDir;
vec3 toPlane(vec3 p) { vec3 q = p - uPlaneO; return vec3(dot(q, uPlaneU), dot(q, uPlaneN), dot(q, cross(uPlaneU, uPlaneN))); }
vec3 fromPlane(vec3 l) { return uPlaneO + uPlaneU * l.x + uPlaneN * l.y + cross(uPlaneU, uPlaneN) * l.z; }
void main() {
  vec3 camL = toPlane(uCam), eL = toPlane(aE);
  float c = max(camL.y, 0.05);
  float hB = max(eL.y - aSize.y * 0.5, 0.05);
  float hT = max(eL.y + aSize.y * 0.5, hB + 0.05);
  vec2 d = eL.xz - camL.xz;
  float D = max(length(d), 0.1);
  vec2 dir = d / D;
  vec2 side = vec2(-dir.y, dir.x);
  float sN = D * c / (c + hT), sF = D * c / (c + hB);
  // seen steeply from above (the aerials) a rough wet floor gives a glossy pool round the mirror point, not a long
  // streak: the tails shrink and the card widens as the view leaves grazing (eye-height views keep their streaks)
  float steep = smoothstep(0.25, 0.9, c / D);
  float tail = 1.0 - 0.4 * steep;
  float s0 = mix(sN, uSpread.w, clamp(uSpread.x * tail, 0.0, 1.0));
  float s1 = mix(sF, D, clamp(uSpread.y * tail, 0.0, 1.0));
  float s = mix(s0, s1, aCorner.y);
  // (render, round 14: the spawn frame's dearest pass — 2.25 of 6.8 ms on the M5) the card's width keeps a constant
  // angle all the way down its tail: the old + 2 cm floor made every tail a 30–50 px band across the bottom of the
  // screen, shaded under hundreds of overlapping cards
  float halfW = (0.5 * aSize.x * uSpread.z + 0.02) * (s / D) * (1.0 + 0.5 * steep);
  vec2 xz = camL.xz + dir * s + side * aCorner.x * halfW;
  vWorld = fromPlane(vec3(xz.x, 0.004, xz.y));
  vC = aCorner;
  // below the ground's height (a lantern in the Well, the camera under the square): no streak
  vCol = aCol * aSize.z * step(-0.5, camL.y) * step(0.2, eL.y);
  // (render) an emitter on screen is mirrored by the screen-space reflection (render/reflect.ts): its card fades to
  // uCardOn; the cards stay for what is above or beside the frame (the signs over the street)
  vec4 ce = projectionMatrix * viewMatrix * vec4(aE, 1.0);
  vec2 en = ce.xy / max(ce.w, 1e-4);
  float onScreen = step(0.0, ce.w) * (1.0 - smoothstep(0.8, 1.0, max(abs(en.x), abs(en.y))));
  vCol *= mix(1.0, uCardOn, onScreen);
  vS = s;
  vSeg = vec4(s0, sN, sF, s1);
  vDir = dir;
  // (render) the silk fog's transmittance per corner (it varies slowly along a card; per pixel it was the cards' dearest
  // term under their overdraw)
  vFogT = silkFog(vWorld, 1.0).a;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;
const FS_CARD = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uCam;
uniform vec3 uPlaneN;
uniform vec4 uClip; // (render) the plane's extent (x0, z0, x1, z1): a stair flight's cards end with the flight
varying float vFogT;
${FLAG_GLSL}
${STONES_GLSL}
uniform float uTime;
uniform vec4 uCardK; // x: gain, y: dash contrast, z: jog, w: saturation keep
uniform float uFine;
uniform vec4 uHole; // the Well's open shaft at the square's level (x0, z0, x1, z1): no floor to reflect in
varying vec2 vC;
varying vec3 vWorld;
varying vec3 vCol;
varying float vS;
varying vec4 vSeg;
varying vec2 vDir;
void main() {
  if (max(vCol.r, max(vCol.g, vCol.b)) <= 0.0) discard;
  vec2 p = vWorld.xz;
  if (p.x > uHole.x && p.x < uHole.z && p.y > uHole.y && p.y < uHole.w) discard;
  if (p.x < uClip.x || p.x > uClip.z || p.y < uClip.y || p.y > uClip.w) discard;
  float vBody = vS < vSeg.y ? (vS - vSeg.y) / max(vSeg.y - vSeg.x, 1e-3)
    : (vS < vSeg.z ? (vS - vSeg.y) / max(vSeg.z - vSeg.y, 1e-3) : 1.0 + (vS - vSeg.z) / max(vSeg.w - vSeg.z, 1e-3));
  vec4 st = stone(p, 1.1);
  // the jog, striation and dashes follow stones of the old size (1–1.6 m): on the small slabs they broke every
  // streak into a staircase (round 9); the joints and the puddles are the real ones
  // the old-size stone's jog / seed: a coarse cell hash (it was a second full stone(): flagCell + two noises)
  vec2 cb = floor((p * 0.7 + 37.0) / vec2(1.1, 0.62));
  vec4 sb = vec4(0.0, h12(cb + 17.0), 0.0, h12(cb) * 2.0 - 1.0);
  float prof = vBody < 0.0 ? pow(clamp(1.0 + vBody, 0.0, 1.0), 1.4) : (vBody > 1.0 ? pow(clamp(2.0 - vBody, 0.0, 1.0), 2.0) : 1.0);
  float along = dot(p - uCam.xz, vDir);
  float fa = max(fwidth(along), 1e-5);
  float fine = (vnoise(vec2(along * 38.0, vC.x * 0.7 + uTime * 0.9)) - 0.5) * 2.0 * (1.0 - smoothstep(0.009, 0.022, fa))
             + (vnoise(vec2(along * 95.0, vC.x * 1.3 - uTime * 1.3)) - 0.5) * 1.4 * (1.0 - smoothstep(0.0035, 0.009, fa))
             + (vnoise(vec2(along * 14.0, vC.x * 0.5 + uTime * 0.6)) - 0.5) * 1.2 * smoothstep(0.012, 0.03, fa);
  float x = vC.x + sb.w * uCardK.z * 0.5 + (vnoise(vec2(along * 2.5, uTime * 0.5)) - 0.5) * 0.3 + fine * uFine;
  float across = 1.0 - smoothstep(0.5, 1.0, abs(x));
  float stria = 0.7 + 0.3 * vnoise(vec2(vC.x * 11.0 + sb.y * 5.0, along * 1.5));
  float dash = mix(1.0, smoothstep(0.15, 0.75, vnoise(vec2(along * 17.0, x * 2.5 + sb.y * 9.0))), uCardK.y) * stria;
  float grain = 0.72 + 0.28 * vnoise(p * 97.0);
  dash *= grain;
  float gloss = mix(0.45, 1.0, st.z) * (0.65 + 0.7 * sb.y);
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.3 + 0.7 * pow(clamp(1.0 - dot(V, uPlaneN), 0.0, 1.0), 3.0);
  vec3 col = vCol * prof * across * dash * gloss * fres * (1.0 - st.x * 0.8) * uCardK.x;
  float m = max(col.r, max(col.g, col.b));
  col = mix(col, col / max(m, 1e-4) * min(m, 1.0), uCardK.w * step(1.0, m));
  col *= vFogT;
  gl_FragColor = vec4(col, 0.0);
}
`;

export const STREAK_LOOK = { cardGain: 1.15, cardDash: 0.45, cardJog: 0.45, tailNear: 0.9, tailFar: 0.95, cardWidth: 0.4, fine: 0.4 } as const;

/** a reflecting plane: a point on it, its axis along x (tilted with a slope), its normal, and its extent (x0, z0, x1, z1) */
export interface StreakPlane { o: Vector3; u: Vector3; n: Vector3; clip: Vector4 }

const NO_CLIP = new Vector4(-1e5, -1e5, 1e5, 1e5);

export function buildStreaks(shared: Shared, emitters: readonly Emitter[], hole: Vector4, plane?: StreakPlane): Mesh {
  const L = STREAK_LOOK;
  const P = plane ?? { o: new Vector3(0, shared.u.uGroundY.value, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: NO_CLIP };
  const mat = new ShaderMaterial({
    uniforms: {
      ...shared.u,
      uPlaneO: { value: P.o.clone() }, uPlaneU: { value: P.u.clone().normalize() }, uPlaneN: { value: P.n.clone().normalize() }, uClip: { value: P.clip.clone() },
      uSpread: { value: new Vector4(L.tailNear, L.tailFar, L.cardWidth, 0.6) },
      uCardK: { value: new Vector4(L.cardGain, L.cardDash, L.cardJog, 1) },
      uFine: { value: L.fine },
      uCardOn: { value: 1 },
      uHole: { value: hole },
    },
    vertexShader: VS_CARD, fragmentShader: FS_CARD,
    transparent: true, depthWrite: false,
    ...ADD_KEEP_ALPHA,
  });
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.setAttribute('aCorner', new Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  const e = new Float32Array(emitters.length * 3), col = new Float32Array(emitters.length * 3), size = new Float32Array(emitters.length * 3);
  emitters.forEach((m, i) => {
    e.set([m.at.x, m.at.y, m.at.z], i * 3);
    col.set([m.color.r, m.color.g, m.color.b], i * 3);
    size.set([m.w, m.h, m.power], i * 3);
  });
  g.setAttribute('aE', new InstancedBufferAttribute(e, 3));
  g.setAttribute('aCol', new InstancedBufferAttribute(col, 3));
  g.setAttribute('aSize', new InstancedBufferAttribute(size, 3));
  g.instanceCount = emitters.length;
  const m = new Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 4;
  return m;
}

/** the stair-street's flights and landings, as world/stairstreet.ts exports them */
export interface StairPlan {
  flights: readonly { x0: number; x1: number; y0: number }[];
  landings: readonly { x0: number; x1: number; y: number }[];
  rise: number;
  run: number;
  z0: number;
  z1: number;
}

/**
 * (render, round 14, dome C1) the wet stair-street's streaks: per flight, a card set on the plane half a rise under the
 * nosing line (y = y0 + rise / 2 + (x − x0) · rise / run) — the treads' backs show through the depth test, the fronts
 * hide under their nosings — and a flat set on each landing. One draw per flight / landing.
 */
export function stairStreaks(shared: Shared, emitters: readonly Emitter[], plan: StairPlan): Mesh[] {
  const slope = plan.rise / plan.run;
  const out: Mesh[] = [];
  const none = new Vector4(0, 0, 0, 0);
  for (const f of plan.flights) {
    out.push(buildStreaks(shared, emitters, none, {
      o: new Vector3(f.x0, f.y0 + plan.rise * 0.5, 0), u: new Vector3(1, slope, 0), n: new Vector3(-slope, 1, 0),
      clip: new Vector4(f.x0, plan.z0, f.x1, plan.z1),
    }));
  }
  for (const l of plan.landings) {
    out.push(buildStreaks(shared, emitters, none, {
      o: new Vector3(l.x0, l.y, 0), u: new Vector3(1, 0, 0), n: new Vector3(0, 1, 0), clip: new Vector4(l.x0, plan.z0, l.x1, plan.z1),
    }));
  }
  return out;
}

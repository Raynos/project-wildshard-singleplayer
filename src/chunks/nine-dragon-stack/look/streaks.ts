// Wet-ground streaks, merged from the neon lab (src/dev/nd-lab/neon/wetground.ts, "cards"): one instanced additive
// card per emitter, lying where optics puts its reflection — between the mirror points of the emitter's top and bottom,
// c / (c + h) of the way from the eye — stretched along the view ray by the gloss, broken on the same flagstone joints
// as the ground (STONES_GLSL, shared with the Jiehua ground), with a jagged two-octave ripple edge, striation, dashes and
// grain. It replaces the quarter-res mirror pass. It assumes the ground at `uGroundY` (the square and its street).
import {
  Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial,
  Uint16BufferAttribute, Vector4,
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
uniform float uGroundY;
uniform vec4 uSpread; // x: tail toward the eye, y: tail away, z: width scale, w: min distance
uniform float uCardOn;
varying vec2 vC;
varying vec3 vWorld;
varying vec3 vCol;
varying float vS;
varying vec4 vSeg;
varying vec2 vDir;
void main() {
  float c = max(uCam.y - uGroundY, 0.05);
  float hB = max(aE.y - aSize.y * 0.5 - uGroundY, 0.05);
  float hT = max(aE.y + aSize.y * 0.5 - uGroundY, hB + 0.05);
  vec2 d = aE.xz - uCam.xz;
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
  float halfW = (0.5 * aSize.x * (s / D) * uSpread.z + 0.02) * (1.0 + 0.5 * steep);
  vec2 xz = uCam.xz + dir * s + side * aCorner.x * halfW;
  vWorld = vec3(xz.x, uGroundY + 0.004, xz.y);
  vC = aCorner;
  // below the ground's height (a lantern in the Well, the camera under the square): no streak
  vCol = aCol * aSize.z * step(uGroundY - 0.5, uCam.y) * step(uGroundY + 0.2, aE.y);
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
  float vBody = vS < vSeg.y ? (vS - vSeg.y) / max(vSeg.y - vSeg.x, 1e-3)
    : (vS < vSeg.z ? (vS - vSeg.y) / max(vSeg.z - vSeg.y, 1e-3) : 1.0 + (vS - vSeg.z) / max(vSeg.w - vSeg.z, 1e-3));
  vec4 st = stone(p, 1.1);
  // the jog, striation and dashes follow stones of the old size (1–1.6 m): on the small slabs they broke every
  // streak into a staircase (round 9); the joints and the puddles are the real ones
  vec4 sb = stone(p * 0.7 + 37.0, 1.1);
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
  float grain = 0.72 + 0.28 * (vnoise(p * 61.0) * 0.5 + vnoise(p * 157.0) * 0.5);
  dash *= grain;
  float gloss = mix(0.45, 1.0, st.z) * (0.65 + 0.7 * sb.y);
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.3 + 0.7 * pow(clamp(1.0 - V.y, 0.0, 1.0), 3.0);
  vec3 col = vCol * prof * across * dash * gloss * fres * (1.0 - st.x * 0.8) * uCardK.x;
  float m = max(col.r, max(col.g, col.b));
  col = mix(col, col / max(m, 1e-4) * min(m, 1.0), uCardK.w * step(1.0, m));
  col *= vFogT;
  gl_FragColor = vec4(col, 0.0);
}
`;

export const STREAK_LOOK = { cardGain: 1.15, cardDash: 0.45, cardJog: 0.45, tailNear: 0.9, tailFar: 0.95, cardWidth: 0.4, fine: 0.4 } as const;

export function buildStreaks(shared: Shared, emitters: readonly Emitter[], hole: Vector4): Mesh {
  const L = STREAK_LOOK;
  const mat = new ShaderMaterial({
    uniforms: {
      ...shared.u,
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

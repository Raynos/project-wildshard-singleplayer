import type { PosedInstancesLook } from '@wildshard/sdk/looks/posedInstances';

/**
 * Pine Hollow's small wildlife (PINE-HOLLOW-REMASTER PH-M5) as one posed-instances draw (@wildshard/sdk/looks/posedInstances):
 * the raven, the great grey owl, the pileated woodpecker and the snowshoe hare (the generated birds in their place once
 * they land), read by ../models/wildlife.ts WildlifeMesh. The vertex edits turn each part (aInfo.x: the ids in
 * ../models/wildlife.ts `P`) about its pivot from the instance's two vec4s — birds (flap, fold, head yaw, head pitch) +
 * (kind, leg tuck, body pitch, pose); the hare (hind legs, fore legs, head pitch, ears back) + (kind, head yaw, –, –) —
 * and collapse another kind's (or the other pose's) vertices to a point; `@{hareNeck}` is spliced from HARE_NECK. The
 * fragment edits sample the birds' atlas, take the per-vertex roughness and light the owl's eye-shine at night (uWlGlow).
 */
export const WILDLIFE_LOOK: PosedInstancesLook = {
  name: 'pine-wildlife', patch: 'pine.wildlife', key: 'pine-wildlife', roughness: 0.8, metalness: 0, doubleSide: true,
  glowUniform: 'uWlGlow', atlasUniform: 'uWlTex',
  edits: [
    { stage: 'vertex', find: '#include <common>', put: /* glsl */`#include <common>
attribute vec3 aPivot; attribute vec4 aInfo; attribute vec4 aTexV;   // (part, kind, roughness, emissive), (uv, textured, pose)
attribute vec4 aAnim; attribute vec4 aAnim2;
varying float vWlRough; varying float vWlEmis; varying vec2 vWlUv; varying float vWlTex;
vec3 wlPos;
vec3 wlRx(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 wlRy(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 wlRz(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
vec3 wlRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }` },
    { stage: 'vertex', find: '#include <beginnormal_vertex>', put: /* glsl */`
vec3 objectNormal = vec3( normal );
{
  vec3 p = position, n = objectNormal, pv = aPivot;
  float part = aInfo.x, aKind = aInfo.y, aVar = aTexV.w;
  vWlRough = aInfo.z; vWlEmis = aInfo.w; vWlUv = aTexV.xy; vWlTex = aTexV.z;
  if (part == 1.0 || part == 2.0) {
    // a wing: shortened as it folds, flapped about the body axis at the shoulder; folding also stands its chord on edge
    // (leading edge up) and sweeps it back, so a folded wing lies flat along the flank over the tail, not out like a plate
    float side = part == 1.0 ? -1.0 : 1.0, fold = aAnim.y, shut = smoothstep(0.4, 1.0, fold);
    vec3 q = p - pv;
    q.x *= 1.0 - 0.42 * fold; q.z *= 1.0 - 0.5 * shut;
    q = wlRz(q, aAnim.x * side); n = wlRz(n, aAnim.x * side);
    q = wlRx(q, -1.35 * shut); n = wlRx(n, -1.35 * shut);
    float sw = fold * 1.5 * side;
    q = wlRy(q, sw); n = wlRy(n, sw);
    q.x += side * 0.45 * abs(pv.x) * shut;
    p = q + pv;
  } else if (part == 3.0) {
    // the head: pitched (+ = down) about the neck, then turned about the world's vertical (the body may be upright)
    vec3 q = wlRx(p - pv, aAnim.w); n = wlRx(n, aAnim.w);
    vec3 up = vec3(0.0, cos(aAnim2.z), sin(aAnim2.z));
    q = wlRot(q, up, aAnim.z); n = wlRot(n, up, aAnim.z);
    p = q + pv;
  } else if (part == 4.0) {
    float a = aAnim2.y * 1.4;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 13.0 || part == 14.0) {
    float a = part == 13.0 ? aAnim.x : aAnim.y;
    p = wlRx(p - pv, a) + pv; n = wlRx(n, a);
  } else if (part == 11.0 || part == 12.0) {
    if (part == 12.0) { p = wlRx(p - pv, -aAnim.w) + pv; n = wlRx(n, -aAnim.w); }
    vec3 hn = vec3(@{hareNeck});
    vec3 q = wlRy(p - hn, aAnim2.y); n = wlRy(n, aAnim2.y);
    q = wlRx(q, aAnim.z); n = wlRx(n, aAnim.z);
    p = q + hn;
  }
  // another kind's vertex collapses to a point: this instance draws only its own model (and, for a modelled bird, only
  // its pose: perched or flying, aAnim2.w)
  if (abs(aKind - aAnim2.x) > 0.5 || (aVar > -0.5 && abs(aVar - aAnim2.w) > 0.5)) p = vec3(0.0);
  wlPos = p; objectNormal = n;
}` },
    { stage: 'vertex', find: '#include <begin_vertex>', put: 'vec3 transformed = wlPos;' },
    { stage: 'fragment', find: '#include <common>', put: `#include <common>\nvarying float vWlRough; varying float vWlEmis; uniform float uWlGlow; varying vec2 vWlUv; varying float vWlTex; uniform sampler2D uWlTex;
// the owl's eyes in the atlas: its yellow irises (linear), where the eye-shine glows at night
float wlEye(vec3 t) { return smoothstep(0.3, 0.5, t.r) * smoothstep(0.18, 0.3, t.g) * (1.0 - smoothstep(0.2, 0.45, t.b / max(t.r, 1e-3))); }` },
    { stage: 'fragment', find: '#include <color_fragment>', put: `#include <color_fragment>\nvec3 wlTexel = vec3(1.0);\nif (vWlTex > 0.5) { wlTexel = texture2D(uWlTex, vWlUv).rgb; diffuseColor.rgb *= wlTexel; }` },
    { stage: 'fragment', find: '#include <roughnessmap_fragment>', put: `#include <roughnessmap_fragment>\nroughnessFactor = vWlRough;` },
    { stage: 'fragment', find: '#include <emissivemap_fragment>', put: `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.22) * vWlEmis * uWlGlow * 1.4 * (vWlTex > 0.5 ? wlEye(wlTexel) : 1.0);` },
  ],
};

// Lab P6 "light" (E169): WINDOW GLOW — lit windows (and shop fronts, lanterns) bleeding warm light into the silk fog
// around them at distance, without blowing out. Zero extra passes: it rides in the ALPHA channel of the clean room's
// existing bloom pyramid (post.ts), which carried a constant 1.0 until now.
//  1. prefilter (½ res): alpha = the warm-glow source: how far a pixel's brightest channel sits over a low threshold,
//     × its warmth ((r − b) / r), × its distance (the colour target's alpha is near / viewZ, so no depth read). Near
//     things never glow (the fog between you and them is thin); neon keeps its own RGB bloom untouched.
//  2. down / up chains carry alpha like rgb (their shaders only change `1.0` → the sampled alpha).
//  3. composite: warm amber × (tight.a · halo + wide.a · veil), kept off anything nearer than the glow's own
//     distance (a dark pillar in front of a lit facade stays dark), before the shoulder.
import { Color, Vector4 } from 'three';

export function glowUniforms(): { uGlow: { value: Vector4 }; uGlow2: { value: Vector4 }; uGlowCol: { value: Color } } {
  return {
    /** x: source gain, y: threshold on the brightest channel, z / w: distance ramp (m) where the glow starts / is full
     *  (the lab's pick: 0.22, 6, 40 — lab.ts DEFAULTS) */
    uGlow: { value: new Vector4(1, 0.22, 6, 40) },
    /** x: halo (the ¼-res mip), y: veil (the summed pyramid), z: near cut (m), w: on / off (the pick: 0.6, 0.15) */
    uGlow2: { value: new Vector4(0.6, 0.15, 10, 1) },
    uGlowCol: { value: new Color(0xffa45c) },
  };
}

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

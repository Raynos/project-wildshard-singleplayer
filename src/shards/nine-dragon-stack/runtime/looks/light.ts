// Raw post helpers retained for the post-chain owner. Surface lighting and halos use graphs.
export const LIGHTVOL_GLSL = /* glsl */ `
uniform float uLpMax;
uniform highp sampler3D uLpVolA;
uniform highp sampler3D uLpVolB;
uniform vec3 uLpMinA;
uniform vec3 uLpInvA;
uniform vec3 uLpMinB;
uniform vec3 uLpInvB;
uniform vec4 uLpCut;
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
vec3 lpRaw(vec3 wp) {
  vec4 s = wp.y > uLpMinA.y ? lpSample(uLpVolA, wp, uLpMinA, uLpInvA) : lpSample(uLpVolB, wp, uLpMinB, uLpInvB);
  return lpKnee(s.rgb * s.rgb * uLpMax);
}
`;

// ── the window glow (look/light/glow.ts): it rides in the bleed pyramid's alpha ──
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


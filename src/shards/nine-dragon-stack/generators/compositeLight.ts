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

// ── the grade (look/light.ts) ──
/** the composite's last colour step: `vec3 gradeLut(vec3 srgb)`, one trilinear fetch of the learned LUT; `@{lutScale}` /
 *  `@{lutBias}` are the LUT size's texel-centre mapping (look/light.ts) */
export const GRADE_GLSL = /* glsl */ `
uniform highp sampler3D uLut;
uniform float uLutAmt;
vec3 gradeLut(vec3 srgb) {
  if (uLutAmt <= 0.0) return srgb;
  vec3 g = texture(uLut, clamp(srgb, 0.0, 1.0) * @{lutScale} + @{lutBias}).rgb;
  return mix(srgb, g, uLutAmt);
}
`;


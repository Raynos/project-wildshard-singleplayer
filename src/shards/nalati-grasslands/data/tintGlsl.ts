// SHARD-PLATFORM M3 (look-family rows): look/tint.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/tint.ts passes (another module's GLSL, a number from the layout).
export const TINT_GLSL = {
  V2_TINT_GLSL: /* glsl */`
uniform vec3 uV2KeyTint;
uniform float uV2Moon;
uniform vec3 uV2Light;
uniform float uV2Veil;
uniform vec3 uV2VeilCol;
uniform float uV2Flash;
vec3 v2Regrade(vec3 c) {
  c *= uV2KeyTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, l * vec3(0.5, 0.62, 1.0), uV2Moon * 0.8);
  c *= uV2Light;
  c = mix(c, uV2VeilCol, uV2Veil);
  return c + uV2Flash * l * vec3(0.8, 0.85, 1.0);
}
`,
};

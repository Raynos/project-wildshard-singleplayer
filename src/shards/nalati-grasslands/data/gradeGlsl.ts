// SHARD-PLATFORM M3 (look-family rows): look/grade.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/grade.ts passes (another module's GLSL, a number from the layout).
export const GRADE_GLSL = {
  V2_GRADE_GLSL: /* glsl */`
uniform float uV2Exposure;
uniform float uV2Sat;
uniform float uV2LookSat;
const vec3 V2_LUM = vec3(0.2126, 0.7152, 0.0722);
const vec3 V2_SHADOW = vec3(@{SHADOW_TONE});
const vec3 V2_LIGHT = vec3(@{LIGHT_TONE});
vec3 v2Grade(vec3 x) {
  x = max(x, vec3(0.0)) * 1.12 * uV2Exposure;
  vec3 c = x * (1.0 + x / 9.0) / (1.0 + x);
  float l = dot(c, V2_LUM);
  c = mix(vec3(l), c, uV2Sat);
  c *= mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, l));
  c = clamp(c, 0.0, 1.0);
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;
  return mix(vec3(dot(c, V2_LUM)), c, uV2LookSat);
}
vec3 v2Ungrade(vec3 y) {
  y = clamp(y, 0.0, 1.0);
  vec3 c = y;
  for (int i = 0; i < 3; i++) {
    vec3 f = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65 - y;
    c = clamp(c - f / (2.1 * c * (1.0 - c) + 0.65), 0.0, 1.0);
  }
  vec3 t = mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, dot(c, V2_LUM)));
  vec3 b = c / t;
  t = mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, dot(b, V2_LUM)));
  b = c / t;
  float l = dot(b, V2_LUM);
  b = max(vec3(l) + (b - vec3(l)) / uV2Sat, vec3(0.0));
  vec3 x = 4.5 * (-(1.0 - b) + sqrt((1.0 - b) * (1.0 - b) + 4.0 * b / 9.0));
  return x / (1.12 * uV2Exposure);
}
`,
  effect: /* glsl */`
      @{V2_GRADE_GLSL}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(v2Grade(inputColor.rgb), inputColor.a);
      }`,
};

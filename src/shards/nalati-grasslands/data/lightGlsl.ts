// SHARD-PLATFORM M3 (look-family rows): look/light.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/light.ts passes (another module's GLSL, a number from the layout).
export const LIGHT_GLSL = {
  V2_OLIVE_GLSL: /* glsl */`
vec3 v2Olive(vec3 c) {
  float gr = smoothstep(0.02, 0.45, (c.g - max(c.r, c.b)) / max(c.g, 1e-3));
  vec3 olive = vec3(c.r * 1.12, mix(c.g, c.r * 1.2, 0.68), c.b * 0.7) * 1.3;
  return mix(c, olive, gr);
}
`,
};

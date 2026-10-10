// SHARD-PLATFORM M3 (look-family rows): look/bake.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what look/bake.ts passes (another module's GLSL, a number from the layout).
export const LOOK_BAKE_GLSL_DATA = {
  LOOK_BAKE_GLSL: /* glsl */`
uniform sampler2D tBakeShadow;
uniform mat4 uBakeMatrix;
uniform vec3 uBakeInfo;
uniform sampler2D tBakeContact;
uniform vec4 uContactXf;
// 1 = lit, 0 = in a static caster's shadow (the key light's direction at the last bake)
float bakedShadow(vec3 wp) {
  if (uBakeInfo.x < 0.5) return 1.0;
  vec4 c = uBakeMatrix * vec4(wp, 1.0);
  vec3 p = c.xyz / c.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float z = p.z - uBakeInfo.y, t = uBakeInfo.z * 0.75;
  float s = step(z, texture(tBakeShadow, p.xy + vec2(-t, -t)).r) + step(z, texture(tBakeShadow, p.xy + vec2(t, -t)).r)
          + step(z, texture(tBakeShadow, p.xy + vec2(-t, t)).r) + step(z, texture(tBakeShadow, p.xy + vec2(t, t)).r);
  return s * 0.25;
}
// 1 = open ground … darker where something stands close by (the blurred height of the casters above the ground)
float bakedContact(vec3 wp) {
  if (uContactXf.w <= 0.0) return 1.0;
  vec2 uv = vec2((wp.x - uContactXf.x) * uContactXf.z, 1.0 - (wp.z - uContactXf.y) * uContactXf.z);   // the top-down camera's image: right = +x, up = −z
  float near = textureLod(tBakeContact, uv, 2.0).r, wide = textureLod(tBakeContact, uv, 3.5).r;
  float occ = smoothstep(0.05, 1.4, near) * 0.55 + smoothstep(0.05, 1.6, wide) * 0.45;
  return 1.0 - uContactXf.w * occ;
}
`,
  planeVertex: /* glsl */`
      #include <common>
      #include <batching_pars_vertex>
      void main() {
        #include <batching_vertex>
        #include <begin_vertex>
        #include <project_vertex>
      }`,
  bakeVertex: /* glsl */`
      #include <common>
      #include <batching_pars_vertex>
      varying vec3 vWP;
      void main() {
        #include <batching_vertex>
        #include <begin_vertex>
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          wp = batchingMatrix * wp;
        #endif
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
  bakeFragment: /* glsl */`
      uniform sampler2D tHeight; uniform vec4 uHXf;
      varying vec3 vWP;
      void main() {
        float g = texture2D(tHeight, (vWP.xz - uHXf.xy) * uHXf.z).r;
        gl_FragColor = vec4(clamp(vWP.y - g, 0.0, 8.0), 0.0, 0.0, 1.0);
      }`,
};

// SHARD-PLATFORM M3 (look-family rows): combat/stormTitanLook.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what combat/stormTitanLook.ts passes (another module's GLSL, a number from the layout).
export const STORM_TITAN_GLSL = {
  TITAN_NOISE_GLSL: /* glsl */`
float tH3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tN3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tH3(i), tH3(i + vec3(1, 0, 0)), f.x), mix(tH3(i + vec3(0, 1, 0)), tH3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(tH3(i + vec3(0, 0, 1)), tH3(i + vec3(1, 0, 1)), f.x), mix(tH3(i + vec3(0, 1, 1)), tH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float tF3(vec3 p) { return tN3(p) * 0.55 + tN3(p * 2.13 + 7.1) * 0.3 + tN3(p * 4.37 - 3.3) * 0.15; }
`,
  beginVertex: /* glsl */`#include <begin_vertex>
      #ifdef USE_INSTANCING
        float gph = dot(instanceMatrix[3].xyz, vec3(0.13, 0.071, 0.113));
      #else
        float gph = 0.0;
      #endif
      // cauliflower: lumps of 3D noise on the unit puff, slowly boiling, and a slow churn on top
      float cn = tF3(position * 2.2 + vec3(gph * 3.1, uT * 0.12 + gph, 0.0));
      transformed += normal * ((cn - 0.5) * 0.55 + 0.1 * sin(uT * 1.1 + gph + position.y * 2.7 + position.x * 1.9));`,
  projectVertex: /* glsl */`#include <project_vertex>
      #ifdef USE_INSTANCING
        vGW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vGN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      #else
        vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGN = normalize(mat3(modelMatrix) * normal);
      #endif`,
  fragmentCommon: /* glsl */`#include <common>
      uniform float uT; uniform vec3 uHeart; uniform float uGlow; uniform float uFlash; uniform float uAlpha; uniform vec3 uFogC; uniform float uFog;
      varying vec3 vGW;
      varying vec3 vGN;
      @{TITAN_NOISE_GLSL}`,
  ditheringFragment: /* glsl */`#include <dithering_fragment>
      vec3 gN = normalize(vGN);
      vec3 gV = normalize(cameraPosition - vGW);
      // the cumulus's own lumps: the normal bumped by world noise (continuous across the puffs)
      vec3 bp = vGW * 0.38 + vec3(0.0, uT * 0.05, 0.0);
      float b0 = tF3(bp);
      vec3 grad = vec3(tF3(bp + vec3(0.15, 0.0, 0.0)) - b0, tF3(bp + vec3(0.0, 0.15, 0.0)) - b0, tF3(bp + vec3(0.0, 0.0, 0.15)) - b0) / 0.15;
      gN = normalize(gN - (grad - gN * dot(grad, gN)) * 0.42 + vec3(0.0, 1e-4, 0.0));
      float up = 0.5 + 0.5 * dot(gN, normalize(vec3(-0.3, 0.88, 0.35)));
      float cav = smoothstep(0.22, 0.72, b0);
      float rim = pow(clamp(1.0 - dot(gN, gV), 0.0, 1.0), 3.0);
      vec3 alb = gl_FragColor.rgb;   // per puff: how exposed it is (the core of him is dark)
      // storm cumulus: near-black crevices, a slate body, silver-lit crowns
      vec3 cloud = alb * mix(vec3(0.045, 0.05, 0.08), vec3(0.24, 0.26, 0.33), smoothstep(0.05, 0.95, up));
      cloud += alb * vec3(0.55, 0.58, 0.68) * pow(max(up - 0.62, 0.0) / 0.38, 2.0);
      cloud *= mix(0.72, 1.06, cav);
      cloud += vec3(0.32, 0.37, 0.52) * rim * 0.2;
      // the heart: a spiral of blue-violet light through the cloud round it
      vec3 hd3 = vGW - uHeart; float hd = length(hd3);
      float spiral = 0.5 + 0.5 * sin(atan(hd3.y, hd3.x + 1e-3) * 2.0 + hd * 0.22 - uT * 2.4);
      float inner = exp(-hd / 7.0) * uGlow * mix(0.4, 1.6, spiral);
      cloud += vec3(0.42, 0.48, 1.55) * inner * 0.9;
      // lightning veins: ridged world noise, crawling; patches flicker on and off, all of them blaze on a flash
      vec3 vp = vGW * 0.05 + vec3(0.0, -uT * 0.07, uT * 0.03);
      float rn = abs(tN3(vp + (tN3(vp * 3.1 + 5.0) - 0.5) * 0.35) - 0.5);
      float vein = 1.0 - smoothstep(0.006, 0.028, rn);
      float patchV = smoothstep(0.4, 0.62, tN3(vGW * 0.022 + vec3(floor(uT * 6.0) * 0.37)));
      float vk = vein * (patchV * 0.9 + inner * 1.4 + uFlash * 1.6);
      cloud += vec3(0.8, 0.9, 2.6) * vk;
      cloud += vec3(0.3, 0.34, 0.6) * uFlash * (0.25 + up * 0.5);
      // a cumulus edge is thin vapour: the silhouette melts into the storm sky behind it (soft, no hard ball outlines)
      // (the outermost rim is stippled away — a fuzzy vapour edge, still opaque and unsorted — and greys toward the sky)
      float edge = 1.0 - max(dot(normalize(vGN), gV), 0.0);
      if (smoothstep(0.62, 0.97, edge) > fract(sin(dot(floor(gl_FragCoord.xy), vec2(41.37, 17.91))) * 43758.5453)) discard;
      gl_FragColor.rgb = mix(cloud, uFogC * 0.8, clamp(uFog + edge * edge * 0.3, 0.0, 1.0));`,
  FLAME_VS: /* glsl */`
@{TITAN_NOISE_GLSL}
attribute float aH; attribute float aS;
uniform float uT; uniform vec2 uWind;
varying float vH; varying float vHeat; varying vec3 vN; varying vec3 vW; varying float vSeed;
void main() {
  // per instance (instanceColor): r = heat 0..1, g = the front (1 = the downwind edge), b = seed
  float heat = instanceColor.r, seed = instanceColor.b + aS;
  vec3 p = position;
  float y01 = aH;
  // lick: the radius breathes with noise running up the tongue; the tip sways and leans downwind
  float lick = tN3(vec3(p.x * 1.3 + seed * 9.0, p.y * 1.4 - uT * 5.5, p.z * 1.3));
  p.xz *= 0.7 + 0.6 * lick;
  p.y *= 0.8 + 0.35 * sin(uT * 8.0 + seed * 17.0) * y01 + 0.2 * lick;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float s = length(instanceMatrix[1].xyz);
  wp.xz += (uWind * (0.9 + 0.5 * instanceColor.g) + vec2(sin(uT * 6.3 + seed * 11.0), cos(uT * 5.1 + seed * 7.0)) * 0.35) * y01 * y01 * s * 1.6;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vW = wp.xyz;
  vH = y01; vHeat = heat; vSeed = seed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
  FLAME_FS: /* glsl */`
@{TITAN_NOISE_GLSL}
uniform float uT;
varying float vH; varying float vHeat; varying vec3 vN; varying vec3 vW; varying float vSeed;
void main() {
  // a volume, not a card: dense where you look through the middle, gone at the silhouette (per pixel — no facets);
  // tongues of flame: noise rushing up through it, tearing the top into licks
  float edge = clamp(abs(dot(normalize(vN), normalize(cameraPosition - vW))), 0.0, 1.0);
  float body = edge * edge;
  float n = tF3(vec3(vW.x * 1.4 + vSeed * 7.0, vW.y * 0.9 - uT * 3.6, vW.z * 1.4));
  float tongue = smoothstep(0.34, 0.66, n + (1.0 - vH) * 0.42 - vH * 0.3);
  float a = body * tongue * (1.0 - smoothstep(0.55, 1.0, vH)) * (0.35 + 0.65 * vHeat);
  vec3 hot = vec3(3.2, 2.4, 1.2), mid = vec3(3.0, 1.1, 0.2), cool = vec3(1.4, 0.24, 0.04);
  vec3 c = mix(mix(hot, mid, smoothstep(0.0, 0.35, vH)), cool, smoothstep(0.35, 0.9, vH));
  gl_FragColor = vec4(c * a, 1.0);
}`,
  SMOKE_VS: /* glsl */`
@{TITAN_NOISE_GLSL}
uniform float uT;
varying vec3 vN; varying vec3 vW; varying vec3 vI;
void main() {
  // per instance (instanceColor): r = age 0..1, g = fire glow, b = seed
  vI = instanceColor;
  vec3 p = position;
  float n = tF3(p * 1.5 + vec3(instanceColor.b * 13.0, uT * 0.25, 0.0));
  p += normal * (n - 0.5) * 0.7;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
  SMOKE_FS: /* glsl */`
@{TITAN_NOISE_GLSL}
uniform vec3 uFogC; uniform float uT; uniform float uFlash;
varying vec3 vN; varying vec3 vW; varying vec3 vI;
void main() {
  float age = vI.r;
  // fade in fast, thin out slowly: dithered (opaque, depth-correct, no sorting)
  float lump = tF3(vW * 0.35 + vec3(0.0, -uT * 0.3, 0.0));
  vec3 n = normalize(vN);
  // a soft volume: thick through the middle, thin at the silhouette, lumpy
  float thick = pow(clamp(abs(dot(n, normalize(cameraPosition - vW))), 0.0, 1.0), 0.8);
  float alpha = smoothstep(0.0, 0.08, age) * pow(clamp(1.0 - age, 0.0, 1.0), 1.2) * thick * (0.7 + 0.8 * lump);
  float up = 0.5 + 0.5 * n.y;
  // soot-dark while young, greying as it thins; the fire under it lights its belly orange
  vec3 c = mix(vec3(0.03, 0.028, 0.026), vec3(0.2, 0.2, 0.22), smoothstep(0.1, 0.8, age)) * mix(0.55, 1.25, up) * mix(0.7, 1.15, lump);
  c += vec3(1.6, 0.55, 0.12) * vI.g * pow(clamp(1.0 - up, 0.0, 1.0), 2.0) * (1.0 - smoothstep(0.0, 0.3, age)) * 0.45;
  c += vec3(0.3, 0.34, 0.55) * uFlash * up * 0.4;
  c = mix(c, uFogC, smoothstep(0.3, 1.0, age) * 0.45);
  gl_FragColor = vec4(c, clamp(alpha, 0.0, 0.92));
}`,
};

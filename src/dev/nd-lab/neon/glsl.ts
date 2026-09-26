// Shared GLSL chunks for the neon lab (E169 lab P2): hashes + value noise, the silk fog, the neon flicker, the emitter
// spill loop and the flagstone pattern (shared by the ground and the streak cards so a streak breaks on the same joints).

export const NOISE = /* glsl */ `
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** silk fog: distance fog toward a height-graded silk colour; neon is fogged at half strength by the callers */
export const FOG = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uFogCol;
uniform vec3 uFogTop;
uniform vec4 uFog; // x: density /m, y: max, z: height of the top colour, w: unused
vec3 fogCol(vec3 wp) { return mix(uFogCol, uFogTop, smoothstep(0.0, uFog.z, wp.y)); }
float fogAmt(vec3 wp) { return min(1.0 - exp(-distance(wp, uCam) * uFog.x), uFog.y); }
`;

/** a tube that stutters: most signs are steady (seed 0), a few drop out for a beat */
export const FLICKER = /* glsl */ `
uniform float uTime;
float flick(float seed) {
  if (seed <= 0.0) return 1.0;
  float t = uTime * (0.9 + seed * 2.0) + seed * 57.0;
  float n = h11(floor(t) + seed * 13.0);
  float m = h11(floor(t * 14.0) + seed * 7.0);
  return n < 0.3 ? (m < 0.5 ? 0.08 : 1.0) : 1.0;
}
`;

export const MAX_LIGHTS = 16;

/** coloured spill from the nearest emitters (signs, lanterns): the lab's stand-in for vertex-baked neon spill */
export const LIGHTS = /* glsl */ `
#define NL ${MAX_LIGHTS}
uniform vec4 uLPos[NL]; // xyz, w: 1 / radius²
uniform vec3 uLCol[NL];
vec3 spill(vec3 wp, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < NL; i++) {
    vec3 d = uLPos[i].xyz - wp;
    float r2 = dot(d, d);
    float nd = max(dot(n, d * inversesqrt(max(r2, 1e-4))), 0.0) * 0.75 + 0.25;
    acc += uLCol[i] * nd / (1.0 + r2 * uLPos[i].w);
  }
  return acc;
}
`;

/**
 * Wet granite flagstones in world xz: courses along x (running bond), `stone()` returns
 * x: joint coverage (antialiased, fades to wash below ~0.7 px), y: stone id hash, z: puddle (0 dry … 1 standing water),
 * w: stone tilt (-1..1: how far this stone bends a reflection sideways).
 */
export const STONES = /* glsl */ `
vec4 stone(vec2 p, float px) {
  float rh = 0.82;
  float r = floor(p.y / rh);
  float off = h11(r * 3.7) * 1.4;
  float L = 1.05 + 0.55 * h11(r * 9.1 + 2.0);
  float cx = floor((p.x + off) / L);
  float fx = fract((p.x + off) / L), fy = fract(p.y / rh);
  vec2 fw = max(fwidth(p), vec2(1e-5));
  // constant pixel width (px = half width in pixels), capped at 1.2 cm in the world; fades to wash when the
  // courses get closer than ~6 px apart (no moire in the distance)
  vec2 lw = min(fw * px, vec2(0.012));
  float jx = 1.0 - smoothstep(lw.x, lw.x + fw.x, min(fx, 1.0 - fx) * L);
  float jy = 1.0 - smoothstep(lw.y, lw.y + fw.y, min(fy, 1.0 - fy) * rh);
  float joint = max(jx * smoothstep(4.0, 9.0, L / fw.x), jy * smoothstep(4.0, 9.0, rh / fw.y));
  float id = h12(vec2(cx, r));
  float puddle = smoothstep(0.42, 0.72, vnoise(p * 0.21 + 3.0) * 0.6 + vnoise(p * 0.83) * 0.4);
  return vec4(joint, id, puddle, h12(vec2(cx, r) + 17.0) * 2.0 - 1.0);
}
`;

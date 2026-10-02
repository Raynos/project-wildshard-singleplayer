import { Vector3 } from 'three';

/**
 * Where the afterglow is brightest: the sun 4° under the horizon behind the signal tower (−Z, a little left). The key
 * light is art-directed apart from it (`render.ts` KEY, style bible): the band frames the tower, the key rakes the dunes.
 */
export const SUN_GLOW = new Vector3(-0.3, -0.07, -0.95).normalize();

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * The dusk dome, authored in sRGB and returned linear (style bible "Last Light"): a tall band (orange at the glow, rose
 * away from it) → dusty mauve → a greyed violet → a slate-indigo zenith, thin under-lit cloud streaks over the band
 * side (pink-orange bellies, slate tops), and the first stars.
 */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float vNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vHash(i), vHash(i + vec2(1.0, 0.0)), f.x), mix(vHash(i + vec2(0.0, 1.0)), vHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  vec3 band = mix(vec3(0.6, 0.29, 0.2), vec3(0.95, 0.44, 0.15), pow(toward, 1.3));
  vec3 mauve = vec3(0.46, 0.25, 0.23), violet = vec3(0.24, 0.19, 0.27), indigo = vec3(0.12, 0.11, 0.18);
  vec3 c = mix(band, mauve, smoothstep(0.0, 0.12 + 0.1 * toward, h));
  c = mix(c, violet, smoothstep(0.1, 0.32, h));
  c = mix(c, indigo, smoothstep(0.3, 0.8, h));
  c += vec3(1.0, 0.5, 0.18) * pow(toward, 5.0) * (1.0 - smoothstep(0.0, 0.22, h)) * 0.35;
  // Cloud streaks: long thin bands stretched along the horizon, only between ~3° and ~20° up.
  float az = atan(d.z, d.x);
  float streak = vNoise(vec2(az * 6.0, h * 120.0)) * 0.65 + vNoise(vec2(az * 19.0 + 3.1, h * 260.0)) * 0.35;
  float cloud = smoothstep(0.6, 0.85, streak) * smoothstep(0.03, 0.07, h) * (1.0 - smoothstep(0.16, 0.28, h));
  vec3 belly = mix(vec3(0.62, 0.36, 0.4), vec3(1.0, 0.6, 0.38), pow(toward, 2.0));
  c = mix(c, mix(vec3(0.2, 0.15, 0.2), belly, 0.3 + 0.7 * toward), cloud * (0.4 + 0.45 * toward));
  vec3 cell = floor(d * 260.0);
  float star = step(0.9965, starHash(cell)) * smoothstep(0.22, 0.5, h);
  c += vec3(0.85, 0.88, 1.0) * star * (0.5 + 0.5 * starHash(cell + 3.1));
  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
}`;

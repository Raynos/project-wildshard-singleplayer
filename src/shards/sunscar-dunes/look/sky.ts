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
// Noise round the horizon on a circle of radius r (r cells a radian), not on the azimuth itself: atan() jumps at +-pi,
// which drew a hard vertical seam through the streaks and the cloud bank (check pass, seat C). v runs up the sky.
vec2 skyRing(float a, float r, float v) { return vec2(cos(a) * r + v, sin(a) * r - v * 0.7); }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // Loop 5 (the mockups A-D): a clear dusk. A deep orange band hugs the horizon, brightest behind the tower; above it a
  // short dusty-rose fade into a deep indigo dome full of stars. Clouds are only a few thin dark streaks low in the band.
  vec3 band = mix(vec3(0.82, 0.36, 0.15), vec3(1.0, 0.5, 0.16), pow(toward, 1.2));
  vec3 rose = vec3(0.46, 0.26, 0.3), dusk = vec3(0.17, 0.16, 0.32), indigo = vec3(0.065, 0.085, 0.2);
  // E399 (the mockups): a tall soft orange-gold band behind the tower, peach to rose, navy pushed higher
  vec3 c = mix(band, rose, smoothstep(0.0, 0.16 + 0.1 * toward, h));
  // wide overlapping blends: where one smoothstep ended flat as the next began, the eye read a hard arc (a Mach band)
  c = mix(c, dusk, smoothstep(0.08, 0.45, h));
  c = mix(c, indigo, smoothstep(0.08, 0.85, h));
  c += vec3(1.0, 0.55, 0.2) * pow(toward, 4.0) * (1.0 - smoothstep(0.0, 0.1, h)) * 0.45;
  // Thin streaks: dark, under-lit on the glow side, only in the band (3-10 degrees up).
  float az = atan(d.z, d.x);
  float streak = vNoise(skyRing(az, 7.0, h * 140.0)) * 0.65 + vNoise(skyRing(az, 21.0, h * 300.0 + 3.1)) * 0.35;
  float cloud = smoothstep(0.55, 0.95, streak) * smoothstep(0.025, 0.06, h) * (1.0 - smoothstep(0.1, 0.2, h)) * 0.6; // soft wisps
  vec3 belly = mix(vec3(0.5, 0.24, 0.2), vec3(0.95, 0.5, 0.28), pow(toward, 2.0));
  c = mix(c, mix(vec3(0.14, 0.1, 0.16), belly, 0.35 + 0.4 * toward), cloud * 0.8);
  float cov = 0.0; // E399: no cloud deck (the mockups' skies are clear)
  // Stars: soft points round a jittered spot in each cell, many overhead, fading into the band and the glow.
  vec3 cellP = d * 300.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.0, 0.26, length(cellP - spot));
  float star = step(0.992, starHash(cell)) * starDot * smoothstep(0.1, 0.35, h) * (1.0 - 0.7 * pow(toward, 2.0)) * (1.0 - cov);
  c += vec3(0.85, 0.9, 1.0) * star * (1.2 + 1.8 * starHash(cell + 3.1));
  // dithered: a smooth gradient this dark crossed one 8-bit step in a visible line across the sky (the scorer's arc)
  c += (starHash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) * 0.014;
  gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(2.2)), 1.0);
}`;

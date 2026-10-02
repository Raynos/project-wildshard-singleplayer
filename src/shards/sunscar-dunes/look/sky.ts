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
float vFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // loop 4: the band is taller and warmer all round (the H4 back targets: orange well up the sky away from the glow too)
  // (the H4 back target, loop 4: away from the glow the band stays a saturated orange, a little lower)
  vec3 band = mix(vec3(0.9, 0.42, 0.17), vec3(0.98, 0.47, 0.15), pow(toward, 1.3));
  // round 2 (R1C-3: the eye-level views spanned 19-35 degrees of hue): a bluer violet and zenith, the bible's cool half
  vec3 mauve = vec3(0.64, 0.31, 0.22), violet = vec3(0.24, 0.2, 0.36), indigo = vec3(0.09, 0.11, 0.25);
  vec3 c = mix(band, mauve, smoothstep(0.0, 0.24 + 0.06 * toward, h));
  c = mix(c, violet, smoothstep(0.16, 0.4, h));
  c = mix(c, indigo, smoothstep(0.3, 0.8, h));
  c += vec3(1.0, 0.5, 0.18) * pow(toward, 5.0) * (1.0 - smoothstep(0.0, 0.22, h)) * 0.35;
  // Cloud streaks: long thin bands stretched along the horizon, only between ~3° and ~20° up.
  float az = atan(d.z, d.x);
  float streak = vNoise(skyRing(az, 6.0, h * 120.0)) * 0.65 + vNoise(skyRing(az, 19.0, h * 260.0 + 3.1)) * 0.35;
  float cloud = smoothstep(0.55, 0.82, streak) * smoothstep(0.03, 0.07, h) * (1.0 - smoothstep(0.22, 0.38, h));
  vec3 belly = mix(vec3(0.9, 0.46, 0.3), vec3(1.0, 0.6, 0.36), pow(toward, 2.0));
  // under-lit bellies low in the band, slate tops higher up
  c = mix(c, mix(vec3(0.24, 0.16, 0.2), belly, (0.45 + 0.55 * toward) * (1.0 - smoothstep(0.12, 0.34, h))), cloud * (0.55 + 0.35 * toward));
  // loop 4, the cloud deck (the bar's skies are full: Nalati's lit cumulus, Driftwood's clouds): a flat altocumulus layer
  // stretched across the wind, lit from under the glow side: hot orange and rose bellies low, slate-violet overhead with
  // rose rims. The lighting is the deck's own slope toward the glow (a second sample offset sunward).
  vec2 cp = d.xz / (h + 0.07);
  cp = vec2(cp.x * 0.64 - cp.y * 0.77, cp.x * 0.77 + cp.y * 0.64) * vec2(0.55, 1.5);
  float deck = vFbm(cp * 1.1 + vec2(3.0, 1.0));
  float cov = smoothstep(0.5, 0.7, deck) * smoothstep(0.004, 0.05, h) * (1.0 - 0.55 * smoothstep(0.5, 0.95, h)); // round 1 (R1B-14): down to the band
  vec2 sunward = normalize(vec2(uSun.x, uSun.z) + 1e-4) * 0.22 / (h + 0.07);
  float lit = clamp((deck - vFbm(cp * 1.1 + vec2(3.0, 1.0) + sunward * vec2(0.55, 1.5))) * 5.0 + 0.45, 0.0, 1.0);
  vec3 cloudDark = mix(vec3(0.26, 0.15, 0.18), vec3(0.3, 0.15, 0.17), toward);
  vec3 cloudLit = mix(vec3(0.96, 0.48, 0.3), vec3(1.0, 0.58, 0.26), pow(toward, 1.5));
  cloudLit = mix(cloudLit, vec3(0.44, 0.38, 0.56), smoothstep(0.18, 0.6, h)); // high tops slate-blue
  c = mix(c, mix(cloudDark, cloudLit, clamp(lit * (0.75 + 0.25 * toward) + 0.2, 0.0, 1.0)), cov * 0.94);
  // Point stars (round 1, R1B-18: whole cells drew 3-6 px quads): a soft dot round a jittered spot in its cell, fading
  // toward the glow and behind the cloud deck.
  // A low cloud bank on the horizon (round 2, seat B: the low sky in the aerials and the clip was flat orange): ragged
  // streaks in the lowest few degrees, warm where they face the glow, slate-violet away from it.
  float bankN = vNoise(skyRing(az, 5.0, h * 30.0)) * 0.6 + vNoise(skyRing(az, 13.0, h * 70.0 + 2.0)) * 0.4;
  float bank = smoothstep(0.34, 0.62, bankN) * (1.0 - smoothstep(0.12, 0.26, h)) * smoothstep(0.0, 0.035, d.y); // just above the far ranges
  vec3 bankLit = mix(vec3(0.42, 0.3, 0.44), vec3(0.98, 0.56, 0.38), pow(toward, 1.5)), bankTop = mix(bankLit, vec3(0.3, 0.24, 0.38), smoothstep(0.55, 0.9, bankN));
  c = mix(c, bankTop, bank * 0.9);
  vec3 cellP = d * 260.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.0, 0.16, length(cellP - spot));
  float star = step(0.9965, starHash(cell)) * starDot * smoothstep(0.22, 0.5, h) * (1.0 - cov) * (1.0 - 0.8 * toward);
  c += vec3(0.85, 0.88, 1.0) * star * (0.5 + 0.5 * starHash(cell + 3.1));
  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
}`;

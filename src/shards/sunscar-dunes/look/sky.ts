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
uniform float uDusk;
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
  vec3 band = mix(vec3(0.82, 0.36, 0.15), vec3(1.0, 0.5, 0.16), pow(toward, 1.2)) * (1.0 - 0.4 * uDusk);
  // round 8 (measured, Rec. 709 bands: mockup A's mid sky 81,58,76 against ours 74,46,69, its top 40,37,65 against 48,35,61):
  // a dusty rose-peach above the band and a bluer, less plum dome
  vec3 rose = vec3(0.5, 0.32, 0.32), dusk = vec3(0.24, 0.2, 0.29), indigo = vec3(0.1, 0.1, 0.19);
  // E399 (the mockups): a tall soft orange-gold band behind the tower, peach to rose, navy pushed higher
  // E399 (look/dusk.ts): as the quest goes on the band sinks and dims, the rose turns violet, the indigo comes down
  rose = mix(rose, vec3(0.42, 0.3, 0.42), uDusk);
  indigo = mix(indigo, vec3(0.15, 0.15, 0.3), uDusk); // blue-violet (round 4: plum at half the mockups' value) // the late zenith a muted lavender (R2B-1), not navy
  vec3 c = mix(band, rose, smoothstep(0.0, (0.08 + 0.07 * toward) * (1.0 - 0.5 * uDusk), h));
  // wide overlapping blends: where one smoothstep ended flat as the next began, the eye read a hard arc (a Mach band)
  c = mix(c, dusk, smoothstep(0.05 * (1.0 - 0.6 * uDusk), 0.36 - 0.18 * uDusk, h));
  c = mix(c, indigo, smoothstep(0.08 - 0.05 * uDusk, 0.85 - 0.4 * uDusk, h));
  c += vec3(1.0, 0.55, 0.2) * pow(toward, 4.0) * (1.0 - smoothstep(0.0, 0.1 - 0.05 * uDusk, h)) * 0.45 * (1.0 - 0.6 * uDusk);
  float az = atan(d.z, d.x);
  // E399 (council round 2: mockups A and dusk-fire have orange cloud banks lit from below; B-D are clear): a broken
  // deck projected on a flat layer, patchy, lit orange-gold toward the glow and rose away from it, dark cores; it clears
  // as the dusk deepens (look/dusk.ts), so the later steps' skies are clear as their mockups show.
  // round 8 (mockup A: long fibrous streaks 6-17 deg up, red-orange bellies, dark violet bodies; the council: pale cream
  // flakes in rows): noise on the azimuth ring (no seam) and the height, a few cells a radian across and many up the sky,
  // so every bank is a long horizontal streak; a fine octave tears it into fibres; denser on the glow's right (dusk-fire)
  float cH = h * 36.0;
  float cn = vNoise(skyRing(az, 11.0, cH)) * 0.45 + vNoise(skyRing(az, 26.0, cH * 2.1 + 3.1)) * 0.3 + vNoise(skyRing(az, 70.0, cH * 4.0 + 7.3)) * 0.25;
  float cside = 0.5 + 0.5 * dot(normalize(vec2(d.x, d.z) + 1e-4), normalize(vec2(-uSun.z, uSun.x)));
  float cov = smoothstep(0.66 - 0.08 * cside, 0.76, cn) * smoothstep(0.06, 0.12, h) * (1.0 - smoothstep(0.24, 0.34, h)) * (1.0 - smoothstep(0.03, 0.14, uDusk));
  // lit from below (the set sun): where the bank thins downward its belly takes the glow, its top stays dark
  float cBelow = vNoise(skyRing(az, 11.0, cH - 0.3)) * 0.45 + vNoise(skyRing(az, 26.0, (cH - 0.3) * 2.1 + 3.1)) * 0.3 + vNoise(skyRing(az, 70.0, (cH - 0.3) * 4.0 + 7.3)) * 0.25;
  float lit = clamp((cn - cBelow) * -6.0 + 0.62, 0.0, 1.0);
  float hot = pow(toward, 1.4) * (1.0 - smoothstep(0.1, 0.4, h));
  vec3 cLit = mix(mix(vec3(0.82, 0.36, 0.26), vec3(0.95, 0.44, 0.22), hot), vec3(1.0, 0.58, 0.3), hot * lit * 0.6);
  vec3 cDark = mix(vec3(0.2, 0.15, 0.22), vec3(0.3, 0.17, 0.16), hot);
  c = mix(c, mix(cDark, cLit, clamp(lit * (0.6 + 0.4 * hot) + 0.15 * hot, 0.0, 1.0)), cov * 0.9);
  // Stars: soft points round a jittered spot in each cell, many overhead, fading into the band and the glow.
  vec3 cellP = d * 300.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.0, 0.26, length(cellP - spot));
  float star = step(0.992, starHash(cell)) * starDot * smoothstep(0.1 - 0.05 * uDusk, 0.35 - 0.15 * uDusk, h) * (1.0 - 0.7 * pow(toward, 2.0)) * (1.0 - cov);
  c += vec3(0.85, 0.9, 1.0) * star * (1.2 + 1.8 * starHash(cell + 3.1));
  // dithered: a smooth gradient this dark crossed one 8-bit step in a visible line across the sky (the scorer's arc)
  c += (starHash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) * 0.014;
  gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(2.2)), 1.0);
}`;

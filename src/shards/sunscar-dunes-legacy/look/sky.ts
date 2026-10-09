import { Vector3 } from 'three';

/**
 * Where the afterglow is brightest: the sun 4° under the horizon behind the signal tower (−Z, a little left). The key
 * light is art-directed apart from it (`render.ts` KEY, style bible): the band frames the tower, the key rakes the dunes.
 */
export const SUN_GLOW = new Vector3(0.2, -0.07, -0.98).normalize(); // round 9: just right of the tower (mockup A's afterglow peaks right of it; ours peaked left)

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
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  // Loop 5 (the mockups A-D): a clear dusk. A deep orange band hugs the horizon, brightest behind the tower; above it a
  // short dusty-rose fade into a deep indigo dome full of stars. Clouds are only a few thin dark streaks low in the band.
  // round 8b (measured, Rec. 709 bands: the band at 30-36 % of the frame 168 in A and 140 in dusk-fire against the mockups' 97
  // and 84, and too yellow, 224,156,107 against 154,83,60): a deeper, redder afterglow
  // and the afterglow holds as the dusk deepens (mockups B-D's low band 87-116 against ours 71-82; it used to fade by 40 %)
  // round 12 (round 11's ledger note: a clipped red band, blue at 0, in h2's and h4's low sky): the band keeps some blue
  // round 14 (the lead: h4's low-sky red stripe 3 %): the dome's gamma 2.2 crushed a 0.19 blue to ~0
  vec3 band = mix(vec3(0.64, 0.34, 0.29), vec3(0.78, 0.38, 0.26), pow(toward, 1.2)) * (0.42 + 0.66 * uDusk); // round 11 (R10B-1: dusk-fire's band 140 / ~123)
  // round 8 (measured, Rec. 709 bands: mockup A's mid sky 81,58,76 against ours 74,46,69, its top 40,37,65 against 48,35,61):
  // a dusty rose-peach above the band and a bluer, less plum dome
  vec3 rose = vec3(0.44, 0.29, 0.3), dusk = vec3(0.24, 0.2, 0.29), indigo = vec3(0.1, 0.09, 0.19);
  // E399 (the mockups): a tall soft orange-gold band behind the tower, peach to rose, navy pushed higher
  // E399 (look/dusk.ts): as the quest goes on the band sinks and dims, the rose turns violet, the indigo comes down
  rose = mix(rose, vec3(0.42, 0.3, 0.42), uDusk);
  indigo = mix(indigo, vec3(0.15, 0.155, 0.31), uDusk); // round 8: a touch bluer (mockup B's sky 49,46,92; ours read plum)
  dusk = mix(dusk, vec3(0.27, 0.22, 0.41), uDusk); // round 8b: the blue hour's mid sky a lighter lavender (mockup D 60,53,100; ours 42,41,82) // blue-violet (round 4: plum at half the mockups' value) // the late zenith a muted lavender (R2B-1), not navy
  vec3 c = mix(band, rose, smoothstep(0.0, (0.08 + 0.07 * toward) * (1.0 - 0.5 * uDusk), h));
  // wide overlapping blends: where one smoothstep ended flat as the next began, the eye read a hard arc (a Mach band)
  c = mix(c, dusk, smoothstep(0.05 * (1.0 - 0.6 * uDusk), 0.36 - 0.18 * uDusk, h));
  c = mix(c, indigo, smoothstep(0.08 - 0.05 * uDusk, 0.5, h)); // round 8b: the dome's indigo lower at sunset (A's sky at 15 % of the frame 72,54,74 against 40,37,65)
  c += vec3(1.0, 0.56, 0.34) * pow(toward, 9.0) * (1.0 - smoothstep(0.02, 0.24 - 0.12 * uDusk, h)) * 0.36 * (1.0 - 0.6 * uDusk); // round 10 (R9B-5: A's glow flat across; the mockup's hot spot right of the tower)
  // round 10 (R9B-2: every mockup puts a thin bright glow line just over a near-black horizon): the last ~1 deg of the band
  // round 11 (R10B-1 / R10B-4: at dusk 0 neither spawn mockup has a line, and D's is a broad peach band ~3 deg, not a spike):
  // late dusk only, wider and lower
  c += vec3(0.95, 0.62, 0.42) * (1.0 - smoothstep(0.0, 0.055, h)) * 0.4 * smoothstep(0.3, 0.75, uDusk) * (0.4 + 0.6 * pow(toward, 0.7));
  float az = atan(d.z, d.x);
  // E399 (council round 2: mockups A and dusk-fire have orange cloud banks lit from below; B-D are clear): a broken
  // deck projected on a flat layer, patchy, lit orange-gold toward the glow and rose away from it, dark cores; it clears
  // as the dusk deepens (look/dusk.ts), so the later steps' skies are clear as their mockups show.
  // round 8 (mockup A: long fibrous streaks 6-17 deg up, red-orange bellies, dark violet bodies; the council: pale cream
  // flakes in rows): noise on the azimuth ring (no seam) and the height, a few cells a radian across and many up the sky,
  // so every bank is a long horizontal streak; a fine octave tears it into fibres; denser on the glow's right (dusk-fire)
  // round 9 (the seats: still slanted smears over the whole upper sky; the ring noise's height offset runs diagonally):
  // noise on plain azimuth and height, cells ~8x longer than tall, so each bank is a horizontal streak; low, 2-10 deg up;
  // in banks beside the glow, the right one heavier (mockup dusk-fire's grey-brown bank at the right, A's banks either
  // side); none near the azimuth's seam (due west, which no view faces)
  // round 10 (the seats: smooth strips; the mockups' banks are broken, layered masses with holes): a coarse mass octave
  // clumps and breaks them, the banks a little taller
  vec2 cq = vec2(az * 9.0, h * 38.0);
  float cn = vNoise(cq * 0.45 + 11.0) * 0.35 + vNoise(cq) * 0.33 + vNoise(cq * vec2(2.3, 2.0) + 3.1) * 0.2 + vNoise(cq * vec2(6.0, 4.0) + 7.3) * 0.12;
  float azG = atan(uSun.z, uSun.x), rel = az - azG; rel -= 6.2831853 * floor((rel + 3.1415927) / 6.2831853);
  float bank = 1.15 * smoothstep(0.04, 0.18, rel) * (1.0 - smoothstep(1.0, 1.5, rel)) + 0.3 * smoothstep(-1.1, -0.75, rel) * (1.0 - smoothstep(-0.22, -0.1, rel)); // round 11 (R10B-1: thinner on the left)
  // round 11 (round 10: soft caramel clumps; the mockups' banks are thin overlapping filaments with holes): a fine
  // stretched filament octave and holes cut by a mid octave
  float fil = vNoise(vec2(az * 60.0, h * 260.0) + 5.0), holes = smoothstep(0.32, 0.5, vNoise(vec2(az * 20.0, h * 90.0) + 9.0));
  float cov = smoothstep(0.46 - 0.04 * step(0.0, rel), 0.6, cn) * (0.35 + 0.65 * smoothstep(0.35, 0.65, fil)) * holes * bank * smoothstep(0.03, 0.06, h) * (1.0 - smoothstep(0.2, 0.28, h)) * (1.0 - smoothstep(2.7, 2.95, abs(az))) * (1.0 - smoothstep(0.03, 0.14, uDusk));
  // lit from below (the set sun): where the bank thins downward its belly takes the glow, its top stays dark
  vec2 cqb = cq - vec2(0.0, 0.35);
  float cBelow = vNoise(cqb * 0.45 + 11.0) * 0.35 + vNoise(cqb) * 0.33 + vNoise(cqb * vec2(2.3, 2.0) + 3.1) * 0.2 + vNoise(cqb * vec2(6.0, 4.0) + 7.3) * 0.12;
  float lit = clamp((cn - cBelow) * -6.0 + 0.7, 0.0, 1.0);
  float hot = pow(toward, 1.4) * (1.0 - smoothstep(0.1, 0.4, h));
  // round 12 (A's right half, pixels over luma 140: 1.3 k against the mockup's 21 k; its brights are the banks' lit bellies)
  vec3 cLit = mix(mix(vec3(1.25, 0.46, 0.22), vec3(1.3, 0.56, 0.24), hot), vec3(1.3, 0.7, 0.36), hot * lit * 0.6); // past 1: the dome's gamma and AgX wash a 1.0 orange to dusty pink
  vec3 cDark = mix(vec3(0.2, 0.15, 0.22), vec3(0.3, 0.17, 0.16), hot);
  // the banks' cores darker than their lit edges (round 10: a darker interior)
  float core = smoothstep(0.62, 0.78, cn);
  c = mix(c, mix(cDark, cLit, clamp(lit * (0.75 + 0.25 * hot) + 0.2 * hot - 0.5 * core, 0.0, 1.0)), min(1.0, cov * 1.15));
  // Stars: soft points round a jittered spot in each cell, many overhead, fading into the band and the glow.
  vec3 cellP = d * 300.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.08, 0.4, length(cellP - spot)); // round 9 (seat C: the mockups' stars crisp white points; ours faint specks): fewer, larger, brighter
  float star = step(0.9955, starHash(cell)) * starDot * smoothstep(0.1 - 0.05 * uDusk, 0.35 - 0.15 * uDusk, h) * (1.0 - 0.7 * pow(toward, 2.0)) * (1.0 - cov);
  c += vec3(0.9, 0.92, 1.0) * star * (2.2 + 2.6 * starHash(cell + 3.1));
  // dithered: a smooth gradient this dark crossed one 8-bit step in a visible line across the sky (the scorer's arc)
  c += (starHash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) * 0.014;
  gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(2.2)), 1.0);
}`;

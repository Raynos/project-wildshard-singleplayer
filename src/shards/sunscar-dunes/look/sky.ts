/**
 * The dusk dome, just after sunset: indigo overhead, a deep orange band where the sun went down (west of the far crest),
 * a mauve belt above it, thin dark cloud streaks lit orange from below near the glow, and the first stars. Below the
 * horizon it is the fog's colour, so the far dunes melt into it. One draw, no textures.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Toward the sun, a few degrees under the horizon (the sky's glow centre). */
export const SUN_BELOW = new Vector3(-0.55, -0.07, -1).normalize();
/** The key light: the last skylight off the glow, low from the west, so the west faces catch warm light and the east
 *  faces fall into the indigo fill (the mockup's lit left flanks and blue right-hand hollows). */
export const KEY_DIR = new Vector3(-1, 0.32, -0.5).normalize();
export const DUSK = {
  zenith: new Color(0.010, 0.013, 0.048), upper: new Color(0.040, 0.040, 0.115), mauve: new Color(0.07, 0.03, 0.05),
  away: new Color(0.13, 0.075, 0.10), glow: new Color(1.4, 0.42, 0.07), fog: new Color(0.20, 0.11, 0.11), fogSun: new Color(0.9, 0.36, 0.12),
  key: new Color(1, 0.56, 0.32), hemiSky: new Color(0.40, 0.40, 0.64), hemiGround: new Color(0.55, 0.28, 0.12),
} as const;
/** The light levels (mutable so a capture can tune them live through the plugin's debug handle). */
export const LIGHT = { key: 3, hemi: 1, keyDir: KEY_DIR };

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const FRAG = /* glsl */ `
uniform vec3 uSun, uZenith, uUpper, uMauve, uAway, uGlow, uFog;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y, hh = max(h, 0.0);
  vec2 flat2 = normalize(d.xz + vec2(1e-5)), sun2 = normalize(uSun.xz);
  float az = 0.5 + 0.5 * dot(flat2, sun2), toward = pow(az, 3.0);
  vec3 horizon = mix(uAway, uGlow, toward);
  float band = exp(-hh / (0.05 + 0.16 * az * az));
  vec3 col = mix(uUpper, uZenith, smoothstep(0.12, 0.85, hh));
  col += uMauve * exp(-hh / 0.22) * (0.5 + 0.5 * az);
  col = mix(col, horizon, band);
  // thin cloud streaks low in the sky, dark, their undersides lit where they face the glow
  float ang = atan(d.z, d.x);
  float streak = fbm(vec2(ang * 5.0, hh * 34.0)) * exp(-pow((hh - 0.085) / 0.05, 2.0));
  float cloud = smoothstep(0.42, 0.62, streak);
  vec3 cloudCol = mix(vec3(0.035, 0.022, 0.04), uGlow * 0.55, toward * smoothstep(0.62, 0.45, streak) + toward * 0.25);
  col = mix(col, cloudCol, cloud * 0.85);
  // the first stars: sparse, only where the sky has gone dark
  vec2 cell = vec2(ang * 95.0, asin(clamp(h, -1.0, 1.0)) * 95.0), id = floor(cell), f = fract(cell) - 0.5;
  float r = hash(id), dark = smoothstep(0.12, 0.45, hh) * (1.0 - toward * 0.8);
  if (r > 0.986) { vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5; float s = smoothstep(0.16, 0.0, length(f - o * 0.6));
    col += vec3(0.85, 0.88, 1.0) * s * dark * (0.4 + 1.6 * (r - 0.986) / 0.014); }
  // under the horizon: the fog the far dunes fade into
  col = mix(col, uFog, smoothstep(0.0, -0.05, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildDome(): Mesh<SphereGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: { uSun: { value: SUN_BELOW }, uZenith: { value: DUSK.zenith }, uUpper: { value: DUSK.upper }, uMauve: { value: DUSK.mauve },
      uAway: { value: DUSK.away }, uGlow: { value: DUSK.glow }, uFog: { value: DUSK.fog } } });
  const dome = new Mesh(new SphereGeometry(300, 48, 24), material);
  dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sunscar.sky';
  return dome;
}

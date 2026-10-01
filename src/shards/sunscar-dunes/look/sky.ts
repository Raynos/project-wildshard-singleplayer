import { Vector3 } from 'three';

/** Where the afterglow is brightest: the sun 4° under the horizon, ahead-left of the spawn view. */
export const SUN_GLOW = new Vector3(-0.55, -0.07, -0.83).normalize();

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** The dusk dome, authored in sRGB and returned linear: band → mauve → violet → indigo, plus a star field. */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  vec3 band = mix(vec3(0.62, 0.30, 0.28), vec3(0.95, 0.52, 0.27), pow(toward, 2.0));
  vec3 mauve = vec3(0.45, 0.26, 0.38), violet = vec3(0.23, 0.17, 0.37), indigo = vec3(0.07, 0.08, 0.2);
  vec3 c = mix(band, mauve, smoothstep(0.0, 0.07 + 0.05 * toward, h));
  c = mix(c, violet, smoothstep(0.06, 0.22, h));
  c = mix(c, indigo, smoothstep(0.2, 0.62, h));
  c += vec3(1.0, 0.55, 0.25) * pow(toward, 8.0) * (1.0 - smoothstep(0.0, 0.12, h)) * 0.25;
  vec3 cell = floor(d * 260.0);
  float star = step(0.9965, starHash(cell)) * smoothstep(0.14, 0.4, h);
  c += vec3(0.85, 0.88, 1.0) * star * (0.5 + 0.5 * starHash(cell + 3.1));
  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
}`;

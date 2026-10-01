import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Where the afterglow sits: the sun set just west (+X) of north-west, a few degrees under the horizon. */
export const GLOW_DIR = new Vector3(0.82, 0, -0.57).normalize();

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  // Centred on the camera and pinned to the far plane: everything else draws in front of it.
  vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
  gl_Position = clip.xyww; gl_Position.z = gl_Position.w * 0.99999;
}`;

// Linear-light colours (the composer grades and encodes): a narrow orange band under violet, indigo above, first stars.
const fragmentShader = /* glsl */ `
uniform vec3 uGlowDir;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float g = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), uGlowDir), 0.0), 2.0);
  vec3 band = mix(vec3(0.7, 0.2, 0.045), vec3(1.0, 0.42, 0.09), g);
  vec3 violet = vec3(0.07, 0.035, 0.12), indigo = vec3(0.012, 0.016, 0.075), zenith = vec3(0.004, 0.006, 0.03);
  float bandH = mix(0.12, 0.2, g);
  vec3 c = mix(band, vec3(0.35, 0.09, 0.08), smoothstep(0.0, bandH, h));
  c = mix(c, violet, smoothstep(bandH * 0.8, bandH * 1.8, h));
  c = mix(c, indigo, smoothstep(bandH * 1.5, 0.55, h));
  c = mix(c, zenith, smoothstep(0.45, 1.0, h));
  c = mix(vec3(0.08, 0.035, 0.03), c, smoothstep(-0.04, 0.0, h));
  // Stars: sparse cells, brighter and denser away from the glow.
  vec3 cell = floor(d * 260.0);
  float s = hash(cell), twinkle = hash(cell + 7.0);
  float star = step(0.9965, s) * smoothstep(0.1, 0.45, h) * (0.4 + 0.6 * twinkle) * (1.0 - 0.7 * g);
  c += vec3(0.75, 0.8, 1.0) * star;
  gl_FragColor = vec4(c, 1.0);
}`;

/** The dusk dome. It draws first, behind everything, and follows the camera (no parallax). */
export function buildDome(): Mesh {
  const dome = new Mesh(new SphereGeometry(500, 32, 16), new ShaderMaterial({ vertexShader, fragmentShader, side: BackSide, depthWrite: false,
    uniforms: { uGlowDir: { value: GLOW_DIR } } }));
  dome.name = 'sunscar.dome'; dome.frustumCulled = false; dome.renderOrder = -1000;
  return dome;
}

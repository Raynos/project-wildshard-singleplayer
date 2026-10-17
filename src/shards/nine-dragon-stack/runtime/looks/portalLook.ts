// Nine Dragon's portal look as data (SHARD-PLATFORM M3, ex world/portals.ts, G224): the GLSL of the iris rings, the swirl
// discs and the spark cloud, all animated in their shaders off the look's shared clock (`uTime`); the swirl and the
// sparks read the ring's radius (`uR`). world/portals.ts builds the three draws over them.

/** the iris ring (instanced torus): its uv to the fragment */
export const VS_RING = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
/** the iris ring: a bright tube with a cyan pulse running round it */
export const FS_RING = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  // a bright iris tube with a cyan pulse running round it
  float run = 0.5 + 0.5 * sin(vUv.x * 6.2832 * 3.0 - uTime * 2.4);
  vec3 col = mix(vec3(0.62, 0.42, 1.35), vec3(0.45, 1.25, 1.45), run * run);
  gl_FragColor = vec4(col * (1.15 + 0.35 * sin(uTime * 1.7)), 1.0);
}`;
/** the swirl disc (instanced circle): its plane position to the fragment */
export const VS_DISC = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
/** the swirl disc: cyan-to-magenta arms and a fine counter-swirl over a bright core, additive */
export const FS_DISC = /* glsl */ `
uniform float uTime;
uniform float uR;
varying vec2 vP;
void main() {
  vec2 p = vP / uR;
  float r = length(p), a = atan(p.y, p.x);
  float arms = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 2.2);
  float fine = 0.5 + 0.5 * sin(a * 7.0 - r * 16.0 + uTime * 3.1);
  float edge = smoothstep(1.0, 0.82, r), core = smoothstep(0.55, 0.0, r);
  vec3 col = mix(vec3(0.12, 0.75, 1.0), vec3(1.0, 0.22, 0.7), arms) * (0.45 + 0.55 * fine) + vec3(0.75, 0.6, 1.0) * core;
  float k = edge * (0.22 + 0.5 * arms * fine + 0.35 * core);
  gl_FragColor = vec4(col * k, 1.0);
}`;
/** the sparks (one point cloud): each spirals in from the ring to the centre and starts again */
export const VS_SPARK = /* glsl */ `
uniform float uTime;
uniform float uR;
attribute vec3 aAcross;
attribute vec2 aSeed;
varying float vFade;
void main() {
  // each spark spirals in from the ring to the centre and starts again, a little in front of or behind the disc
  float life = fract(uTime * (0.22 + 0.18 * aSeed.y) + aSeed.x);
  float ang = aSeed.x * 6.2832 + life * (3.0 + 2.0 * aSeed.y);
  float rad = uR * (1.05 - life * 0.95);
  vec3 normal = cross(aAcross, vec3(0.0, 1.0, 0.0));
  vec3 p = position + aAcross * cos(ang) * rad + vec3(0.0, sin(ang) * rad, 0.0) + normal * (aSeed.y - 0.5) * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vFade = sin(life * 3.1416);
  gl_PointSize = clamp(90.0 / -mv.z, 1.5, 14.0);
  gl_Position = projectionMatrix * mv;
}`;
/** a spark: a round soft point fading over its life, additive */
export const FS_SPARK = /* glsl */ `
varying float vFade;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = 1.0 - dot(c, c);
  if (d <= 0.0) discard;
  gl_FragColor = vec4(vec3(0.85, 0.7, 1.0) * d * d * vFade * 1.6, 1.0);
}`;

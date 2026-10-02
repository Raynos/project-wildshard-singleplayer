import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, NormalBlending, PlaneGeometry, Points, ShaderMaterial, type Group, type Object3D, type Vector3 } from 'three';
import { WIND } from './dunes';

/**
 * Fire, embers and smoke (review R5 / TOP-15 #8, style bible FX): shard-local, since no flame / ember / smoke particle
 * exists in the engine, game or kit yet (an engine gap for the lead to lift). Every part is a shader on a few quads or
 * points, animated on the GPU from one shared time uniform: no CPU particles, no lights, ~4 draws a fire.
 *
 * - the flame: two crossed-free cylindrical billboards (they turn about Y to the camera), a scrolling-noise flame;
 * - the glow: a soft spherical billboard round the flame, what makes a lit waymark read at 60 m+;
 * - embers: points that rise and blow downwind (`WIND`), cooling from yellow to red;
 * - smoke: a tall billboard column that widens and leans downwind, lit warm at its foot;
 * - the pool: a warm additive disc draped on the sand round the brazier.
 */
export interface FireSize { flame: number; glow: number; smoke: number; embers: number }
export const WAYMARK_FIRE: FireSize = { flame: 2.4, glow: 2.2, smoke: 22, embers: 110 };
export const SIGNAL_FIRE: FireSize = { flame: 3.6, glow: 5, smoke: 48, embers: 160 };

const time = { value: 0 };
const NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;
/** A quad (x −0.5..0.5, y 0..1) turned about Y to face the camera, scaled by the mesh's own scale; `lean` m per unit y² downwind. */
const BILLBOARD_Y = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFar;
varying float vNear;
void main() {
  vUv = uv;
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(modelMatrix[0].xyz), sy = length(modelMatrix[1].xyz);
  vec3 toCam = cameraPosition - center; toCam.y = 0.0;
  // a camera inside the column (a player at the deck's brazier) sees through it, not a screen-filling quad
  vNear = smoothstep(1.2, 3.5, length(toCam));
  // right × up must face the camera, or the quad is back-face culled.
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-4, 0.0, 0.0));
  float y = position.y;
  vec3 world = center + right * position.x * sx * (1.0 + LEAN_WIDEN * y) + vec3(0.0, y * sy, 0.0);
  world.xz += vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}) * y * y * sy * LEAN + vec2(sin(uTime * 0.7 + y * 3.0), cos(uTime * 0.5 + y * 2.0)) * y * sy * LEAN * 0.15;
  vFar = length(cameraPosition - world);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const flameMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  vertexShader: `#define LEAN 0.06\n#define LEAN_WIDEN 0.0\n${BILLBOARD_Y}`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFar;
varying float vNear;
${NOISE}
void main() {
  // loop 5 (mockup C): crisp licking tongues, not a soft blob. The flame's outline is pushed sideways by rising noise,
  // split into tongues near the top, with a hard edge; the core runs hot yellow at the root, deep orange out to red tips.
  float y = vUv.y;
  float n1 = fxNoise(vec2(vUv.x * 4.0, y * 3.0 - uTime * 3.6)), n2 = fxNoise(vec2(vUv.x * 9.0 + 3.0, y * 7.0 - uTime * 6.5));
  float n = n1 * 0.6 + n2 * 0.4;
  float x = vUv.x - 0.5 + (n1 - 0.5) * 0.22 * y;
  float tongues = 0.75 + 0.25 * sin(x * 26.0 + n2 * 4.0 + uTime * 2.0);
  float w = (0.5 * pow(1.0 - y, 0.8) + 0.02) * mix(1.0, tongues, smoothstep(0.25, 0.7, y));
  float d = abs(x) / w + (n - 0.5) * 0.5;
  float top = y + (n - 0.5) * 0.5;
  float body = (1.0 - smoothstep(0.82, 1.0, d)) * (1.0 - smoothstep(0.78, 0.95, top)) * smoothstep(0.0, 0.06, y);
  float core = (1.0 - smoothstep(0.2, 0.6, d)) * (1.0 - smoothstep(0.25, 0.6, top));
  vec3 c = mix(vec3(0.8, 0.12, 0.0), vec3(1.0, 0.45, 0.04), smoothstep(0.0, 0.5, 1.0 - d));
  c = mix(c, vec3(1.0, 0.72, 0.22), core * 0.85);
  // Up close (a player at the brazier, the deck's fire) the billboard fades out instead of filling the screen.
  gl_FragColor = vec4(c * body * 1.6 * smoothstep(0.8, 2.6, vFar) * max(vNear, 0.25), 1.0);
}`,
});
const smokeMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: NormalBlending, fog: false,
  vertexShader: `#define LEAN 0.22\n#define LEAN_WIDEN 2.2\n${BILLBOARD_Y}`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFar;
varying float vNear;
${NOISE}
void main() {
  float y = vUv.y;
  float n = fxNoise(vec2(vUv.x * 3.0, y * 6.0 - uTime * 0.55)) * 0.65 + fxNoise(vec2(vUv.x * 7.0 + 1.7, y * 14.0 - uTime * 1.1)) * 0.35;
  float d = abs(vUv.x - 0.5) * 2.0 + (n - 0.5) * 0.8;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.45, 1.0, y)) * (0.35 + 0.65 * n);
  // Dark grey-brown, lit warm by the fire at its foot and by the afterglow on its lit side.
  vec3 c = mix(vec3(0.22, 0.09, 0.04), vec3(0.045, 0.04, 0.05), smoothstep(0.0, 0.3, y));
  gl_FragColor = vec4(c, a * 0.8 * (1.0 - smoothstep(260.0, 420.0, vFar)) * vNear);
}`,
});
const glowMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  vertexShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFade;
void main() {
  vUv = uv;
  float s = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // inside the glow's own radius the halo fades (loop 3: the deck's fire washed the whole frame white)
  vFade = smoothstep(s * 0.35, s * 1.1, -mv.z);
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFade;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float flick = 0.86 + 0.08 * sin(uTime * 13.0) + 0.06 * sin(uTime * 29.0 + 1.3);
  float g = exp(-r * r * 5.0) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(vec3(1.0, 0.4, 0.1) * g * 0.26 * flick * vFade, 1.0); // loop 5: a halo, not a wash
}`,
});
const emberMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  vertexShader: /* glsl */ `
uniform float uTime;
attribute float seed;
varying float vLife;
void main() {
  float s = length(modelMatrix[0].xyz);
  float life = fract(uTime * (0.22 + 0.18 * fract(seed * 7.13)) + seed);
  vLife = life;
  float a = seed * 40.0 + uTime * (1.0 + fract(seed * 3.7));
  vec3 p = vec3(cos(a) * 0.25 * (1.0 + life * 2.5), life * 5.0, sin(a) * 0.25 * (1.0 + life * 2.5)) * s;
  p.xz += vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}) * life * life * 4.5 * s;
  vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + p, 1.0);
  gl_PointSize = clamp((1.0 - life) * 90.0 * (0.6 + fract(seed * 13.1)) / -mv.z, 2.0, 7.0);
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */ `
varying float vLife;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, r)) * (1.0 - smoothstep(0.6, 1.0, vLife));
  gl_FragColor = vec4(mix(vec3(1.0, 0.75, 0.3), vec3(1.0, 0.25, 0.04), vLife) * a * 2.4, 1.0);
}`,
});
const poolMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float flick = 0.85 + 0.1 * sin(uTime * 11.0) + 0.05 * sin(uTime * 23.0);
  // loop 5 (mockup C): the fire floods the sand round it orange: a broad pool, hot near the brazier
  gl_FragColor = vec4(vec3(0.85, 0.24, 0.03) * (pow(max(0.0, 1.0 - r), 2.2) * 0.16 + pow(max(0.0, 1.0 - r), 8.0) * 0.28) * flick, 1.0);
}`,
});
const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
const glowQuad = new PlaneGeometry(2, 2);
const emberCache = new Map<number, BufferGeometry>();
const embers = (n: number): BufferGeometry => {
  let g = emberCache.get(n);
  if (g === undefined) {
    g = new BufferGeometry(); const seeds = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) seeds[i] = (i * 0.618034) % 1;
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new Float32BufferAttribute(seeds, 1));
    emberCache.set(n, g);
  }
  return g;
};
/** The shared resources, for the level scope to own. */
export const FIRE_RESOURCES = [flameMaterial, smokeMaterial, glowMaterial, emberMaterial, poolMaterial, quad, glowQuad] as const;
export const fireGeometries = (): BufferGeometry[] => [...emberCache.values()];

/**
 * Adds the fire's parts under `group` (the brazier's hidden fire group, shown when lit). `pool` drapes a warm disc on
 * the ground under it: `at` is the group's world position and `groundAt` the terrain.
 */
export function addFire(group: Group, size: FireSize, pool?: { at: Vector3; groundAt: (x: number, z: number) => number }): Object3D[] {
  const parts: Object3D[] = [];
  const add = (o: Object3D): void => { o.frustumCulled = false; group.add(o); parts.push(o); };
  const flame = new Mesh(quad, flameMaterial); flame.scale.set(size.flame * 0.62, size.flame, 1); flame.position.y = -0.1; add(flame);
  const inner = new Mesh(quad, flameMaterial); inner.scale.set(size.flame * 0.4, size.flame * 0.78, 1); inner.position.set(0.05, -0.05, 0.05); add(inner);
  const glow = new Mesh(glowQuad, glowMaterial); glow.scale.setScalar(size.glow); glow.position.y = size.flame * 0.4; glow.renderOrder = 2; add(glow);
  const sparks = new Points(embers(size.embers), emberMaterial); sparks.scale.setScalar(size.flame * 0.9); sparks.position.y = size.flame * 0.3; add(sparks);
  const smoke = new Mesh(quad, smokeMaterial); smoke.scale.set(size.smoke * 0.09, size.smoke, 1); smoke.position.y = size.flame * 0.7; smoke.renderOrder = 1; add(smoke);
  if (pool) {
    const r = size.glow * 2.3, n = 16, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, pool.groundAt(pool.at.x + p.getX(i), pool.at.z + p.getZ(i)) + 0.06 - pool.at.y);
    add(new Mesh(g, poolMaterial));
  }
  return parts;
}

/**
 * A lamp's halo and its warm pool on the ground (loop 4: the caravan lantern, mockup B), no light. `ground(lx, lz)` is
 * the ground's height under a point of `group`'s own frame, relative to the group's origin.
 */
export function addLampGlow(group: Group, glow: number, ground: (lx: number, lz: number) => number): void {
  const halo = new Mesh(glowQuad, glowMaterial); halo.scale.setScalar(glow); halo.renderOrder = 2; halo.frustumCulled = false; group.add(halo);
  const r = glow * 1.6, n = 10, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06);
  const pool = new Mesh(g, poolMaterial); pool.frustumCulled = false; group.add(pool);
}

/** Advances every fire's shared clock (one uniform for all of them). */
export function tickFires(t: number): void { time.value = t; }

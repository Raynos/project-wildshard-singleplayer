import { AdditiveBlending, BufferGeometry, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, Float32BufferAttribute, Mesh, NormalBlending, PlaneGeometry, Points, ShaderMaterial, Vector4, type Group, type Object3D, type Vector3 } from 'three';
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
export interface FireSize { flame: number; glow: number; smoke: number; embers: number; /** a thin pale wisp (a cookfire), not the dark plume */ wisp?: boolean }
export const WAYMARK_FIRE: FireSize = { flame: 3.0, glow: 1.7, smoke: 11, embers: 260 }; // round 9 (the seats: half the mockup's fire): taller, more embers // mockup C: a roaring log fire, about one and a half bowls tall
/** A smouldering cookfire: no flame to speak of, a thin smoke column (mockup B, beside the caravan). */
export const COOKFIRE: FireSize = { flame: 0.35, glow: 0.6, smoke: 14, embers: 12, wisp: true }; // mockup B: a thin pale wisp rising behind the wagon; round 10 (the seats: a straight pale column): it curls, widens and fades
/** The keeper's lamp in the tower's top (mockup dusk-fire): a small open flame in its cage, no plume to speak of. */
export const KEEPER_LAMP: FireSize = { flame: 1.8, glow: 2.4, smoke: 0.01, embers: 4 }; // round 9: 1.3 read as a dot at 145 m
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
  world.xz += vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}) * y * y * sy * LEAN + vec2(sin(uTime * 0.7 + y * 3.0), cos(uTime * 0.5 + y * 2.0)) * y * sy * LEAN * SWAY;
  vFar = length(cameraPosition - world);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

// round 8b (measured: the flame's bright pixels carried the sky's blue, B 105-203 against mockup C's 69-173: an additive
// flame over a violet sky reads peach): premultiplied alpha, so the flame's body covers the sky behind it
const flameMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, fog: false,
  vertexShader: `#define LEAN 0.06\n#define LEAN_WIDEN 0.0\n#define SWAY 0.15\n${BILLBOARD_Y}`,
  fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFar;
varying float vNear;
${NOISE}
void main() {
  // E399 (mockup C): a ragged log fire. Round 8 (the council: smooth cream tongues; mockup C 13 468 saturated-orange
  // pixels and 5 557 white-hot against our 2 679 and 370): many thin licks torn by three noise octaves, a hard edge,
  // deep saturated orange at moderate gain on the licks (AgX keeps it orange), a white-hot core low over the logs
  // pushed past 1 so the tone mapper whites it, and dark gaps between the tongues.
  float y = vUv.y, x = vUv.x - 0.5;
  float n1 = fxNoise(vec2(x * 7.0, y * 3.4 - uTime * 4.2)), n2 = fxNoise(vec2(x * 15.0 + 4.0, y * 8.0 - uTime * 7.5));
  float n3 = fxNoise(vec2(x * 34.0 + 9.0, y * 16.0 - uTime * 11.0));
  float lick = (n1 - 0.5) * 0.3 * y + (n2 - 0.5) * 0.1 * y;
  float tongues = 0.5 + 0.5 * sin((x + lick) * 42.0 + n1 * 5.0 + uTime * 1.9);
  // the base tapers into the bowl (council round 2: a wide base cut by the quad's edge drew a rectangle)
  float w = (0.47 * pow(1.0 - y, 0.7) + 0.02) * mix(1.0, tongues, smoothstep(0.1, 0.5, y)) * mix(0.6, 1.0, smoothstep(0.0, 0.18, y));
  float d = abs(x + lick) / w;
  float top = y + (n1 - 0.5) * 0.6 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.12;
  float body = (1.0 - smoothstep(0.86, 0.96, d + (n3 - 0.5) * 0.3)) * (1.0 - smoothstep(0.7, 0.76, top)) * smoothstep(0.0, 0.14, y); // round 9: crisp lick tips
  float core = (1.0 - smoothstep(0.07, 0.46, d)) * (1.0 - smoothstep(0.06, 0.4, top + (n2 - 0.5) * 0.2)); // round 10 (R9B-3: white-hot pixels 730 against the mockup's 5 557): a larger, hotter core low over the logs
  float heat = smoothstep(0.0, 0.55, 1.0 - d) * (1.0 - smoothstep(0.3, 0.8, top));
  // round 8b: AgX washes a bright saturated orange to peach (the sparks, at a moderate gain, stay orange): the licks at a
  // moderate gain from deep orange to yellow-orange, only the small core pushed white
  vec3 c = mix(vec3(0.9, 0.1, 0.0), vec3(1.0, 0.42, 0.02), heat) * 0.85; // round 9: redder licks (they read tan)
  c = mix(c, vec3(1.0, 0.78, 0.45) * 3.4, core);
  // round 10 (the seats: a soft sprite; mockup C's fire is many thin flickering licks over burning logs): fine vertical
  // streaks rising through the body, and the base thin so the logs read through it
  float streak = fxNoise(vec2((x + lick) * 38.0, y * 5.0 - uTime * 6.5));
  c *= 0.65 + 0.7 * streak;
  float fade = smoothstep(0.8, 2.6, vFar) * max(vNear, 0.25);
  float base = mix(0.45, 1.0, smoothstep(0.08, 0.3, y));
  gl_FragColor = vec4(c * body * fade * base, body * fade * base); // round 11 (R10B-5): denser
}`,
});
/** The smoke: a dark plume leaning downwind off a big fire, or (`wisp`) a thin pale column off a cookfire, nearly straight. */
const smokeMaterialOf = (wisp: boolean): ShaderMaterial => new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: NormalBlending, fog: false,
  vertexShader: wisp ? `#define LEAN 0.1\n#define LEAN_WIDEN 6.0\n#define SWAY 2.4\n${BILLBOARD_Y}` : `#define LEAN 0.36\n#define LEAN_WIDEN 2.6\n#define SWAY 0.15\n${BILLBOARD_Y}`,
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
  // E399 (mockups B, C): billowing puffs, not a straight slab: the column breaks into clumps as it rises
  float puff = smoothstep(0.35, 0.75, n + 0.25 * (1.0 - y));
  float a = (1.0 - smoothstep(0.15, 0.9, d)) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.35, 0.95, y)) * puff;
  // Dark grey-brown, lit warm by the fire at its foot and by the afterglow on its lit side.
  vec3 c = ${wisp ? 'mix(vec3(0.16, 0.11, 0.1), vec3(0.09, 0.08, 0.12), smoothstep(0.0, 0.5, y))' : 'mix(vec3(0.25, 0.1, 0.04), vec3(0.05, 0.03, 0.032), smoothstep(0.02, 0.2, y))'}; // round 8 (mockup C: a grey-brown billow lit orange at its foot, not a dark ghost); round 9: linear values (0.1 displayed as a pale grey column) // a dark plume faintly lit at its foot, or a pale wisp // dark brown-grey, darker than the sky, warm at its foot
  gl_FragColor = vec4(c, a * ${wisp ? '0.38' : '0.9'} * (1.0 - smoothstep(260.0, 420.0, vFar)) * vNear);
}`,
});
const smokeMaterial = smokeMaterialOf(false), wispMaterial = smokeMaterialOf(true);
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
  gl_FragColor = vec4(vec3(1.0, 0.32, 0.06) * g * 0.14 * flick * vFade, 1.0); // loop 5: a halo, not a wash; round 8: dimmer and redder (its add washed the flame peach)
}`,
});
/** A lamp's halo (round 9, the seats: no lantern glow at the camp, a dot on the tower): the fire's halo shader at a lamp's
 *  own gain, which the fire's (dimmed so it no longer washed its flame) left invisible. */
const lampGlowMaterial = glowMaterial.clone(); lampGlowMaterial.uniforms = { uTime: time }; // round 11 (round 10's ledger note: drawn with no depth test it showed through the wagon and dunes): depth-tested, small
lampGlowMaterial.fragmentShader = lampGlowMaterial.fragmentShader.replace('g * 0.14 * flick', 'g * 0.42 * flick');
const emberMaterial = new ShaderMaterial({
  uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  vertexShader: /* glsl */ `
uniform float uTime;
attribute float seed;
varying float vLife;
varying vec2 vDir;
void main() {
  float s = length(modelMatrix[0].xyz);
  float life = fract(uTime * (0.22 + 0.18 * fract(seed * 7.13)) + seed);
  vLife = life;
  float a = seed * 40.0 + uTime * (1.0 + fract(seed * 3.7));
  vec3 p = vec3(cos(a) * 0.22 * (1.0 + life * 3.0), life * 6.5, sin(a) * 0.22 * (1.0 + life * 3.0)) * s;
  p.xz += vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}) * life * (0.6 + life) * 4.5 * s;
  vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + p, 1.0);
  // round 9 (seat C: the dashes leaned at one fixed screen angle): each dash along its own projected motion
  float life2 = life + 0.02, a2 = seed * 40.0 + (uTime + 0.02) * (1.0 + fract(seed * 3.7));
  vec3 p2 = vec3(cos(a2) * 0.22 * (1.0 + life2 * 3.0), life2 * 6.5, sin(a2) * 0.22 * (1.0 + life2 * 3.0)) * s;
  p2.xz += vec2(${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}) * life2 * (0.6 + life2) * 4.5 * s;
  vec4 c1 = projectionMatrix * mv, c2 = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + p2, 1.0);
  vec2 sd = c2.xy / c2.w - c1.xy / c1.w;
  vDir = normalize(vec2(sd.x, -sd.y) + vec2(1e-5, 0.0));
  gl_PointSize = clamp((1.0 - 0.6 * life) * 150.0 * (0.6 + fract(seed * 13.1)) / -mv.z, 2.0, 11.0) * (1.0 - smoothstep(35.0, 60.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */ `
varying float vLife;
varying vec2 vDir;
void main() {
  // round 8 (mockup C: short orange streaks; ours were white specks): a thin dash across the point, along its motion
  vec2 q = gl_PointCoord - 0.5, dir = vDir;
  float along = dot(q, dir), across = dot(q, vec2(-dir.y, dir.x));
  float a = (1.0 - smoothstep(0.06, 0.16, abs(across))) * (1.0 - smoothstep(0.25, 0.5, abs(along))) * (1.0 - smoothstep(0.6, 1.0, vLife));
  gl_FragColor = vec4(mix(vec3(1.0, 0.42, 0.06), vec3(0.8, 0.1, 0.0), vLife) * a * 1.5, 1.0); // orange-red sparks (mockup C; round 9: 2.4 read pale yellow, 215,173,91 against 177,103,70)
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
  // E399 (mockup C): the fire floods the sand round it orange, hot near the brazier, fading over a few metres
  gl_FragColor = vec4(vec3(1.0, 0.3, 0.04) * (pow(max(0.0, 1.0 - r), 1.8) * 0.1 + pow(max(0.0, 1.0 - r), 6.0) * 0.24) * flick, 1.0); // round 10: dimmer (pool 59 against 40); round 8: redder (it read cream on the sand)
}`,
});
const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
/** The wisp's quad: 16 rows, so its sway curls it rather than tilting it. */
const wispQuad = new PlaneGeometry(1, 1, 1, 16); wispQuad.translate(0, 0.5, 0);
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
export const FIRE_RESOURCES = [flameMaterial, smokeMaterial, wispMaterial, glowMaterial, lampGlowMaterial, emberMaterial, poolMaterial, quad, wispQuad, glowQuad] as const;
export const fireGeometries = (): BufferGeometry[] => [...emberCache.values()];

/**
 * Adds the fire's parts under `group` (the brazier's hidden fire group, shown when lit). `pool` drapes a warm disc on
 * the ground under it: `at` is the group's world position and `groundAt` the terrain.
 */
export function addFire(group: Group, size: FireSize, pool?: { at: Vector3; groundAt: (x: number, z: number) => number }): Object3D[] {
  const parts: Object3D[] = [];
  const add = (o: Object3D): void => { o.frustumCulled = false; group.add(o); parts.push(o); };
  const flame = new Mesh(quad, flameMaterial); flame.scale.set(size.flame * 0.56, size.flame, 1); flame.position.y = -0.1; add(flame);
  const inner = new Mesh(quad, flameMaterial); inner.scale.set(size.flame * 0.34, size.flame * 0.8, 1); inner.position.set(0.05, -0.05, 0.05); add(inner);
  const glow = new Mesh(glowQuad, glowMaterial); glow.scale.setScalar(size.glow); glow.position.y = size.flame * 0.4; glow.renderOrder = 2; add(glow);
  const sparks = new Points(embers(size.embers), emberMaterial); sparks.scale.setScalar(size.flame * 0.9); sparks.position.y = size.flame * 0.3; add(sparks);
  const smoke = size.wisp === true ? new Mesh(wispQuad, wispMaterial) : new Mesh(quad, smokeMaterial); smoke.scale.set(size.smoke * (size.wisp === true ? 0.03 : 0.26), size.smoke, 1); smoke.position.y = size.flame * 0.7; smoke.renderOrder = 1; add(smoke);
  if (pool) {
    const r = Math.max(size.glow * 2.3, size.flame * 2.4), n = 16, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
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
  const halo = new Mesh(glowQuad, lampGlowMaterial); halo.scale.setScalar(glow); halo.renderOrder = 2; halo.frustumCulled = false; group.add(halo);
  const r = glow * 1.6, n = 10, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06);
  const pool = new Mesh(g, poolMaterial); pool.frustumCulled = false; group.add(pool);
}

/**
 * Firelight on the hero brazier's own material (E399, council round 1: at the dusk the waymarks burn in, the key light
 * is nearly gone and the brazier read black): a uniform of up to four fires, xyz the flame and w 1 while it burns. The
 * brazier's shader warms its texture by the distance to each burning fire (world/meshes.ts), no light in the scene.
 */
export const FIRE_LIGHTS = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] };
const fireLights = { next: 0 };
/** Claims a firelight slot at `at`; the returned switch turns it on or off (`gain`: a lamp is a fraction of a fire). */
export function fireLight(at: Vector3): (lit: boolean, gain?: number) => void {
  const v = FIRE_LIGHTS.value[fireLights.next % FIRE_LIGHTS.value.length] ?? new Vector4(); fireLights.next++;
  v.set(at.x, at.y, at.z, 0);
  return (lit, gain = 1) => { v.w = lit ? gain : 0; };
}
/** Frees every slot (a level build starts with none). */
export function resetFireLights(): void { fireLights.next = 0; for (const v of FIRE_LIGHTS.value) v.w = 0; }

/** Advances every fire's shared clock (one uniform for all of them). */
export function tickFires(t: number): void { time.value = t; }

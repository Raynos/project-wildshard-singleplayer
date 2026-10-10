import { registerMaterialPreparation } from '@wildshard/engine/render/materialPreparation';
import { AdditiveBlending, BufferGeometry, CustomBlending, LinearFilter, LinearMipmapLinearFilter, OneFactor, OneMinusSrcAlphaFactor, Float32BufferAttribute, Mesh, NormalBlending, PlaneGeometry, Points, ShaderMaterial, SRGBColorSpace, Texture, Vector4, type Group, type Object3D, type Vector3 } from 'three';

/**
 * Fire, embers and smoke as declared rows (SHARD-PLATFORM SF72, effect rows): a shard declares its fires' sizes and one
 * `FireStyle` (colours, gains, the breeze, an optional flipbook) as data, and `createFireFx` builds the shared GPU effect
 * from them. Every part is a shader on a few quads or points, animated on the GPU from one shared time uniform: no CPU
 * particles, no lights, ~4 draws a fire.
 *
 * - the flame: cylindrical billboards (they turn about Y to the camera), a flipbook when one loaded, else a procedural
 *   ragged flame of torn noise licks over a hot core;
 * - the glow: a soft spherical billboard round the flame (a lit fire reads at 60 m+), and a lamp's brighter halo;
 * - embers: points that rise and drift on the breeze, each a short dash along its own motion, cooling hot → cool;
 * - smoke: a tall billboard column that widens and leans downwind, or a thin curling wisp (`FireSize.wisp`);
 * - the pool: a warm additive disc draped on the ground round the fire.
 *
 * `FireFx.lights` is a uniform of up to four burning fires (xyz the flame, w the gain) a shard's own materials can read.
 */

/** RGB, linear. */
export type FireRgb = readonly [number, number, number];
/** One fire's scale (metres): the flame's height, the glow's radius, the smoke column's height, the ember count. */
export interface FireSize { readonly flame: number; readonly glow: number; readonly smoke: number; readonly embers: number; /** a thin pale wisp (a cookfire), not the dark plume */ readonly wisp?: boolean }
/** A billboard column's drift: `lean` m per unit height² downwind, `widen` its growth with height, `sway` its wander. */
export interface FireDrift { readonly lean: number; readonly widen: number; readonly sway: number }
/** A smoke column: its drift, its colour from the foot to the top over `fade` of its height, and its opacity. */
export interface FireSmoke { readonly drift: FireDrift; readonly foot: FireRgb; readonly top: FireRgb; readonly fade: number; readonly alpha: number }
/** One look of fire, as data. */
export interface FireStyle {
  /** The direction (x, z) the smoke and embers drift on. */
  readonly breeze: readonly [number, number];
  /** A flipbook of a fire render (light over black), `columns` × `rows` cells played at `fps`; null keeps the procedural flame. */
  readonly book: { readonly url: string; readonly columns: number; readonly rows: number; readonly fps: number; readonly name: string } | null;
  /** The flipbook flame's grade: per-channel power, then a tint, the hot core raised by `core`. */
  readonly bookGrade: { readonly power: FireRgb; readonly tint: FireRgb; readonly core: number };
  /** The procedural flame: its licks from `low` to `high` with heat, at `gain`; its core `core` × `coreGain`. */
  readonly flame: { readonly drift: FireDrift; readonly low: FireRgb; readonly high: FireRgb; readonly gain: number; readonly core: FireRgb; readonly coreGain: number };
  readonly plume: FireSmoke;
  readonly wisp: FireSmoke;
  /** The halo round a fire and round a lamp (its own gain). */
  readonly glow: { readonly colour: FireRgb; readonly gain: number; readonly lampGain: number };
  readonly embers: { readonly hot: FireRgb; readonly cool: FireRgb; readonly gain: number };
  /** The ground pool: a broad wash (`wide`) and a hot centre (`hot`). */
  readonly pool: { readonly colour: FireRgb; readonly wide: number; readonly hot: number };
}

export interface FireFx {
  /** Adds a fire's parts under `group` (shown when lit); `pool` drapes the warm disc on the ground: `at` is the group's world position. */
  addFire: (group: Group, size: FireSize, pool?: { at: Vector3; groundAt: (x: number, z: number) => number }) => Object3D[];
  /** A lamp's halo and its pool, no light; `ground(lx, lz)` is the ground under a point of `group`'s frame, relative to its origin. */
  addLampGlow: (group: Group, glow: number, ground: (lx: number, lz: number) => number) => void;
  /** Claims a firelight slot at `at`; the switch turns it on or off (`gain`: a lamp is a fraction of a fire). */
  fireLight: (at: Vector3) => (lit: boolean, gain?: number) => void;
  /** Frees every slot (a level build starts with none). */
  resetLights: () => void;
  /** Advances every fire's shared clock. */
  tick: (t: number) => void;
  /** Starts the flipbook fetch; shader preparation awaits its publication. A failure keeps the procedural flame; returns the unload disposer. */
  loadBook: () => () => void;
  /** Up to four burning fires: xyz the flame, w its gain (0 when out). */
  readonly lights: { value: Vector4[] };
  /** The shared materials and quads, for the level scope to own. */
  readonly resources: readonly (ShaderMaterial | PlaneGeometry)[];
  /** The ember geometries made so far (one per count). */
  geometries: () => BufferGeometry[];
}

/** A GLSL float literal: integers keep a `.0`. */
const f = (n: number): string => Number.isInteger(n) ? n.toFixed(1) : String(n);
const v3 = (c: FireRgb): string => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
const drift = (d: FireDrift): string => `#define LEAN ${f(d.lean)}\n#define LEAN_WIDEN ${f(d.widen)}\n#define SWAY ${f(d.sway)}\n`;

const NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

/** Builds one look of fire's shared materials; each `addFire` adds ~4 draws over them. */
export function createFireFx(style: FireStyle): FireFx {
  const [bx, bz] = style.breeze, breeze = `vec2(${bx.toFixed(3)}, ${bz.toFixed(3)})`;
  const time = { value: 0 }, book: { value: Texture | null } = { value: null }, hasBook = { value: 0 };
  /** A quad (x −0.5..0.5, y 0..1) turned about Y to face the camera, scaled by the mesh's own scale; `LEAN` m per unit y² downwind. */
  const billboardY = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFar;
varying float vNear;
varying float vSeed;
void main() {
  vUv = uv;
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vSeed = fract(center.x * 3.13 + center.z * 1.71 + center.y * 0.37);
  float sx = length(modelMatrix[0].xyz), sy = length(modelMatrix[1].xyz);
  vec3 toCam = cameraPosition - center; toCam.y = 0.0;
  // a camera inside the column sees through it, not a screen-filling quad
  vNear = smoothstep(1.2, 3.5, length(toCam));
  // right × up must face the camera, or the quad is back-face culled.
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-4, 0.0, 0.0));
  float y = position.y;
  vec3 world = center + right * position.x * sx * (1.0 + LEAN_WIDEN * y) + vec3(0.0, y * sy, 0.0);
  world.xz += ${breeze} * y * y * sy * LEAN + vec2(sin(uTime * 0.7 + y * 3.0), cos(uTime * 0.5 + y * 2.0)) * y * sy * LEAN * SWAY;
  vFar = length(cameraPosition - world);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
  const cells = style.book ?? { columns: 1, rows: 1, fps: 0 }, frames = cells.columns * cells.rows;
  const { bookGrade: grade, flame: fl } = style;
  // premultiplied alpha, so the flame's body covers the sky behind it
  const flameMaterial = new ShaderMaterial({
    uniforms: { uTime: time, uBook: book, uHasBook: hasBook }, transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, fog: false,
    vertexShader: `${drift(fl.drift)}${billboardY}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform sampler2D uBook;
uniform float uHasBook;
varying vec2 vUv;
varying float vFar;
varying float vNear;
varying float vSeed;
${NOISE}
// cell i of the flipbook at the quad's uv (row 0 at the image's top; the bitmap is flipped at decode)
vec3 bookAt(float i, vec2 uv) { float col = mod(i, ${f(cells.columns)}), row = floor(i / ${f(cells.columns)}); return texture2D(uBook, vec2((col + uv.x) / ${f(cells.columns)}, (${f(cells.rows - 1)} - row + uv.y) / ${f(cells.rows)})).rgb; }
void main() {
  float fade = smoothstep(0.8, 2.6, vFar) * max(vNear, 0.25);
  if (uHasBook > 0.5) {
    // each billboard its own phase, the next frame cross-faded in
    float ft = uTime * ${f(cells.fps)} + vSeed * ${f(frames)}, i0 = mod(floor(ft), ${f(frames)}), k = fract(ft);
    vec2 uv = clamp(vUv, vec2(0.004), vec2(0.996));
    vec3 c = mix(bookAt(i0, uv), bookAt(mod(i0 + 1.0, ${f(frames)}), uv), k);
    float lum = max(c.r, max(c.g, c.b));
    // the render is light over black: its coverage from its brightness
    float cover = clamp(lum * 1.7, 0.0, 1.0);
    c = pow(c, ${v3(grade.power)}) * ${v3(grade.tint)};
    // the white-hot core gated by its place in the flame, low and central
    float coreAt = (1.0 - smoothstep(0.1, 0.42, vUv.y)) * (1.0 - smoothstep(0.12, 0.32, abs(vUv.x - 0.5))) * smoothstep(0.3, 0.6, lum);
    c *= 1.0 + ${f(grade.core)} * coreAt;
    gl_FragColor = vec4(c * fade, cover * fade);
    return;
  }
  // a ragged procedural flame: many thin licks torn by three noise octaves, a hard edge and a hot core low in it
  float y = vUv.y, x = vUv.x - 0.5, uTime = uTime + vSeed * 17.0; // each tongue its own phase
  float n1 = fxNoise(vec2(x * 7.0, y * 3.4 - uTime * 4.2)), n2 = fxNoise(vec2(x * 15.0 + 4.0, y * 8.0 - uTime * 7.5));
  float n3 = fxNoise(vec2(x * 34.0 + 9.0, y * 16.0 - uTime * 11.0));
  float lick = (n1 - 0.5) * 0.3 * y + (n2 - 0.5) * 0.1 * y;
  float tongues = 0.5 + 0.5 * sin((x + lick) * 42.0 + n1 * 5.0 + uTime * 1.9);
  // the base tapers into the bowl
  float w = (0.47 * pow(1.0 - y, 0.7) + 0.02) * mix(1.0, tongues, smoothstep(0.1, 0.5, y)) * mix(0.6, 1.0, smoothstep(0.0, 0.18, y));
  float d = abs(x + lick) / w;
  float top = y + (n1 - 0.5) * 0.6 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.12;
  float body = (1.0 - smoothstep(0.84, 0.94, d + (n3 - 0.5) * 0.55 + (n2 - 0.5) * 0.25)) * (1.0 - smoothstep(0.7, 0.76, top)) * smoothstep(0.0, 0.14, y);
  float core = (1.0 - smoothstep(0.12, 0.6, d)) * (1.0 - smoothstep(0.1, 0.55, top + (n2 - 0.5) * 0.2));
  float heat = smoothstep(0.0, 0.55, 1.0 - d) * (1.0 - smoothstep(0.3, 0.8, top));
  vec3 c = mix(${v3(fl.low)}, ${v3(fl.high)}, heat) * ${f(fl.gain)};
  c = mix(c, ${v3(fl.core)} * ${f(fl.coreGain)}, core);
  // fine vertical streaks rising through the body, and the base thin so what burns reads through it
  float streak = fxNoise(vec2((x + lick) * 38.0, y * 5.0 - uTime * 6.5));
  c *= 0.65 + 0.7 * streak;
  float base = mix(0.45, 1.0, smoothstep(0.08, 0.3, y));
  gl_FragColor = vec4(c * body * fade * base, body * fade * base);
}`,
  });
  /** The smoke: a plume leaning downwind off a big fire, or a thin wisp off a cookfire. */
  const smokeMaterialOf = (smoke: FireSmoke): ShaderMaterial => new ShaderMaterial({
    uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: NormalBlending, fog: false,
    vertexShader: `${drift(smoke.drift)}${billboardY}`,
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
  // billowing puffs, not a straight slab: the column breaks into clumps as it rises
  float puff = smoothstep(0.35, 0.75, n + 0.25 * (1.0 - y));
  float a = (1.0 - smoothstep(0.15, 0.9, d)) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.35, 0.95, y)) * puff;
  vec3 c = mix(${v3(smoke.foot)}, ${v3(smoke.top)}, smoothstep(0.0, ${f(smoke.fade)}, y));
  gl_FragColor = vec4(c, a * ${f(smoke.alpha)} * (1.0 - smoothstep(260.0, 420.0, vFar)) * vNear);
}`,
  });
  const smokeMaterial = smokeMaterialOf(style.plume), wispMaterial = smokeMaterialOf(style.wisp);
  const glowOf = (gain: number): ShaderMaterial => new ShaderMaterial({
    uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFade;
void main() {
  vUv = uv;
  float s = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // inside the glow's own radius the halo fades
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
  gl_FragColor = vec4(${v3(style.glow.colour)} * g * ${f(gain)} * flick * vFade, 1.0);
}`,
  });
  const glowMaterial = glowOf(style.glow.gain), lampGlowMaterial = glowOf(style.glow.lampGain);
  const ember = style.embers;
  const emberAt = (life: string, a: string, p: string): string => `vec3 ${p} = vec3(cos(${a}) * 0.22 * (1.0 + ${life} * 3.0), ${life} * 6.5, sin(${a}) * 0.22 * (1.0 + ${life} * 3.0)) * s;
  ${p}.xz += ${breeze} * ${life} * (0.6 + ${life}) * 4.5 * s;`;
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
  ${emberAt('life', 'a', 'p')}
  vec4 mv = viewMatrix * vec4((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + p, 1.0);
  // each dash along its own projected motion
  float life2 = life + 0.02, a2 = seed * 40.0 + (uTime + 0.02) * (1.0 + fract(seed * 3.7));
  ${emberAt('life2', 'a2', 'p2')}
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
  // a thin dash across the point, along its motion
  vec2 q = gl_PointCoord - 0.5, dir = vDir;
  float along = dot(q, dir), across = dot(q, vec2(-dir.y, dir.x));
  float a = (1.0 - smoothstep(0.06, 0.16, abs(across))) * (1.0 - smoothstep(0.25, 0.5, abs(along))) * (1.0 - smoothstep(0.6, 1.0, vLife));
  gl_FragColor = vec4(mix(${v3(ember.hot)}, ${v3(ember.cool)}, vLife) * a * ${f(ember.gain)}, 1.0);
}`,
  });
  const pool = style.pool;
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
  gl_FragColor = vec4(${v3(pool.colour)} * (pow(max(0.0, 1.0 - r), 1.8) * ${f(pool.wide)} + pow(max(0.0, 1.0 - r), 6.0) * ${f(pool.hot)}) * flick, 1.0);
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
  const lights = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] }, slots = { next: 0 };
  let bookGen = 0;
  return {
    lights,
    resources: [flameMaterial, smokeMaterial, wispMaterial, glowMaterial, lampGlowMaterial, emberMaterial, poolMaterial, quad, wispQuad, glowQuad],
    geometries: () => [...emberCache.values()],
    addFire: (group, size, at) => {
      const parts: Object3D[] = [];
      const add = (o: Object3D): void => { o.frustumCulled = false; group.add(o); parts.push(o); };
      const main = new Mesh(quad, flameMaterial); main.scale.set(size.flame * 0.56, size.flame, 1); main.position.y = -0.1; add(main);
      const inner = new Mesh(quad, flameMaterial); inner.scale.set(size.flame * 0.34, size.flame * 0.8, 1); inner.position.set(0.05, -0.05, 0.05); add(inner);
      // two narrower side tongues, offset and phase-shifted by their place
      for (const k of [-1, 1]) { const side = new Mesh(quad, flameMaterial); side.scale.set(size.flame * 0.26, size.flame * (k > 0 ? 0.72 : 0.62), 1); side.position.set(k * size.flame * 0.11, -0.08, k * 0.07); add(side); }
      const glow = new Mesh(glowQuad, glowMaterial); glow.scale.setScalar(size.glow); glow.position.y = size.flame * 0.4; glow.renderOrder = 2; add(glow);
      const sparks = new Points(embers(size.embers), emberMaterial); sparks.scale.setScalar(size.flame * 0.9); sparks.position.y = size.flame * 0.3; add(sparks);
      const wisp = size.wisp === true;
      const smoke = wisp ? new Mesh(wispQuad, wispMaterial) : new Mesh(quad, smokeMaterial); smoke.scale.set(size.smoke * (wisp ? 0.03 : 0.2), size.smoke, 1); smoke.position.y = size.flame * 0.7; smoke.renderOrder = 1; add(smoke);
      if (at) {
        const r = Math.max(size.glow * 2.3, size.flame * 2.4), n = 16, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) p.setY(i, at.groundAt(at.at.x + p.getX(i), at.at.z + p.getZ(i)) + 0.06 - at.at.y);
        add(new Mesh(g, poolMaterial));
      }
      return parts;
    },
    addLampGlow: (group, glow, ground) => {
      const halo = new Mesh(glowQuad, lampGlowMaterial); halo.scale.setScalar(glow); halo.renderOrder = 2; halo.frustumCulled = false; group.add(halo);
      const r = glow * 1.6, n = 10, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06);
      const disc = new Mesh(g, poolMaterial); disc.frustumCulled = false; group.add(disc);
    },
    fireLight: (at) => {
      const v = lights.value[slots.next % lights.value.length] ?? new Vector4(); slots.next++;
      v.set(at.x, at.y, at.z, 0);
      return (lit, gain = 1) => { v.w = lit ? gain : 0; };
    },
    resetLights: () => { slots.next = 0; for (const v of lights.value) v.w = 0; },
    tick: (t) => { time.value = t; },
    loadBook: () => {
      const gen = ++bookGen, source = style.book;
      if (source !== null) registerMaterialPreparation(flameMaterial, (async () => {
        try {
          const response = await fetch(source.url);
          if (!response.ok) throw new Error(`${String(response.status)} ${source.url}`);
          const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
          const tex = new Texture(bitmap); tex.colorSpace = SRGBColorSpace; tex.name = source.name;
          tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
          if (gen !== bookGen) { tex.dispose(); return; }
          book.value = tex; hasBook.value = 1;
        } catch (error: unknown) {
          console.warn('[fireFx] fire flipbook not loaded:', error);
        }
      })());
      return () => { bookGen++; book.value?.dispose(); book.value = null; hasBook.value = 0; };
    },
  };
}

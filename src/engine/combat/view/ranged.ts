import { app } from '#engine/app/runtime';
import * as THREE from 'three';
import type { Game } from '#engine/core/Game';
import type { Sky } from '#engine/world/Sky';
import type { Player } from '#engine/player/Player';
import type { Forest } from '#engine/world/forest/Forest';
import type { EquipmentRow } from '#engine/combat/Equipment';
import type { ImpactSurface } from '#engine/combat/Weapon';
import { castSegment, sweepBall, type Hit } from '#engine/physics/query';
import { attachFogUniforms } from '#engine/world/Atmosphere';
import type { Material } from '#engine/physics/surface';
import { makePixels, clamp01, CROSSBOW_SETS, RIFLE_SETS, type Pixels, type SetName, type Ctx2D } from '#engine/player/viewmodelTextures';

export type { ImpactSurface } from '#engine/combat/Weapon';
export type { TargetAnimal, TargetHit, Targets } from '#engine/combat/types';
export { clamp01, sstep, makeNoise, type Noise } from '#engine/player/viewmodelTextures';
export interface RangedWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface RangedOptions { row: EquipmentRow; allowUnlocked?: boolean }
export type CrossbowWorld = RangedWorld;
export type CrossbowOptions = RangedOptions;
export const TRACER_ORDER = 1200;
export const TRACER_RED = new THREE.Color(1.0, 0.0, 0.0);
/** The impact sound / puff family of what was hit (three sample sets): bark and planks are wood, everything else ground. */
export function impactSurfaceOf(m: Material): ImpactSurface {
  return m === 'flesh' ? 'flesh' : m === 'wood' || m === 'planks' ? 'wood' : 'ground';
}
interface Vec3 { x: number; y: number; z: number }
/**
 * The first world surface a bolt's step (`radius` > 0: a ball swept a → b) or a shot (`radius` 0: the ray a → b) meets,
 * looking through the invisible chunk-edge walls so nothing stops in mid-air; `distance` is from `a`. Null when the
 * way is clear — and when there is no physics world (before boot, node tests): then nothing in the world is hit.
 */

export function worldHit(a: Vec3, b: Vec3, radius: number): Hit | null {
  const physics = app.physics;
  if (!physics) return null;
  let from = a, skip: Hit['collider'] | undefined, travelled = 0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = radius > 0 ? sweepBall(physics, from, b, radius, undefined, skip) : castSegment(physics, from, b, undefined, skip);
    if (hit?.material !== 'edge') { if (hit) hit.distance += travelled; return hit; }
    travelled += hit.distance; from = hit.point; skip = hit.collider;
  }
  return null;
}
export const FOV_HIP = 72, FOV_ADS = 58; // ADS zooms 1.3× (tan 36° / 1.3 → 29.1° half-angle); the pose solve re-runs per FOV so the sight stays centred
/** Vertical FOV to give the camera. Three's fov is vertical, so on a portrait phone a fixed 72° collapses the
 *  horizontal view to ~37°; widen it (Hor+ via the geometric mean of the aspect) so 72° hip → ~94° at 9:19.5. */
export function fovForAspect(base: number, aspect: number): number {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
export function dataTexture(data: Uint8Array, w: number, h: number, srgb: boolean, repeat = 1): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export interface TexSet { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }


const pixelCache = new Map<SetName, Pixels>();
let texturesReady: Promise<void> = Promise.resolve();
const WORKER_TIMEOUT_MS = 20000;


export function startViewmodelTextures(withCrossbow: boolean): void {
  
  const sets = (withCrossbow ? [...CROSSBOW_SETS, ...RIFLE_SETS] : [...RIFLE_SETS]).filter((n) => !pixelCache.has(n));
  if (sets.length === 0) { texturesReady = Promise.resolve(); return; }
  texturesReady = (async () => {
  let worker: Worker;
  try {
    const { default: TexturesWorker } = await import('#engine/player/viewmodelTextures.worker?worker&inline');
    worker = new TexturesWorker();
  } catch { return; } // no workers: drawn on the main thread
  await new Promise<void>((resolve) => {
    let left = sets.length;
    const timer = { id: 0 };
    const finish = () => { worker.terminate(); clearTimeout(timer.id); resolve(); };
    app.engineScope.timeout(WORKER_TIMEOUT_MS, finish); // never hold the boot on it
    worker.onmessage = (e: MessageEvent<{ name: SetName; px?: Pixels; error?: string }>) => {
      if (e.data.px) pixelCache.set(e.data.name, e.data.px);
      else console.warn(`[viewmodel textures] ${e.data.name} drawn on the main thread: ${e.data.error ?? '?'}`);
      if (--left === 0) finish();
    };
    worker.onerror = (e) => { e.preventDefault(); console.warn(`[viewmodel textures] worker failed: ${e.message}`); finish(); };
    worker.postMessage({ sets }, []);
  });
  })();
}
/** Resolves when the worker has delivered every set it was asked for (or gave up); awaited by the weapon step. */
export function viewmodelTexturesReady(): Promise<void> { return texturesReady; }

const mainCanvas2d = (w: number, h: number): Ctx2D => {
  const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d');
  if (ctx === null) throw new Error('viewmodel textures: no 2d canvas context');
  return ctx;
};
function takePixels(name: SetName): Pixels {
  const px = pixelCache.get(name);
  if (px) { pixelCache.delete(name); return px; } // each set is wrapped once (its buffers become the DataTextures')
  return makePixels(name, mainCanvas2d);
}
/** A viewmodel texture set as DataTextures (map sRGB; normal + ARM linear; repeat-wrapped, mipmapped, anisotropy 8). */
export function viewmodelTexSet(name: Exclude<SetName, 'cord'>): TexSet {
  const p = takePixels(name);
  if (p.arm === null) throw new Error(`viewmodel textures: ${name} has no ARM plane`);
  return { map: dataTexture(p.col, p.w, p.h, true), normalMap: dataTexture(p.nrm, p.w, p.h, false), armMap: dataTexture(p.arm, p.w, p.h, false) };
}

/** Twisted hemp cord: diagonal stripes for both colour and bump. */
export function makeCord(): { map: THREE.Texture; normalMap: THREE.Texture } {
  const p = takePixels('cord');
  const map = dataTexture(p.col, p.w, p.h, true); map.repeat.set(1, 14);
  const normalMap = dataTexture(p.nrm, p.w, p.h, false); normalMap.repeat.set(1, 14);
  return { map, normalMap };
}

/** Bolt atlas: bottom half iron shaft, top-left steel head, top-right feather vane (alpha). */
export function makeBoltAtlas(): TexSet {
  const t = viewmodelTexSet('bolt');
  t.map.wrapS = t.map.wrapT = THREE.ClampToEdgeWrapping; t.map.premultiplyAlpha = false;
  return t;
}

/**
 * three r186 ships a stale `examples/jsm/csm/CSMShader.js`: its replacement `lights_fragment_begin`
 * chunk lacks the `#ifdef STANDARD` block that fills `material.dfg` / `multiScatteringCompensation`,
 * so every CSM-patched material gets zero IBL specular (metals render black). Until Sky.ts patches
 * the chunk globally, materials here re-insert that block ahead of the include.
 */
const DFG_FIX = /* glsl */`
#ifdef STANDARD
{
  float dotNVms_fix = saturate( dot( normal, ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition ) ) );
  material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms_fix ) ).rg;
  float EssMs_fix = material.dfg.x + material.dfg.y;
  material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs_fix - 1.0 );
}
#endif
#include <lights_fragment_begin>`;
export function fixIBL(mat: THREE.Material, name: string): void {
  mat.onBeforeCompile = function onBeforeCompile(shader) {
    // this replaces the prototype hook (Atmosphere.ts) that hands every fogged material the shared fog uniforms: attach them
    // here, or a level fog's samplers (a painted fog's fogCloudTex / fogLutV2) stay unbound on unit 0 next to the shadow map's
    // sampler2DShadow — "two textures of different types use the same sampler location", and WebGL drops the draw
    attachFogUniforms(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', DFG_FIX);
  };
  mat.customProgramCacheKey = () => `${name}|dfgfix`;
}

export const VIEWMODEL_GROUP = 'viewmodel';
let vmFillers: { white: THREE.DataTexture; arm: THREE.DataTexture; flatNormal: THREE.DataTexture } | null = null;

export function viewmodelMaterial(sky: Sky, name: string, params: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  vmFillers ??= {
    white: dataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, true),
    arm: dataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, false),
    flatNormal: dataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, false),
  };
  const f = vmFillers;
  const m = new THREE.MeshPhysicalMaterial({ map: f.white, normalMap: f.flatNormal, aoMap: f.arm, roughnessMap: f.arm, metalnessMap: f.arm, vertexColors: true, ...params });
  m.name = name; fixIBL(m, VIEWMODEL_GROUP); sky.setupMaterial(m);
  return m;
}
/** `Mesh` type guard for `Object3D.traverse` callbacks (three sets `isMesh` on every Mesh) */
export function isMesh(o: THREE.Object3D): o is THREE.Mesh { return 'isMesh' in o; }

export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
export function cyl(rTop: number, rBot: number, len: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
export function remapUV(g: THREE.BufferGeometry, u0: number, v0: number, su: number, sv: number): THREE.BufferGeometry {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * su, v0 + uv.getY(i) * sv);
  return g;
}
/** Lighten vertex colour on bevel/edge vertices (normals off-axis) → worn, handled edges. */
export function edgeWear(g: THREE.BufferGeometry, amount = 0.28): void {
  const n = g.getAttribute('normal'), count = n.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const m = Math.max(ax, ay, az);
    const w = clamp01((0.97 - m) / 0.35); // 1 on 45° bevels, 0 on flat faces
    const c = 1 + w * amount;
    colors[i * 3] = c; colors[i * 3 + 1] = c; colors[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
/** An all-white (×1) vertex-colour attribute where a geometry has none, so it can share a vertex-coloured program. */
export function whiteColors(g: THREE.BufferGeometry): void {
  if (g.hasAttribute('color')) return;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
}
export function stripExtra(geo: THREE.BufferGeometry): THREE.BufferGeometry { // non-indexed, only position/normal/uv, so merge works
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  return g;
}

/** Bolt geometry along -Z (tip at -Z). Length 0.36. Single material via atlas UVs. */
const PUFF_COUNT = 6, PUFF_PARTICLES = 14, MAX_PARTICLES = PUFF_COUNT * PUFF_PARTICLES;

export class Puffs {
  points: THREE.Points;
  private pos: Float32Array; private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES); private maxLife = new Float32Array(MAX_PARTICLES);
  private size: Float32Array; private alpha: Float32Array; private col: Float32Array;
  private posAttr: THREE.BufferAttribute; private alphaAttr: THREE.BufferAttribute; private sizeAttr: THREE.BufferAttribute; private colAttr: THREE.BufferAttribute;
  private cursor = 0;
  private mat: THREE.ShaderMaterial;
  private uScale: THREE.IUniform<number> = { value: 400 };
  private tmpSize = new THREE.Vector2();
  private rnd = () => app.rng.stream('cosmetic').next();

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3); this.size = new Float32Array(MAX_PARTICLES); this.alpha = new Float32Array(MAX_PARTICLES); this.col = new Float32Array(MAX_PARTICLES * 3);
    g.setAttribute('position', (this.posAttr = new THREE.BufferAttribute(this.pos, 3)));
    g.setAttribute('aSize', (this.sizeAttr = new THREE.BufferAttribute(this.size, 1)));
    g.setAttribute('aAlpha', (this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1)));
    g.setAttribute('aColor', (this.colAttr = new THREE.BufferAttribute(this.col, 3)));
    this.posAttr.setUsage(THREE.DynamicDrawUsage); this.alphaAttr.setUsage(THREE.DynamicDrawUsage); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.05,-mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if (r > 1.0 || vA <= 0.001) discard; float a = (1.0 - r) * (1.0 - r) * vA; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  private tmpN = new THREE.Vector3();
  emit(point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface): void {
    const n = this.tmpN.copy(dir).negate();
    const cr = surface === 'flesh' ? 0.32 : surface === 'wood' ? 0.58 : 0.42;
    const cg = surface === 'flesh' ? 0.05 : surface === 'wood' ? 0.44 : 0.36;
    const cb = surface === 'flesh' ? 0.04 : surface === 'wood' ? 0.28 : 0.26;
    for (let k = 0; k < PUFF_PARTICLES; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const sp = surface === 'flesh' ? 1.6 : 1.1;
      this.pos[i * 3] = point.x; this.pos[i * 3 + 1] = point.y; this.pos[i * 3 + 2] = point.z;
      this.vel[i * 3] = (n.x + (this.rnd() - 0.5) * 1.4) * sp * (0.4 + this.rnd());
      this.vel[i * 3 + 1] = (n.y + (this.rnd() - 0.5) * 1.4 + 0.4) * sp * (0.4 + this.rnd());
      this.vel[i * 3 + 2] = (n.z + (this.rnd() - 0.5) * 1.4) * sp * (0.4 + this.rnd());
      this.maxLife[i] = this.life[i] = 0.35 + this.rnd() * 0.4;
      this.size[i] = (surface === 'ground' ? 0.05 : 0.025) + this.rnd() * 0.03;
      const v = 0.8 + this.rnd() * 0.4;
      this.col[i * 3] = cr * v; this.col[i * 3 + 1] = cg * v; this.col[i * 3 + 2] = cb * v;
      this.alpha[i] = 1;
    }
    this.colAttr.needsUpdate = true;
  }

  update(dt: number, renderer: { getDrawingBufferSize: (out: THREE.Vector2) => THREE.Vector2 }, camera: THREE.PerspectiveCamera): void {
    renderer.getDrawingBufferSize(this.tmpSize);
    this.uScale.value = this.tmpSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let any = false;
    const pos = this.pos, vel = this.vel;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life0 = this.life[i] ?? 0;
      if (life0 <= 0) continue;
      any = true;
      const life = life0 - dt; this.life[i] = life;
      const g = life > 0 ? life / (this.maxLife[i] ?? 1) : 0;
      const j = i * 3;
      const vx = (vel[j] ?? 0) * 0.94, vy = ((vel[j + 1] ?? 0) - 3.5 * dt) * 0.94, vz = (vel[j + 2] ?? 0) * 0.94;
      vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
      pos[j] = (pos[j] ?? 0) + vx * dt; pos[j + 1] = (pos[j + 1] ?? 0) + vy * dt; pos[j + 2] = (pos[j + 2] ?? 0) + vz * dt;
      this.alpha[i] = g * 0.85;
      this.size[i] = (this.size[i] ?? 0) + dt * 0.06;
    }
    if (any) { this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true; }
  }
}

// ───────────────────────────── debug tracers ─────────────────────────────


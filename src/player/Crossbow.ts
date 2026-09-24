import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import { activePhysics } from '../physics/active';
import { castSegment, sweepBall, sticksIn, type Hit } from '../physics/query';
import type { Material } from '../physics/surface';
import { CHUNK_HALF } from '../core/config';
import { getSetting, setSetting } from '../ui/Settings';
import { makePixels, clamp01, sstep, CROSSBOW_SETS, RIFLE_SETS, type Pixels, type SetName, type Ctx2D } from './viewmodelTextures';
// oxlint-disable-next-line import/default -- a Vite `?worker&inline` import: its default export is the worker constructor (typed by vite/client), which oxlint's resolver cannot see
import TexturesWorker from './viewmodelTextures.worker?worker&inline';
import type { Weapon } from './Weapon';

/**
 * Crossbow — first-person hero weapon: procedural medieval hunting crossbow viewmodel,
 * physical bolt projectiles, impact puffs, ADS (iron sights: cheek on the stock, the camera looking straight down the
 * bolt with its tip a hair below centre — the pose is solved from the geometry and the camera per aspect, no zoom), recoil and reload.
 *
 *   const crossbow = new Crossbow({ game, sky, player, forest }, targets?, { allowUnlocked?: boolean });
 *   game.onUpdate((dt, t) => crossbow.update(dt, t));   // register AFTER player.update
 *
 * Input (only while `player.locked`, or always when `allowUnlocked`): LMB / `F` fire, RMB (click to toggle) ADS,
 * `R` reload. `crossbow.enabled = false` mutes input (intro / pause). `crossbow.adsHeld` can be forced.
 *
 * Events (assign callbacks):
 *   onFire()                                       — a bolt left the rail (play crossbowFire, kick crosshair)
 *   onHit(kind, headshot, killed)                  — a bolt hit an animal from `targets`
 *   onImpact(surface: 'wood'|'ground'|'flesh', point) — any bolt impact (play boltImpact); the surface is the hit
 *                                                    collider's material (impactSurfaceOf)
 *   onReloadStart() / onReloadEnd()
 *   onDry()                                        — trigger pulled with nothing loaded
 * State: `crossbow.state` → { bolts, loaded, reloading, reloadProgress, ads }  (bolts includes the loaded one)
 * `crossbow.aimInfo` → { kind, distance } | null — the animal under the crosshair (for the HUD range readout)
 *
 * Side effects the integrator must know about: the FOV setter (Hor+ on portrait; ADS keeps the hip FOV) owns `game.camera.fov` and calls
 * `camera.updateProjectionMatrix()` + `sky.csm.updateFrustums()`; recoil nudges `player.pitch`;
 * the viewmodel is parented to `game.camera` and the camera is added to the scene.
 * Animals are reached only through the `Targets` interface below (no import of the animal module).
 */

export interface TargetAnimal {
  applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => boolean;
  /** the damage model's number for a bolt: headshot ×2.5, body 32–40 with distance falloff (src/entities/Animal.ts) */
  damageFor: (headshot: boolean, dist: number) => number;
  /** species id (`Animal.kind`, any registered species — 'deer', 'boar', variants …) */
  kind: string;
  position: THREE.Vector3;
  alive: boolean;
  /** a melee / javelin blow's knock-back (Animal.stagger: 0 light … 1 heavy, breaks a running charge); absent on targets without one */
  stagger?: (dir: THREE.Vector3, strength: number) => void;
}
export interface TargetHit { animal: TargetAnimal; point: THREE.Vector3; distance: number; headshot: boolean }
export interface Targets { raycast: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => TargetHit | null }
export type ImpactSurface = 'wood' | 'ground' | 'flesh';
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
const _aimEnd = new THREE.Vector3();
/** The Object3D a hit collider moves with: a registered piece that `follows` one (the boat, a cabin door), else null. */
function movingOwner(owner: unknown): THREE.Object3D | null {
  if (typeof owner !== 'object' || owner === null || !('follows' in owner)) return null;
  const f = (owner as { follows?: unknown }).follows;
  return f instanceof THREE.Object3D ? f : null;
}

export function worldHit(a: Vec3, b: Vec3, radius: number): Hit | null {
  const physics = activePhysics();
  if (!physics) return null;
  let from = a, skip: Hit['collider'] | undefined, travelled = 0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = radius > 0 ? sweepBall(physics, from, b, radius, undefined, skip) : castSegment(physics, from, b, undefined, skip);
    if (hit?.material !== 'edge') { if (hit) hit.distance += travelled; return hit; }
    travelled += hit.distance; from = hit.point; skip = hit.collider;
  }
  return null;
}
export interface CrossbowWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface CrossbowOptions { allowUnlocked?: boolean }

export const MAX_BOLTS = 30;
const BOLT_SPEED = 62;
const BOLT_DRAG = 0.012;
const GRAVITY = 9.8;
const RELOAD_DURATION = 1.35;
const AUTO_RELOAD_DELAY = 1.4;
const FIRE_COOLDOWN = 0.3;
const MAX_FLYING = 8;
/** Stuck bolts are PERMANENT (target practice): no lifetime — only the cap evicts, oldest first. */
const MAX_STUCK = 200;
/** how deep the broadhead sits in wood / ground (m); the rest of the bolt stands proud of the surface */
const STUCK_BURY = 0.08;
/** a flying bolt is swept through the physics world as a ball this big (m) — the broadhead's reach */
const BOLT_RADIUS = 0.03;
/** a bolt glancing off stone / rock / metal keeps this much of its speed along the surface, bounces off it with this
 *  much of its speed into it, and never leaves faster than GLANCE_MAX (m/s): a short skip, then it falls and lies */
const GLANCE_KEEP = 0.2, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9, GLANCE_LIFT = 0.01;
/**
 * TRACERS (for sighting-in the iron sights): a traced bolt gets a big red glow while it flies, leaves a fat solid-red
 * trail of its whole flight path (drawn through trees: no depth test) and drops a red impact marker where it stopped;
 * trail + marker live TRACER_LIFE s then fade. A traced bolt that sticks keeps a permanent red dot on its nock.
 * Runtime toggle: the 'tracers' setting (pause menu, persisted) is read at fire time, so a flip applies to the next
 * shot; `?tracer=0` / `?tracer=1` writes it once at load.
 */
{
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('tracer');
  if (q !== null) setSetting('tracers', q !== '0');
}
const MAX_TRACERS = 8, TRACER_POINTS = 2048, TRACER_LIFE = 6, TRACER_FADE = 1.5, TRACER_WIDTH = 8;
/** markers + the flying glow are scaled with distance (never below 1×) so they stay ~25 px on screen at any range */
const TRACER_PX = 0.32;
export const TRACER_ORDER = 1200; // after the viewmodel (1000) so the trail's first metre shows over the weapon
/** ADS is true iron sights, not a zoom: the FOV stays put and the weapon is brought up to the eye instead. */
export const FOV_HIP = 72, FOV_ADS = 58; // ADS zooms 1.3× (tan 36° / 1.3 → 29.1° half-angle); the pose solve re-runs per FOV so the sight stays centred
/** Vertical FOV to give the camera. Three's fov is vertical, so on a portrait phone a fixed 72° collapses the
 *  horizontal view to ~37°; widen it (Hor+ via the geometric mean of the aspect) so 72° hip → ~94° at 9:19.5. */
export function fovForAspect(base: number, aspect: number): number {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
const KICK_PITCH = THREE.MathUtils.degToRad(0.8);
/** Iron sights: the camera looks straight down the bolt axis (model rotation 0, cheek on the stock) and the pose is
 *  SOLVED from the geometry + the camera's FOV/aspect, not tuned: the loaded bolt's tip is put at ADS_TIP_NDC (a hair
 *  below centre, the approved mockup) and the model is slid toward the eye until the nut/string reaches
 *  ADS_NUT_NDC_Y (just inside the bottom edge) or the near plane stops it — that fixes the eye height above the rail
 *  (~5 cm) and the depth, and the limb span falls out (≈ ±0.5 landscape, edge to edge on a 94° portrait). */
const ADS_EYE_ABOVE_RAIL = 0.056; // m — cheek on the stock: the eye is this far above the rail, looking straight down the bolt
const ADS_NEAR_MARGIN = 0.03, ADS_PITCH = 0, ADS_BLEND_TIME = 0.18, ADS_MOTION = 0.3;
// damage numbers live in the damage model (src/entities/Animal.ts damageFor)
/** Rear PEEP sight (mockup art/ads-aim/round-1/ads-C-peep-sight.png): a dark-iron ring on a post just in front of the nut (the stock
 *  behind the nut is inside the near plane when sighted), placed on the eye→tip line so that at full ADS its centre
 *  projects exactly where the tip does — the tip is seen through the ring. Outer diameter ≈ 4 % of the screen width
 *  (≥ 7 % of the height, so it stays a ring on a portrait phone). Hidden at the hip, fades in with the ADS blend. */
const PEEP_Z = 0.10, PEEP_R = 0.01, PEEP_TUBE = 0.12, PEEP_R_WORLD = 0.0105, PEEP_CYAN = 0x8fe3ff; // rear peep: 2.1 cm ring on a short post just ahead of the nut

// ───────────────────────────── procedural textures ─────────────────────────────

export { makeNoise, clamp01, sstep, type Noise } from './viewmodelTextures';

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

/*
 * The crossbow's and the rifle's texture sets (walnut, steel, leather, cord, bolt atlas; anodised aluminium, polymer,
 * steel) are drawn by viewmodelTextures.ts — ~470 ms of main thread at 4× CPU when drawn here, the longest task of
 * the load. `startViewmodelTextures()` (main.ts, at the head of the boot) hands them to a worker, which draws them
 * while the world builds; the weapon step awaits `viewmodelTexturesReady()` and the constructors below find the
 * pixels waiting. Same functions, same bytes. No worker (or a set it could not draw) → drawn here, as before.
 */
const pixelCache = new Map<SetName, Pixels>();
let texturesReady: Promise<void> = Promise.resolve();
const WORKER_TIMEOUT_MS = 20000;

/** Start drawing the viewmodels' texture sets in a worker (the crossbow's only when the shard hands one out). */
export function startViewmodelTextures(withCrossbow: boolean): void {
  const sets = withCrossbow ? [...CROSSBOW_SETS, ...RIFLE_SETS] : [...RIFLE_SETS];
  let worker: Worker;
  try { worker = new TexturesWorker(); } catch { return; } // no workers: drawn on the main thread
  texturesReady = new Promise<void>((resolve) => {
    let left = sets.length;
    const timer = { id: 0 };
    const finish = () => { worker.terminate(); clearTimeout(timer.id); resolve(); };
    timer.id = window.setTimeout(finish, WORKER_TIMEOUT_MS); // never hold the boot on it
    worker.onmessage = (e: MessageEvent<{ name: SetName; px?: Pixels; error?: string }>) => {
      if (e.data.px) pixelCache.set(e.data.name, e.data.px);
      else console.warn(`[viewmodel textures] ${e.data.name} drawn on the main thread: ${e.data.error ?? '?'}`);
      if (--left === 0) finish();
    };
    worker.onerror = (e) => { e.preventDefault(); console.warn(`[viewmodel textures] worker failed: ${e.message}`); finish(); };
    worker.postMessage({ sets }, []);
  });
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
function makeCord(): { map: THREE.Texture; normalMap: THREE.Texture } {
  const p = takePixels('cord');
  const map = dataTexture(p.col, p.w, p.h, true); map.repeat.set(1, 14);
  const normalMap = dataTexture(p.nrm, p.w, p.h, false); normalMap.repeat.set(1, 14);
  return { map, normalMap };
}

/** Bolt atlas: bottom half iron shaft, top-left steel head, top-right feather vane (alpha). */
function makeBoltAtlas(): TexSet {
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
  // oxlint-disable-next-line typescript/unbound-method -- the previous hook is deliberately captured and re-invoked with `.call(this)` below
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    prev.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', DFG_FIX);
  };
  mat.customProgramCacheKey = () => `${name}|dfgfix`;
}
/** fixIBL's cache group for every viewmodel material (crossbow, rifle, swim hands, their skins): all of them apply
 *  the same patch, so one group lets identical shaders share a program. */
export const VIEWMODEL_GROUP = 'viewmodel';
let vmFillers: { white: THREE.DataTexture; arm: THREE.DataTexture; flatNormal: THREE.DataTexture } | null = null;
/**
 * The viewmodels' shared lit material — one program for the crossbow (bar the anisotropic prod), the rifle and the
 * pbr swim hands: MeshPhysical + vertex colours + all five map slots, the dfg fix and the sky's CSM. Physical at its
 * defaults (ior 1.5, specularIntensity 1) is exactly Standard's F0 0.04 / F90 1. Slots left out get 1×1 fillers
 * (white albedo, white ARM = ao · roughness · metalness × 1, flat normal) so colour / roughness / metalness read as
 * set. The meshes need a colour attribute: `whiteColors` where they have no wear colours. Each program saved is
 * ~150 ms of cold Metal compile on the iPhone.
 */
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

// ───────────────────────────── geometry helpers ─────────────────────────────

/** Sweep a tapered rectangle section along a curve (flat spring-steel limb). */
function sweepRect(curve: THREE.Curve<THREE.Vector3>, segs: number, halfW: (t: number) => number, halfH: (t: number) => number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = [];
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const faces: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // corners in (N, B) space, ring order
  const c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
    const hw = halfW(t), hh = halfH(t);
    for (let k = 0; k < 4; k++) { const ck = c[k], fk = faces[k]; if (ck === undefined || fk === undefined) continue; ck.copy(p).addScaledVector(N, fk[0] * hw).addScaledVector(B, fk[1] * hh); }
    // four faces, each with two verts per ring (hard edges)
    for (let f = 0; f < 4; f++) {
      const a = c[f], b = c[(f + 1) % 4];
      if (a === undefined || b === undefined) continue;
      const fn = new THREE.Vector3().subVectors(b, a).cross(T).normalize().negate();
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); nrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z); uv.push(t * 6, 0, t * 6, 1);
      const wear = (f % 2 === 1 ? 0.8 : 0.28) * (0.85 + 0.3 * Math.abs(Math.sin(t * 23 + f))); // edges worn bright, flats blackened
      col.push(wear, wear, wear, wear, wear, wear);
    }
  }
  for (let s = 0; s < segs; s++) for (let f = 0; f < 4; f++) {
    const o = s * 8 + f * 2, n = o + 8;
    idx.push(o, n, o + 1, o + 1, n, n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Bevelled rectangular ring (iron band) around a w×h section, `len` long, oriented along Z. */
function bandGeometry(w: number, h: number, len: number, thick: number, bevel = 0.0015): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, h / 2 + thick); outer.lineTo(-w / 2 - thick, h / 2 + thick); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -len / 2 + bevel);
  return g;
}

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
function remapUV(g: THREE.BufferGeometry, u0: number, v0: number, su: number, sv: number) {
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
function buildBoltGeometry(): THREE.BufferGeometry {
  const L = 0.36, r = 0.0045;
  const parts: THREE.BufferGeometry[] = [];
  // shaft (ash)
  parts.push(remapUV(cyl(r, r, L - 0.05, 10, 0, 0, 0.025, Math.PI / 2), 0, 0.02, 1, 0.44));
  // nock end cap
  parts.push(remapUV(cyl(r * 0.8, r, 0.012, 8, 0, 0, L / 2 - 0.006, Math.PI / 2), 0, 0.02, 1, 0.44));
  // socket (steel)
  parts.push(remapUV(cyl(0.0052, r, 0.03, 8, 0, 0, -L / 2 + 0.04, Math.PI / 2), 0.03, 0.55, 0.42, 0.42));
  // broadhead: flattened 4-sided cone = two-edged blade
  const head = new THREE.ConeGeometry(0.016, 0.07, 4);
  head.rotateY(Math.PI / 4); head.scale(0.22, 1, 1); head.rotateX(-Math.PI / 2); head.translate(0, 0, -L / 2 + 0.035 - 0.035);
  parts.push(remapUV(head, 0.03, 0.55, 0.42, 0.42));
  // fletchings ×3
  for (let k = 0; k < 3; k++) {
    const vane = new THREE.PlaneGeometry(0.075, 0.02);
    vane.translate(0, 0.01 + r * 0.7, 0); vane.rotateY(Math.PI / 2); // plane along Z, standing up from the shaft
    vane.rotateZ((k / 3) * Math.PI * 2 + Math.PI / 2);
    vane.translate(0, 0, L / 2 - 0.06);
    parts.push(remapUV(vane, 0.5, 0.5, 0.5, 0.5));
  }
  const g = mergeGeometries(parts.map(stripExtra), false);
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────────── impact particles ─────────────────────────────

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
  private rnd = () => Math.random();

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

  update(dt: number, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
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

export const TRACER_RED = new THREE.Color(1.0, 0.0, 0.0); // pure red; anything brighter the AgX tone map washes to salmon
/** shared: the glow on flying bolts, impact-marker spheres, stuck-bolt nock dots (never fades) */
const glowMat = new THREE.MeshBasicMaterial({ color: TRACER_RED, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
const boltGlowGeo = new THREE.SphereGeometry(0.035, 12, 8);   // 7 cm on the flying bolt
const stuckDotGeo = new THREE.SphereGeometry(0.025, 10, 6);   // 5 cm on a stuck bolt's nock
const markerGeo = new THREE.SphereGeometry(0.06, 14, 10);     // 12 cm at the impact point
const ringGeo = new THREE.RingGeometry(0.10, 0.14, 28);

/** One flight path: a pre-allocated fat-line buffer (TRACER_POINTS samples → segment pairs) + an impact marker. */
class Tracer {
  readonly line: LineSegments2; readonly mat: LineMaterial;
  readonly marker = new THREE.Group();
  private buf: Float32Array; private ibuf: THREE.InstancedInterleavedBuffer; private geo: LineSegmentsGeometry;
  private markMat: THREE.MeshBasicMaterial; private ring: THREE.Mesh;
  private last = new THREE.Vector3();
  n = 0; active = false;
  /** absolute time the trail + marker expire; < 0 while the bolt is still flying */
  endTime = -1;

  constructor(scene: THREE.Scene) {
    this.buf = new Float32Array((TRACER_POINTS - 1) * 6);
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.buf);
    this.ibuf = (this.geo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer;
    this.ibuf.setUsage(THREE.DynamicDrawUsage);
    this.geo.instanceCount = 0;
    this.mat = new LineMaterial({ linewidth: TRACER_WIDTH, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mat.color = TRACER_RED.clone(); // the setter stores the object itself (a Color; > 1 so bloom haloes it)
    this.line = new LineSegments2(this.geo, this.mat);
    this.line.frustumCulled = false; this.line.renderOrder = TRACER_ORDER; this.line.visible = false;
    scene.add(this.line);
    this.markMat = glowMat.clone();
    const ball = new THREE.Mesh(markerGeo, this.markMat); ball.renderOrder = TRACER_ORDER + 1;
    this.ring = new THREE.Mesh(ringGeo, this.markMat); this.ring.renderOrder = TRACER_ORDER + 1;
    this.marker.add(ball, this.ring);
    this.marker.visible = false;
    scene.add(this.marker);
  }

  begin(p: THREE.Vector3) {
    this.n = 0; this.geo.instanceCount = 0; this.active = true; this.endTime = -1;
    this.mat.opacity = 1; this.markMat.opacity = 1;
    this.marker.visible = false; this.line.visible = false;
    this.addPoint(p);
  }

  /** append a flight sample (one per integration step); no allocation, uploads only the new segment */
  addPoint(p: THREE.Vector3) {
    if (this.n >= TRACER_POINTS) return;
    if (this.n > 0) {
      if (p.distanceToSquared(this.last) < 1e-8) return;
      const o = (this.n - 1) * 6, b = this.buf, l = this.last;
      b[o] = l.x; b[o + 1] = l.y; b[o + 2] = l.z; b[o + 3] = p.x; b[o + 4] = p.y; b[o + 5] = p.z;
      this.ibuf.addUpdateRange(o, 6); this.ibuf.needsUpdate = true;
      this.geo.instanceCount = this.n;
      this.line.visible = true;
    }
    this.last.copy(p); this.n++;
  }

  finish(p: THREE.Vector3, t: number) {
    this.addPoint(p);
    this.marker.position.copy(p); this.marker.visible = true;
    this.endTime = t + TRACER_LIFE;
  }

  update(t: number, cam: THREE.Camera, res: THREE.Vector2) {
    if (!this.active) return;
    this.mat.resolution.copy(res);
    if (this.endTime < 0) return;
    const rem = this.endTime - t;
    if (rem <= 0) { this.active = false; this.line.visible = false; this.marker.visible = false; return; }
    const a = Math.min(1, rem / TRACER_FADE);
    this.mat.opacity = a; this.markMat.opacity = a;
    this.ring.quaternion.copy(cam.quaternion); // the ring always faces the camera
    this.marker.scale.setScalar(Math.max(1, TRACER_PX * this.marker.position.distanceTo(cam.position)));
  }
}

// ───────────────────────────── the crossbow ─────────────────────────────

interface Bolt { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; active: boolean; age: number; roll: number; traced: boolean; tracer: Tracer | null; glow: THREE.Mesh; glanced: boolean }
interface Stuck { mesh: THREE.Mesh }

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const NEG_Z = new THREE.Vector3(0, 0, -1), Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

export class Crossbow implements Weapon {
  readonly hasAmmo = true;
  state = { bolts: MAX_BOLTS, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** hold ADS externally (dev `?ads=1`) — OR'ed with the right mouse button */
  adsHeld = false;
  /** dev: 0 = normal, 1 = showcase pose (model centred, three-quarter view, slowly turning) */
  inspect = 0;
  /** dev: reload duration multiplier (1 = normal) */
  reloadScale = 1;
  /** 0..1 weapon-swap blend driven by Weapons.ts: 1 = dropped out of view (down + back + muzzle up); 0 = held (no effect) */
  holster = 0;
  /** what the crosshair is over (animals only; refreshed every 4th frame, 120 m) */
  aimInfo: { kind: string; distance: number } | null = null;
  private aimFrame = 0;
  private aimCache = { kind: 'deer', distance: 0 };

  onFire?: () => void;
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;

  // viewmodel parts we animate
  private stringLeft!: THREE.Mesh; private stringRight!: THREE.Mesh; private serving!: THREE.Mesh;
  private loadedBolt!: THREE.Mesh;
  private tipL = new THREE.Vector3(); private tipR = new THREE.Vector3();
  private nockRest = new THREE.Vector3(); private nockDrawn = new THREE.Vector3();
  private boltGeo!: THREE.BufferGeometry; private boltMat!: THREE.MeshStandardMaterial;
  /** the bolt geometry's nock end (max z), measured from its bounding box */
  private nockZ = 0;

  // animation state
  private draw = 1; private drawVel = 0; private drawTarget = 1;
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private cooldown = 0; private sinceFire = 99; private reloadT = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;
  /** loaded bolt's broadhead tip, in model space (measured from the bolt geometry) and bolt-local */
  private tipModel = new THREE.Vector3(); private tipLocal = new THREE.Vector3();
  private adsCache = { aspect: 0, fov: 0, scale: 0 };
  /** the solved iron-sights pose + the numbers behind it (dev / verification: `__world.crossbow.adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, rx: ADS_PITCH, scale: 0, tipDepth: 0, eyeAboveRail: 0, nutDepth: 0, nutNdcY: 0, limbNdcX: 0, tipNdcY: 0, peepY: 0, peepZ: PEEP_Z, peepDepth: 0, peepR: 0 };
  /** the rear peep sight: ring + post, posed from `adsPose` every sighted frame */
  private peep = new THREE.Group(); private peepRing = new THREE.Group(); private peepPost!: THREE.Mesh;
  private peepMats: THREE.Material[] = [];

  // projectiles
  private bolts: Bolt[] = [];
  private stuck: Stuck[] = [];
  private puffs = new Puffs();
  private tracers: Tracer[] = [];
  private tracerRes = new THREE.Vector2();
  private time = 0;
  private spawnPos = new THREE.Vector3();

  constructor(world: CrossbowWorld, targets?: Targets, opts: CrossbowOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildProjectiles();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.puffs.points);
    this.bindInput();
  }

  // ── input ──
  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseAds = !this.mouseAds; // toggle, not hold: a trackpad can't hold a two-finger click and still look around
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
      if (e.code === 'KeyR') this.reload();
    });
    window.addEventListener('blur', () => { this.mouseAds = false; });
  }

  /** Pull the trigger. Fires if loaded, else starts a reload (and reports a dry click). */
  tryFire(): void {
    if (this.state.reloading || this.cooldown > 0) return;
    if (!this.state.loaded) { this.onDry?.(); this.reload(); return; }
    this.fire();
  }

  fire(): void {
    if (!this.state.loaded || this.state.reloading) return;
    this.state.loaded = false;
    this.state.bolts = Math.max(0, this.state.bolts - 1);
    this.cooldown = FIRE_COOLDOWN; this.sinceFire = 0;
    this.drawTarget = 0; this.drawVel = -40; // string snaps forward
    this.recoil = 1; this.kickPending = KICK_PITCH;
    this.spawnBolt();
    this.onFire?.();
  }

  reload(): void {
    if (this.state.reloading || this.state.loaded || this.state.bolts <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  addBolts(n: number): void { this.state.bolts = Math.min(MAX_BOLTS, this.state.bolts + n); }

  // ── viewmodel ──
  private buildViewmodel(): void {
    const walnut = viewmodelTexSet('walnut'), steel = viewmodelTexSet('steel-xbow'), leather = viewmodelTexSet('leather'), cord = makeCord();
    walnut.map.repeat.set(1, 4); walnut.normalMap.repeat.set(1, 4); walnut.armMap.repeat.set(1, 4);
    // Every lit material below is the SAME program: MeshPhysical + vertex colours, the same map slots (map, normal,
    // ao, roughness, metalness — the ARM texture feeds the last three, a 1×1 ARM where a set has none) and the same
    // cache key. Physical at its defaults (ior 1.5, specularIntensity 1, white specularColor) is exactly Standard's
    // F0 0.04 / F90 1, and a mesh with no wear colours gets an all-white colour attribute (`whiteColors`), so iron,
    // brass, cord, leather and the peep ring render as before and share the stock's program. The prod keeps its own
    // (anisotropy is a define — the hero-weapon sheen stays). Each program is ~150 ms of Metal compile on the iPhone.
    const flatArm = dataTexture(new Uint8Array([255, 255, 0, 255]), 1, 1, false); // ao 1 · roughness 1 · metal 0
    const woodMat = new THREE.MeshPhysicalMaterial({ map: walnut.map, normalMap: walnut.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), aoMap: walnut.armMap, roughnessMap: walnut.armMap, metalnessMap: walnut.armMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.45, specularIntensity: 0.3 }); // low specularIntensity kills the grazing sunset sheen on the rail
    const ironMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.5, metalness: 1, color: new THREE.Color(0.24, 0.23, 0.23), vertexColors: true, envMapIntensity: 0.6 });
    const prodMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.25, metalness: 1, color: new THREE.Color(0.55, 0.55, 0.57), vertexColors: true, anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 0.7 }); // anisotropy kept (hero-weapon sheen): its define is the prod's own program
    steel.map.repeat.set(2, 2); steel.normalMap.repeat.set(2, 2); steel.armMap.repeat.set(2, 2);
    const leatherMat = new THREE.MeshPhysicalMaterial({ map: leather.map, normalMap: leather.normalMap, aoMap: leather.armMap, roughnessMap: leather.armMap, metalnessMap: leather.armMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.5 });
    const cordMat = new THREE.MeshPhysicalMaterial({ map: cord.map, normalMap: cord.normalMap, aoMap: flatArm, roughnessMap: flatArm, metalnessMap: flatArm, roughness: 0.85, metalness: 0, vertexColors: true });
    const brassMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.1, metalness: 1, color: new THREE.Color(0.95, 0.66, 0.3), vertexColors: true, envMapIntensity: 1.0 });
    ([['xbow-wood', woodMat], ['xbow-iron', ironMat], ['xbow-prod', prodMat], ['xbow-leather', leatherMat], ['xbow-cord', cordMat], ['xbow-brass', brassMat]] as [string, THREE.Material][]).forEach(([n, m]) => { m.name = n; fixIBL(m, VIEWMODEL_GROUP); this.sky.setupMaterial(m); });

    // model space: -Z forward (bolt direction), +Y up, rail top at y=0. Nut at z=+0.14, prod at z=-0.30.
    // ── stock: side profile extruded along X with bevels ──
    const s = new THREE.Shape(); // shape.x = forward (→ -Z), shape.y = up
    s.moveTo(0.40, 0.0);
    s.lineTo(-0.16, 0.0);
    s.quadraticCurveTo(-0.26, -0.006, -0.32, -0.035);
    s.lineTo(-0.43, -0.085);
    s.quadraticCurveTo(-0.455, -0.1, -0.445, -0.125);
    s.lineTo(-0.435, -0.15);
    s.quadraticCurveTo(-0.39, -0.16, -0.34, -0.135);
    s.lineTo(-0.23, -0.088);
    s.quadraticCurveTo(-0.12, -0.062, 0.0, -0.056);
    s.lineTo(0.30, -0.048);
    s.quadraticCurveTo(0.39, -0.046, 0.40, -0.018);
    s.closePath();
    const stockGeo = new THREE.ExtrudeGeometry(s, { depth: 0.038, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10 });
    stockGeo.rotateY(Math.PI / 2); // shape.x → -Z, extrusion → +X
    stockGeo.translate(-0.019, 0, 0);
    // rail strips (two lighter wood rails with a groove for the bolt)
    const railL = box(0.008, 0.005, 0.52, -0.011, 0.0025, -0.12), railR = box(0.008, 0.005, 0.52, 0.011, 0.0025, -0.12);
    const stockNI = stripExtra(stockGeo);
    const woodGeo = mergeGeometries([stockNI, stripExtra(railL), stripExtra(railR)], false);
    edgeWear(woodGeo, 0.18);
    { // the groove rails sit in shadow of the bolt: darker, oil-soaked
      const c = woodGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = stockNI.getAttribute('position').count; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.62, c.getY(i) * 0.6, c.getZ(i) * 0.58);
    }
    const stock = new THREE.Mesh(woodGeo, woodMat);
    this.model.add(stock);

    // ── iron: nut, trigger, guard, tickler, bands, rivets, stirrup, prod bridle, tip caps ──
    const iron: THREE.BufferGeometry[] = [];
    // brass: nut (roller), side inlay strips, thumb plate, rivet heads on the grip
    const brass: THREE.BufferGeometry[] = [];
    brass.push(cyl(0.014, 0.014, 0.042, 18, 0, 0.004, 0.14, 0, 0, Math.PI / 2)); // nut
    brass.push(box(0.032, 0.006, 0.011, 0, 0.012, 0.133)); // nut fingers
    for (const sx of [-1, 1]) brass.push(box(0.0015, 0.0035, 0.30, sx * 0.0245, -0.03, -0.09)); // inlay lines along the flanks
    brass.push(box(0.03, 0.002, 0.05, 0, -0.088, 0.25, 0.3)); // thumb plate on the grip top edge
    const bead = new THREE.SphereGeometry(0.0035, 10, 8); bead.translate(0, 0.009, -0.375); brass.push(bead); // foresight bead
    brass.push(cyl(0.0015, 0.0015, 0.008, 6, 0, 0.004, -0.375)); // bead post
    const brassGeo = mergeGeometries(brass.map(stripExtra), false);
    this.model.add(new THREE.Mesh(brassGeo, brassMat));
    // trigger (curved) + guard
    const trig = new THREE.TorusGeometry(0.022, 0.0032, 8, 14, Math.PI * 0.6); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.55); trig.translate(0, -0.075, 0.205); iron.push(trig);
    const guard = new THREE.TorusGeometry(0.036, 0.0025, 6, 20, Math.PI); guard.rotateY(Math.PI / 2); guard.rotateX(Math.PI); guard.translate(0, -0.066, 0.21); iron.push(guard);
    // tickler lever under the stock, angled
    iron.push(box(0.012, 0.006, 0.19, 0, -0.088, 0.30, -0.08));
    iron.push(cyl(0.004, 0.004, 0.05, 8, 0, -0.08, 0.215, 0, 0, Math.PI / 2)); // pivot pin
    // bands
    const bandF = bandGeometry(0.048, 0.052, 0.022, 0.003); bandF.translate(0, -0.026, -0.27); iron.push(bandF);
    const bandM = bandGeometry(0.048, 0.062, 0.016, 0.0025); bandM.translate(0, -0.031, 0.02); iron.push(bandM);
    const bandR = bandGeometry(0.046, 0.07, 0.016, 0.0025); bandR.translate(0, -0.045, 0.27); iron.push(bandR);
    // rivets on bands
    for (const [z, y] of [[-0.27, -0.026], [0.02, -0.031], [0.27, -0.045]] as const) for (const sx of [-1, 1]) {
      iron.push(cyl(0.003, 0.0035, 0.004, 8, sx * 0.028, y, z, 0, 0, Math.PI / 2));
    }
    // prod bridle: a saddle over the stock nose holding the prod
    iron.push(box(0.062, 0.012, 0.03, 0, 0.007, -0.30));
    iron.push(box(0.064, 0.05, 0.012, 0, -0.026, -0.296)); // vertical plate in front of prod
    for (const sx of [-1, 1]) iron.push(cyl(0.0045, 0.0045, 0.04, 8, sx * 0.024, -0.025, -0.283, Math.PI / 2)); // bridle bolts
    // stirrup: two legs + half ring
    for (const sx of [-1, 1]) iron.push(cyl(0.004, 0.004, 0.06, 8, sx * 0.03, -0.055, -0.415, 0, 0, 0));
    const stir = new THREE.TorusGeometry(0.03, 0.004, 8, 18, Math.PI); stir.rotateZ(Math.PI); stir.translate(0, -0.085, -0.415); iron.push(stir);
    iron.push(box(0.07, 0.008, 0.02, 0, -0.03, -0.41)); // stirrup mount plate
    // limb tip caps
    this.tipL.set(-0.335, 0.004, -0.205); this.tipR.set(0.335, 0.004, -0.205);
    for (const tip of [this.tipL, this.tipR]) iron.push(box(0.022, 0.024, 0.012, tip.x, tip.y, tip.z));
    // butt plate
    const butt = box(0.046, 0.06, 0.006, 0, -0.115, 0.44, 0.4); iron.push(butt);
    const ironGeo = mergeGeometries(iron.map(stripExtra), false);
    this.model.add(new THREE.Mesh(ironGeo, ironMat));

    // ── prod (steel limbs) ──
    const prodCurve = new THREE.CatmullRomCurve3([
      this.tipL.clone(), new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), this.tipR.clone(),
    ], false, 'catmullrom', 0.5);
    const prodGeo = sweepRect(prodCurve, 40, (t) => 0.008 - Math.abs(t - 0.5) * 0.009, (t) => 0.021 - Math.abs(t - 0.5) * 0.022);
    this.model.add(new THREE.Mesh(prodGeo, prodMat));

    // ── string (2 legs + serving), updated every frame ──
    const legGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 1, 7); legGeo.translate(0, 0.5, 0);
    this.stringLeft = new THREE.Mesh(legGeo, cordMat); this.stringRight = new THREE.Mesh(legGeo, cordMat);
    const servGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.055, 8); servGeo.rotateZ(Math.PI / 2);
    this.serving = new THREE.Mesh(servGeo, cordMat);
    this.model.add(this.stringLeft, this.stringRight, this.serving);
    this.nockRest.set(0, 0.009, -0.215); this.nockDrawn.set(0, 0.009, 0.128);
    // cord whipping around the stock nose
    const wrap = new THREE.CylinderGeometry(0.031, 0.031, 0.024, 10); wrap.rotateX(Math.PI / 2); wrap.translate(0, -0.025, -0.34);
    this.model.add(new THREE.Mesh(wrap, cordMat));

    // ── leather grip ──
    const gripShape = new THREE.Shape(); // rounded rectangle section
    const gw = 0.026, gh = 0.047, gr = 0.012;
    gripShape.moveTo(-gw + gr, -gh); gripShape.lineTo(gw - gr, -gh); gripShape.quadraticCurveTo(gw, -gh, gw, -gh + gr);
    gripShape.lineTo(gw, gh - gr); gripShape.quadraticCurveTo(gw, gh, gw - gr, gh); gripShape.lineTo(-gw + gr, gh);
    gripShape.quadraticCurveTo(-gw, gh, -gw, gh - gr); gripShape.lineTo(-gw, -gh + gr); gripShape.quadraticCurveTo(-gw, -gh, -gw + gr, -gh);
    const grip = new THREE.ExtrudeGeometry(gripShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 3, curveSegments: 6 });
    grip.rotateX(0.35); grip.translate(0, -0.074, 0.30);
    const fw = 0.0245, fh = 0.033, fr = 0.009; const foreShape = new THREE.Shape();
    foreShape.moveTo(-fw + fr, -fh); foreShape.lineTo(fw - fr, -fh); foreShape.quadraticCurveTo(fw, -fh, fw, -fh + fr); foreShape.lineTo(fw, fh - fr); foreShape.quadraticCurveTo(fw, fh, fw - fr, fh); foreShape.lineTo(-fw + fr, fh); foreShape.quadraticCurveTo(-fw, fh, -fw, fh - fr); foreShape.lineTo(-fw, -fh + fr); foreShape.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
    const fore = new THREE.ExtrudeGeometry(foreShape, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
    fore.translate(0, -0.03, -0.24); // forearm wrap between the front band and the mid band
    this.model.add(new THREE.Mesh(fore, leatherMat));
    this.model.add(new THREE.Mesh(grip, leatherMat));

    // ── loaded bolt on the rail ──
    const atlas = makeBoltAtlas();
    this.boltGeo = buildBoltGeometry();
    this.boltMat = new THREE.MeshStandardMaterial({ map: atlas.map, normalMap: atlas.normalMap, aoMap: atlas.armMap, roughnessMap: atlas.armMap, metalnessMap: atlas.armMap, roughness: 1, metalness: 1, alphaTest: 0.5, side: THREE.DoubleSide });
    // one DoubleSide pass: the viewmodel makes this material transparent (below), and three draws a transparent
    // DoubleSide material as a BackSide + a FrontSide pass — two programs. The fletching is alpha-tested and the
    // bolt writes depth, so one pass looks the same.
    this.boltMat.forceSinglePass = true;
    this.boltMat.name = 'xbow-bolt'; fixIBL(this.boltMat, VIEWMODEL_GROUP); this.sky.setupMaterial(this.boltMat);
    this.loadedBolt = new THREE.Mesh(this.boltGeo, this.boltMat);
    this.loadedBolt.position.set(0, 0.0095, 0.128 - 0.18);
    this.model.add(this.loadedBolt);
    this.boltGeo.computeBoundingBox();
    const boltBox = this.boltGeo.boundingBox;
    if (boltBox === null) throw new Error('Crossbow: bolt geometry has no bounding box');
    this.tipLocal.set(0, 0, boltBox.min.z); this.nockZ = boltBox.max.z;
    this.tipModel.copy(this.tipLocal).add(this.loadedBolt.position);

    // ── rear peep sight: dark iron ring with a faint cyan inner edge, on a post rising from the rail (posed per frame) ──
    // the stock's program (see the materials above): 1×1 filler maps leave colour, roughness and metalness as set
    const peepIron = viewmodelMaterial(this.sky, 'xbow-peep', { color: new THREE.Color(0.05, 0.05, 0.055), roughness: 0.9, metalness: 0.75, emissive: new THREE.Color(PEEP_CYAN), emissiveIntensity: 0.05 });
    const peepGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(PEEP_CYAN), toneMapped: false, fog: false, opacity: 0.85 });
    this.peepMats.push(peepIron, peepGlow);
    const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R, PEEP_R * PEEP_TUBE, 10, 40), peepIron);
    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R * (1 - PEEP_TUBE * 0.85), PEEP_R * 0.025, 6, 40), peepGlow);
    this.peepRing.add(ringOuter, ringInner);
    const postGeo = new THREE.BoxGeometry(0.0025, 1, 0.002); postGeo.translate(0, -0.5, 0); // top at 0, scaled to reach the rail
    this.peepPost = new THREE.Mesh(postGeo, peepIron);
    this.peep.add(this.peepRing, this.peepPost);
    this.peep.visible = false;
    this.model.add(this.peep);

    // depth-clear so the viewmodel never clips into world geometry; render after everything opaque
    // The clearer and the viewmodel live in the *transparent* queue (renderOrder 999/1000) so the
    // depth clear happens after every world transparent (boundary lines, mist, halos) has drawn —
    // otherwise those would paint over the whole scene with the cleared depth buffer.
    // fog: false — it draws nothing, and without fog it shares the peep glow's (and the world's fogless MeshBasic) program
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m !== clearer;
      if (m === clearer) return;
      m.renderOrder = 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.depthWrite = true; }
    });
    this.model.scale.setScalar(1.35);
  }

  private buildProjectiles(): void {
    for (let i = 0; i < MAX_FLYING; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false; mesh.castShadow = true; mesh.frustumCulled = false;
      // red glow riding on the flying bolt (a child, so it hides with it; shown only on traced shots)
      const glow = new THREE.Mesh(boltGlowGeo, glowMat); glow.renderOrder = TRACER_ORDER + 1; glow.position.set(0, 0, this.tipLocal.z + 0.05); glow.visible = false;
      mesh.add(glow);
      this.game.scene.add(mesh);
      this.bolts.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), active: false, age: 0, roll: 0, traced: false, tracer: null, glow, glanced: false });
    }
    for (let i = 0; i < MAX_TRACERS; i++) this.tracers.push(new Tracer(this.game.scene));
  }
  /** a free tracer, else the one closest to expiring (oldest) */
  private takeTracer(): Tracer | null {
    let best: Tracer | null = null;
    for (const t of this.tracers) { if (!t.active) return t; if (t.endTime >= 0 && (!best || t.endTime < best.endTime)) best = t; }
    best ??= this.tracers[0] ?? null; // all 8 still flying: recycle the first
    for (const b of this.bolts) if (b.tracer === best) b.tracer = null;
    return best;
  }
  private endTracer(b: Bolt, point: THREE.Vector3): void {
    if (!b.tracer) return;
    b.tracer.finish(point, this.time);
    b.tracer = null;
  }

  /** world position of the loaded bolt's broadhead tip (the iron sight) */
  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.loadedBolt.localToWorld(out.copy(this.tipLocal)); }
  /** The aim line is ALWAYS the camera forward (the crosshair / the peep ring's centre), hip or sighted — the user
   *  found sighted shots landing low when they flew along the eye→tip ray. Sighted bolts start at the tip, which is
   *  a few cm under the eye, and fly parallel to the forward: at any range that is the same point as the hip shot. */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const cam = this.game.camera;
    cam.getWorldDirection(dir);
    origin.copy(cam.position);
    return dir;
  }

  private spawnBolt(): void {
    let b = this.bolts.find((x) => !x.active);
    b ??= this.bolts.reduce((a, x) => (x.age > a.age ? x : a));
    const cam = this.game.camera, a = sstep(0, 1, this.adsBlend);
    this.aimRay(_v3, _fwd);
    // spread: tight at ADS, a touch wider from the hip
    const spread = THREE.MathUtils.degToRad(0.15 + (1 - a) * 0.6);
    _dir.copy(_fwd);
    _v1.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).cross(_fwd).normalize();
    _dir.addScaledVector(_v1, Math.tan(spread * Math.random())).normalize();
    // hip: start where the rail bolt is (so it visibly leaves the weapon) pulled most of the way onto the aim line;
    // sighted: from the tip itself, which lies on the sight ray, so the flight stays under the tip all the way out
    this.loadedBolt.getWorldPosition(this.spawnPos);
    cam.getWorldDirection(_v2).multiplyScalar(0.35).add(cam.position);
    this.spawnPos.lerp(_v2, 0.8);
    b.pos.copy(this.spawnPos).lerp(this.tipWorld(_v2), a);
    b.vel.copy(_dir).multiplyScalar(BOLT_SPEED);
    b.active = true; b.age = 0; b.roll = 0; b.glanced = false;
    b.mesh.visible = true;
    b.mesh.position.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir);
    if (b.tracer) b.tracer.finish(b.pos, this.time); // slot stolen mid-flight: close its old trail
    b.traced = getSetting('tracers'); // read per shot: a pause-menu flip applies to the next bolt
    b.tracer = b.traced ? this.takeTracer() : null;
    b.tracer?.begin(b.pos);
    b.glow.visible = b.traced;
  }

  /**
   * Iron-sights pose, derived once per (aspect, fov, scale): model rotation is (ADS_PITCH, 0, 0) so the bolt runs
   * parallel to the camera forward, and the translation puts the tip on the ray to NDC (0, ADS_TIP_NDC_Y).
   * With the tip depth D and the eye h above the bolt: h = -ADS_TIP_NDC_Y·tan(fov/2)·D. The nut sits A = (nut.z - tip.z)·scale
   * behind the tip, at depth D - A; asking for it at ADS_NUT_NDC_Y gives one linear equation in D. The near plane
   * (+ margin) caps how close the nut may come, which is what limits the 94° portrait frame.
   */
  private solveAds(cam: THREE.PerspectiveCamera, scale: number): Crossbow['adsPose'] {
    const c = this.adsCache, o = this.adsPose;
    if (c.aspect === cam.aspect && c.fov === cam.fov && c.scale === scale) return o;
    c.aspect = cam.aspect; c.fov = cam.fov; c.scale = scale;
    // Shouldered: the stock is pulled up under the cheek so the eye sits a few cm above the rail and looks straight down
    // the bolt; the nut is as close as the near plane allows (that is what "pinned into the shoulder" looks like).
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), th = tv * cam.aspect;
    const tip = this.tipModel, nut = this.nockDrawn;
    const A = (nut.z - tip.z) * scale;
    const nutDepth = cam.near + ADS_NEAR_MARGIN;
    const D = nutDepth + A;
    o.px = 0; o.py = -ADS_EYE_ABOVE_RAIL; o.pz = -D - tip.z * scale; o.rx = ADS_PITCH; o.scale = scale;
    o.tipDepth = D; o.eyeAboveRail = ADS_EYE_ABOVE_RAIL; o.nutDepth = nutDepth;
    o.nutNdcY = (nut.y * scale + o.py) / (nutDepth * tv); o.tipNdcY = (tip.y * scale + o.py) / (D * tv);
    o.limbNdcX = (this.tipR.x * scale) / (-(this.tipR.z * scale + o.pz) * th);
    // peep: a real rear sight MOUNTED ON THE STOCK at model z = PEEP_Z, its centre exactly at eye height (on the forward
    // line → screen centre); fixed physical size, so the post is short and the ring reads as part of the weapon.
    o.peepZ = PEEP_Z; o.peepY = ADS_EYE_ABOVE_RAIL / scale; o.peepDepth = -(o.pz + PEEP_Z * scale);
    o.peepR = PEEP_R_WORLD;
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceFire += dt;

    // auto reload
    if (!this.state.loaded && !this.state.reloading && this.state.bolts > 0 && this.sinceFire > AUTO_RELOAD_DELAY) this.reload();
    if (this.state.reloading) {
      this.reloadT += dt / this.reloadScale;
      const pr = Math.min(1, this.reloadT / RELOAD_DURATION);
      this.state.reloadProgress = pr;
      this.drawTarget = sstep(0.18, 0.78, pr);
      if (pr >= 1) { this.state.reloading = false; this.state.loaded = true; this.drawTarget = 1; this.onReloadEnd?.(); }
    }
    // string spring (stiff, slightly under-damped so the release overshoots)
    const k = this.state.reloading ? 260 : 1400, c = this.state.reloading ? 28 : 34;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.updateString();

    // loaded bolt: visible once the reload is ~85 % through (slides in from the rear)
    const showBolt = this.state.loaded || (this.state.reloading && this.state.reloadProgress > 0.8);
    this.loadedBolt.visible = showBolt;
    if (showBolt && this.state.reloading) {
      const slide = 1 - sstep(0.8, 1, this.state.reloadProgress);
      this.loadedBolt.position.z = 0.128 - 0.18 + slide * 0.12;
      this.loadedBolt.position.y = 0.0095 + slide * 0.02;
    } else { this.loadedBolt.position.z = 0.128 - 0.18; this.loadedBolt.position.y = 0.0095; }

    // ADS + FOV
    if (p.sprinting || !this.enabled) this.mouseAds = false; // sprinting / pause / holster drop the RMB toggle
    this.state.ads = (this.mouseAds || this.adsHeld) && this.enabled && !this.state.reloading && !p.sprinting;
    { const step = dt / ADS_BLEND_TIME; this.adsBlend = clamp01(this.adsBlend + THREE.MathUtils.clamp((this.state.ads ? 1 : 0) - this.adsBlend, -step, step)); }
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (kick up on fire, recover smoothly)
    this.recoil *= Math.exp(-dt * 9);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, KICK_PITCH * dt * 40); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    // stiff spring (k=220): explicit Euler blows up once k·dt² > 1 (≈ 15 fps on a phone) → substep at ≤ 1/120 s
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = this.state.reloading ? Math.sin(Math.min(1, this.state.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt; // portrait: the sprint swing would fill the frame
    // portrait phone: the wider FOV + narrow frame make the bow fill the screen — hold it lower, further out, smaller
    const port = portrait, scale = 1.35 * (1 - port * 0.55);
    // shared motion: breathing / idle sway, walk bob (counter-phase to the camera bob → the weapon feels heavy),
    // look lag (spring), recoil. The hip takes it in full, the sights ~30 % (ADS_MOTION) so the tip stays on the aim line.
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.016 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.012 * sf, bobRz = Math.cos(p.bobTime) * 0.02 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.01 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil;
    // hip: lower-right (Skyrim)
    let px = 0.12, py = -0.165, pz = -0.27, rx = 0.035, ry = 0.13, rz = 0.04;
    // sprint: drop and swing across the body
    px += sp * -0.05; py += sp * -0.09; pz += sp * 0.04; rx += sp * 0.32; ry += sp * 0.45; rz += sp * -0.15;
    // reload: tilt the bow up-left to reach the string, crank shake
    const crank = this.state.reloading ? Math.sin(this.state.reloadProgress * Math.PI * 14) * (this.state.reloadProgress > 0.15 && this.state.reloadProgress < 0.8 ? 1 : 0) : 0;
    px += rt * -0.06; py += rt * -0.05; pz += rt * 0.02; rx += rt * 0.35 + crank * 0.008; ry += rt * -0.28; rz += rt * 0.42 + crank * 0.012;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.07; py += rc * 0.015; rx += rc * 0.12; rz += rc * -0.03;
    // target: the whole prod visible inside ~60 % of the screen width (prod ≈ 0.68 m × scale at |pz| + 0.3 × scale)
    px *= 1 - port * 0.25; py *= 1 + port * 0.7; pz *= 1 + port * 1.5;
    // iron sights: cheek on the stock, looking straight down the bolt — pose solved from the geometry (solveAds);
    // recoil kicks the muzzle up but barely back, the nut is already a hair in front of the near plane
    if (a > 0) {
      const ads = this.solveAds(cam, scale), m = ADS_MOTION;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.01, az = ads.pz + rc * 0.015;
      const arx = ads.rx + (bobRx + lagRx) * m + rc * 0.1, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.02;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }

    // peep sight: posed from the solve, faded with the blend (its centre, the eye and the tip are collinear at a = 1)
    if (a > 0.001 && !this.inspect) {
      const ads = this.solveAds(cam, scale);
      this.peep.visible = true;
      this.peep.position.set(0, ads.peepY, ads.peepZ);
      this.peepRing.scale.setScalar(ads.peepR / (scale * PEEP_R));
      this.peepPost.scale.y = Math.max(0.001, ads.peepY);
      for (const m of this.peepMats) m.opacity = a;
    } else this.peep.visible = false;

    if (this.inspect) { px = 0.02; py = -0.02; pz = -0.42; rx = 0.35; ry = 0.9 + Math.sin(t * 0.25) * 0.5; rz = 0.1; }
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.32; pz += h * 0.08; rx -= h * 0.55; rz += h * 0.25; } // weapon swap: drop out of the frame
    this.model.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 14) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout
    if (this.targets && (++this.aimFrame & 3) === 0) {
      this.model.updateMatrixWorld(); // the pose was just set; the sight ray goes through the tip
      this.aimRay(_v3, _fwd);
      // an animal behind a wall shows no range (P5-L2): the world hit along the sight ray caps the reach
      const wall = worldHit(_v3, _aimEnd.copy(_v3).addScaledVector(_fwd, 120), 0);
      const hit = this.targets.raycast(_v3, _fwd, wall?.distance ?? 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBolts(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, cam, this.tracerRes);
  }

  private updateString(): void {
    const d = THREE.MathUtils.clamp(this.draw, -0.12, 1.05);
    const nock = _v1.copy(this.nockRest).lerp(this.nockDrawn, d);
    nock.y = this.nockRest.y + (1 - Math.abs(d - 0.5) * 2) * 0.002;
    this.placeLeg(this.stringLeft, this.tipL, nock);
    this.placeLeg(this.stringRight, this.tipR, nock);
    this.serving.position.copy(nock);
    this.serving.quaternion.setFromUnitVectors(X_AXIS, _v2.subVectors(this.tipR, this.tipL).normalize());
  }
  private placeLeg(leg: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    leg.position.copy(from);
    _v3.subVectors(to, from);
    const len = _v3.length();
    leg.scale.set(1, len, 1);
    leg.quaternion.setFromUnitVectors(Y_AXIS, _v3.multiplyScalar(1 / len));
  }

  // ── projectiles ──
  private stepBolts(dt: number): void {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.age += dt;
      const sub = 4, h = dt / sub;
      let stopped = false;
      for (let s = 0; s < sub; s++) {
        _v1.copy(b.pos); // previous
        b.vel.y -= GRAVITY * h;
        b.vel.multiplyScalar(1 - BOLT_DRAG * h * b.vel.length() * 0.1);
        b.pos.addScaledVector(b.vel, h);
        if (this.testHit(b, _v1)) { stopped = true; break; }
        b.tracer?.addPoint(b.pos);
      }
      if (stopped) continue;
      if (Math.abs(b.pos.x) > CHUNK_HALF + 60 || Math.abs(b.pos.z) > CHUNK_HALF + 60 || b.pos.y < -150 || b.age > 12) { b.active = false; b.mesh.visible = false; this.endTracer(b, b.pos); continue; }
      b.mesh.position.copy(b.pos);
      _dir.copy(b.vel).normalize();
      b.roll += dt * 14;
      b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(NEG_Z, b.roll));
      if (b.traced) b.glow.scale.setScalar(Math.max(1, TRACER_PX * b.pos.distanceTo(this.game.camera.position)));
    }
  }

  /**
   * The step prev → b.pos: the nearer of an animal (AnimalManager.raycast, cut short at the world hit so a wall in
   * front wins) and the world (a BOLT_RADIUS ball swept through the physics world — terrain, trunks, rocks,
   * structures). By the surface's material the bolt sticks (wood, planks, ground, sand, grass), or glances off
   * (stone, rock, metal, shell): a short skip with most of its speed lost, then it lies on the first floor it falls on
   * (knocking off any wall on the way).
   * Returns true when the bolt stopped.
   */
  private testHit(b: Bolt, prev: THREE.Vector3): boolean {
    _dir.subVectors(b.pos, prev);
    const segLen = _dir.length();
    if (segLen < 1e-6) return false;
    _dir.multiplyScalar(1 / segLen);
    const wall = worldHit(prev, b.pos, BOLT_RADIUS);

    // animals, short of the wall
    if (this.targets) {
      const hit = this.targets.raycast(prev, _dir, wall ? wall.distance : segLen);
      if (hit) {
        const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.point.distanceTo(this.game.camera.position)), hit.point, _dir);
        this.onHit?.(hit.animal.kind, hit.headshot, killed);
        this.stopBolt(b, hit.point, _dir, 'flesh', false);
        return true;
      }
    }
    if (!wall) return false;
    const n = _v2.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(_dir) > 0) n.negate(); // facing the bolt
    const at = _v3.set(wall.point.x, wall.point.y, wall.point.z); // the ball's centre, touching the surface
    if (b.glanced && n.y >= 0.5) { this.restBolt(b, at, n); return true; } // a spent bolt lies where it lands
    const surface = impactSurfaceOf(wall.material);
    if (!b.glanced && sticksIn(wall.material)) {
      // the ball touches one radius off the surface: the tip carries on along the flight to it
      at.addScaledVector(_dir, BOLT_RADIUS / Math.max(0.25, -n.dot(_dir)));
      this.stopBolt(b, at, _dir, surface, true, STUCK_BURY, false, movingOwner(wall.owner));
      return true;
    }
    // glance: off the surface with little of the speed left, then gravity has it
    at.addScaledVector(n, GLANCE_LIFT);
    if (!b.glanced) { this.puffs.emit(at, _dir, surface); this.onImpact?.(surface, at); } // a spent bolt knocks off walls quietly
    const vn = b.vel.dot(n);
    b.vel.addScaledVector(n, -vn).multiplyScalar(GLANCE_KEEP).addScaledVector(n, -vn * GLANCE_BOUNCE);
    if (b.vel.length() > GLANCE_MAX) b.vel.setLength(GLANCE_MAX);
    b.pos.copy(at);
    b.glanced = true;
    return false;
  }

  /** A spent (glanced) bolt comes to rest lying on the surface it fell onto: along its travel, flat to the surface. */
  private restBolt(b: Bolt, at: THREE.Vector3, n: THREE.Vector3): void {
    const along = _v1.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.crossVectors(n, Math.abs(n.y) < 0.9 ? Y_AXIS : X_AXIS); // fell straight down: any way along the surface
    along.normalize();
    // the tip half a bolt ahead of the contact so the shaft lies across it, on the surface instead of a radius above it
    at.addScaledVector(n, -BOLT_RADIUS * 0.8).addScaledVector(along, (this.nockZ - this.tipLocal.z) * 0.5);
    this.stopBolt(b, at, along, 'ground', true, 0, true);
  }

  /** `bury`: how deep the broadhead goes in; `quiet`: no puff / impact event (a spent bolt settling) */
  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean, bury = STUCK_BURY, quiet = false, rideOn: THREE.Object3D | null = null): void {
    b.active = false; b.mesh.visible = false;
    this.endTracer(b, point);
    if (!quiet) {
      this.puffs.emit(point, dir, surface);
      this.onImpact?.(surface, point);
    }
    if (!stick) return;
    // stick: a static mesh, permanent, with the broadhead STUCK_BURY into the surface and the shaft + fletching
    // standing proud. The geometry origin sits -tipLocal.z (≈ 21.5 cm, measured from the bounding box) behind
    // the tip, so the origin goes STUCK_BURY + tipLocal.z along the flight direction from the hit point.
    if (this.stuck.length >= MAX_STUCK) this.removeStuck(0);
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.castShadow = true;
    mesh.position.copy(point).addScaledVector(dir, bury + this.tipLocal.z);
    mesh.quaternion.setFromUnitVectors(NEG_Z, dir).multiply(_q.setFromAxisAngle(NEG_Z, b.roll));
    if (b.traced) { // permanent red dot on the nock so a traced bolt reads from a distance
      const dot = new THREE.Mesh(stuckDotGeo, glowMat); dot.renderOrder = TRACER_ORDER + 1;
      dot.position.set(0, 0, this.nockZ);
      mesh.add(dot);
    }
    this.game.scene.add(mesh);
    if (rideOn !== null) rideOn.attach(mesh); // stuck in something that moves (the boat, a door): it rides along (P5-L1)
    this.stuck.push({ mesh });
  }
  private removeStuck(i: number): void {
    const s = this.stuck.splice(i, 1)[0];
    if (s !== undefined) s.mesh.removeFromParent();
  }

  /** flying bolt count (for debugging / HUD) */
  get inFlight(): number { let n = 0; for (const b of this.bolts) if (b.active) n++; return n; }
  get stuckCount(): number { return this.stuck.length; }
}

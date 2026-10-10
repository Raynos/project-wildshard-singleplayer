import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadPBR, loadGLTF, pbrMaterial, type PBRSet } from '@wildshard/engine/core/assets';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { twoSidedPositions, type WeldBuild } from '@wildshard/engine/models/weld';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineSetCap } from '../debug/options';
import { CABIN_DOOR_EDITS, CABIN_MOSS_EDITS, CABIN_PARTICLE_GLSL, CABIN_PARTICLE_KINDS } from '../data/cabinLook';
import { mergeParts, type PropPart } from '../models/logCabin';
import { PROP_KINDS, type Door, type Fire, type Floor, type LightAnchor, type PropKind, type Room, type Swing } from './logKit';
import { CABIN_ROWS, LogBuilding, loadCabinBake, type BuildingOwner, type CabinGeometries } from './cabinBake';

/**
 * Pine Hollow's homestead: the three log cabins and the mill hamlet's five buildings, as a living place (E347: its log kit
 * and the buildings' drawing moved onto the model contract — src/shards/pine-hollow/models/logCabin.ts builds each
 * building where it stands, `place` merges and welds them and drops their detail with distance,
 * src/shards/pine-hollow/world/cabins.ts).
 *
 *   const cabins = new Cabins(sky);
 *   const { group, interactables } = await cabins.build();     // every building built where it stands, one per task
 *   scene.add(group);
 *   await placeCabins({ cabins, sky, registry });              // their models placed: drawn, registered
 *   game.onUpdate((dt, t) => cabins.update(dt, t));
 *
 * - `group`         the buildings' roots (doors, fires, smoke, lanterns, the wheel) and what `place` draws of them.
 * - `interactables` one per door: `{ position, radius, label, onInteract() }`. `label` toggles
 *                   "Open door" / "Close door". Call `onInteract()` from the HUD's use key.
 * - `update(dt, t)` door swing (0.6 s ease in-out), fire / lantern flicker on the clock, the phone's pooled lights, the wheel.
 * - `floorHeightAt(x, z)` → world y of a cabin floor / porch deck under (x,z), or undefined.
 * - `firePits`      `{ x, y, z }` of the camp fires (audio / warmth logic).
 * - `colliderDescs()` PHYSICS P3: the static collision as real geometry (walls, floors, porch + its step, furniture);
 *                   `doorPieces()` the door slabs, in each door pivot's frame, for kinematic pieces that swing with it.
 *
 * The kit's materials (the Poly Haven PBR sets, the moss, the particles) are here: the landmarks' timber shares them.
 */

/** `weak`: shown only when no other prompt is in reach (the saddle's Dismount: it hid the Wind Cairn's tie, E288) */


// ───────────────────────────── materials ─────────────────────────────

export interface Mats {
  log: THREE.MeshStandardMaterial; endGrain: THREE.MeshStandardMaterial; chink: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial; beam: THREE.MeshStandardMaterial; deck: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial;
  char: THREE.MeshStandardMaterial;
  smoke: THREE.ShaderMaterial; flame: THREE.ShaderMaterial; ember: THREE.ShaderMaterial; glow: THREE.MeshBasicMaterial;
}
export type MatKey = Exclude<keyof Mats, 'smoke' | 'flame' | 'ember' | 'glow' | 'glass'>;

const matsCache = new WeakMap<Sky, Promise<Mats>>();
/** the cabins' PBR materials, loaded once per sky and shared (PH-B3: the landmarks build with the same set — no new programs) */
export function cabinMats(sky: Sky): Promise<Mats> {
  let p = matsCache.get(sky);
  if (p === undefined) { p = loadMats(sky); matsCache.set(sky, p);
    const cached = p; void cacheUntilDisposed(cached, () => { if (matsCache.get(sky) === cached) matsCache.delete(sky); }); }
  return p;
}

async function loadMats(sky: Sky): Promise<Mats> {
  const cap = pineSetCap(TIER_CONFIG.maxTexture); // G180 B1: 512² on the phone with the memory trim on
  const [logSet, roofSet, beamSet, deckSet, doorSet, stoneSet, barkSet] = await Promise.all([
    loadPBR('wood_trunk_wall', 1, cap), loadPBR('wood_planks_grey', 1, cap), loadPBR('wood_planks_grey', 1, cap), loadPBR('wood_planks_dirt', 1, cap),
    loadPBR('rough_pine_door', 1, cap), loadPBR('stone_wall', 1, cap), loadPBR('pine_bark', 1, cap),
  ]);
  const std = (set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}) => pbrMaterial(set, { metalness: 0, ...extra });
  const m: Mats = {
    log: std(logSet, { color: new THREE.Color(0.95, 0.9, 0.84), normalScale: new THREE.Vector2(0.8, 0.8) }),
    endGrain: new THREE.MeshStandardMaterial({ map: makeEndGrainTexture(), roughness: 0.95, metalness: 0, color: 0xb0a48e }),
    chink: new THREE.MeshStandardMaterial({ color: 0x4d473f, roughness: 1, metalness: 0 }),
    roof: std(roofSet, { color: new THREE.Color(0.46, 0.43, 0.39), normalScale: new THREE.Vector2(1.3, 1.3) }),
    beam: std(beamSet, { color: new THREE.Color(0.9, 0.86, 0.8) }),
    deck: std(deckSet),
    door: std(doorSet, { color: new THREE.Color(0.72, 0.68, 0.62) }),
    stone: std(stoneSet, { color: new THREE.Color(0.58, 0.56, 0.53) }),
    glass: new THREE.MeshStandardMaterial({ // Standard, not Physical: same look, and it shares the double-sided program with the fire pit
      color: 0x0a0c0e, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.66, envMapIntensity: 0.8,
      emissive: new THREE.Color(1.0, 0.5, 0.17), emissiveIntensity: 1.15, side: THREE.DoubleSide, depthWrite: false,
    }),
    bark: std(barkSet, { color: new THREE.Color(0.85, 0.8, 0.75) }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.6, metalness: 0.75 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }),
    char: new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.95, metalness: 0, emissive: 0xff4a08, emissiveIntensity: 0.12 }),
    smoke: makeParticleMaterial('smoke', sky),
    flame: makeParticleMaterial('flame', sky),
    ember: makeParticleMaterial('ember', sky),
    glow: new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  };
  installMoss(m.roof, sky, 'roof');
  installMoss(m.stone, sky, 'stone');
  // the rough_pine_door scan is a saturated orange-red: pull it toward a weathered grey-brown in the shader
  patchShader(m.door, 'pine.cabin-door', PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    editShader(shader, CABIN_DOOR_EDITS); // ../data/cabinLook.ts
  }, { mode: 'replace', key: 'cabin-door' });
  for (const k of ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'glass', 'bark', 'iron', 'cloth', 'char'] as const) sky.setupMaterial(m[k]);
  return m;
}

function makeEndGrainTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  g.fillStyle = '#9d8b6c'; g.fillRect(0, 0, 256, 256);
  const rng = new Rng(SEED + 31);
  // weathering speckle
  for (let i = 0; i < 6000; i++) { g.fillStyle = rng.next() < 0.5 ? 'rgba(60,45,30,0.25)' : 'rgba(200,185,160,0.2)'; g.fillRect(rng.range(0, 256), rng.range(0, 256), 1 + rng.range(0, 2), 1 + rng.range(0, 2)); }
  for (let r = 4; r < 128; r += 3 + rng.range(0, 4)) {
    g.beginPath();
    for (let a = 0; a <= 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      const rr = r * (1 + 0.05 * Math.sin(th * 3 + r) + 0.03 * Math.sin(th * 7));
      const x = 128 + Math.cos(th) * rr, y = 128 + Math.sin(th) * rr;
      if (a > 0) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = rng.next() < 0.5 ? 'rgba(70,50,30,0.5)' : 'rgba(110,85,55,0.35)';
    g.lineWidth = 0.8 + rng.range(0, 1.4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,28,15,0.8)';
  for (let i = 0; i < 7; i++) { const th = rng.range(0, Math.PI * 2), l = rng.range(50, 122); g.lineWidth = 1 + rng.range(0, 2); g.beginPath(); g.moveTo(128 + Math.cos(th) * 8, 128 + Math.sin(th) * 8); g.lineTo(128 + Math.cos(th + 0.05) * l, 128 + Math.sin(th + 0.05) * l); g.stroke(); }
  g.strokeStyle = '#3d2c1c'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeNoiseTexture() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Cabin: no 2d canvas context');
  const img = g.createImageData(s, s);
  const rng = new Rng(SEED + 77);
  const oct = [8, 16, 32].map((n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng.next(); return { n, a }; });
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let v = 0, amp = 0.55, sum = 0;
    for (const { n, a } of oct) {
      const fx = (x / s) * n, fy = (y / s) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const q = (i: number, j: number) => a[((j + n) % n) * n + ((i + n) % n)] ?? 0;
      const vv = (q(x0, y0) * (1 - tx) + q(x0 + 1, y0) * tx) * (1 - ty) + (q(x0, y0 + 1) * (1 - tx) + q(x0 + 1, y0 + 1) * tx) * ty;
      v += vv * amp; sum += amp; amp *= 0.5;
    }
    const b = Math.floor((v / sum) * 255), i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

let noiseTex: THREE.Texture | undefined;

/** the night's hold on the cabins' particles: uShade dims the smoke's shadow side, uLamps lights the chimney glow (Cabins.update) */
const cabinNight = { uShade: { value: 1 }, uLamps: { value: 1 } };
/** the phone's pooled cabin lights (PH-L3) */
const SHARED_CABIN_LIGHTS = 2;

/** Billboard particle material driven entirely by uTime (no per-frame CPU work). */
function makeParticleMaterial(kind: 'smoke' | 'flame' | 'ember', sky: Sky) {
  noiseTex ??= cacheUntilDisposed(makeNoiseTexture(), () => { noiseTex = undefined; });
  const cfg = CABIN_PARTICLE_KINDS[kind];
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 }, uLife: { value: cfg.life }, uRise: { value: cfg.rise }, uSpread: { value: cfg.spread },
    uSize: { value: new THREE.Vector2(cfg.size[0], cfg.size[1]) }, uWind: { value: new THREE.Vector3(...cfg.wind) }, tNoise: { value: noiseTex },
    uSunDir: { value: sky.sunDir }, uSunColor: { value: sky.sunColor }, uShade: cabinNight.uShade, uLamps: cabinNight.uLamps, // the sky's own: the clock moves them
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uKind: { value: { smoke: 0, flame: 1, ember: 2 }[kind] },
  };
  return new THREE.ShaderMaterial({
    // one program for smoke / flame / ember (../data/cabinLook.ts `CABIN_PARTICLE_GLSL`: the kind is a uniform branch)
    uniforms, transparent: true, depthWrite: false, blending: cfg.blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true, side: THREE.DoubleSide,
    vertexShader: CABIN_PARTICLE_GLSL.vertex,
    fragmentShader: CABIN_PARTICLE_GLSL.fragment,
  });
}

/** `instanceof THREE.Mesh` narrows to `Mesh<any, any>`; this keeps the default generics */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;

/**
 * Procedural moss / lichen overlay: value-noise patches in world space, denser where the `moss`
 * vertex attribute is high (eaves, foundation base) and on faces turned away from the sun, with a
 * soft normal bump along the patch edges (the GLSL edits: ../data/cabinLook.ts `CABIN_MOSS_EDITS`).
 */
function installMoss(mat: THREE.MeshStandardMaterial, sky: Sky, kind: 'roof' | 'stone') {
  const strength = kind === 'roof' ? 1.0 : 0.6;
  patchShader(mat, 'pine.cabin-moss', PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    shader.uniforms['uMossSun'] = { value: sky.sunDir };
    shader.uniforms['uMossStrength'] = { value: strength };
    shader.uniforms['uMossUpOnly'] = { value: kind === 'roof' ? 1.0 : 0.0 };
    editShader(shader, CABIN_MOSS_EDITS); // ../data/cabinLook.ts
  }, { mode: 'replace', key: 'cabin-moss' }); // strength / upOnly are uniforms: roof and stone share one program
}

// ───────────────────────────── the homestead ─────────────────────────────


/** a prop kind the buildings set about (E315 M2: each is a model — src/shards/pine-hollow/models/) */
export type CabinPropKind = PropKind;
export const CABIN_PROP_KINDS: readonly CabinPropKind[] = PROP_KINDS;

/**
 * One building as its model sees it (E315 M2 / E347): which (the 3 cabins in CABIN_SITES order, then the extras), where it
 * stands, what it collides with and stands on (world space, the doors apart), the props it set about (world matrices), its
 * fire pit and porch lantern, and what its model hands `place` (`weld`).
 */
export interface CabinBuilding {
  readonly id: string;
  readonly index: number;
  readonly x: number; readonly y: number; readonly z: number; readonly rot: number;
  /** its own root: what draws with it alone (its door, lantern, fire pit, smoke, wheel), and a cabin's merged parts */
  readonly root: THREE.Object3D;
  /** a mill-hamlet building: welded into the hamlet's one set (`Cabins.cluster`) */
  readonly hamlet: boolean;
  readonly colliders: readonly ColliderDesc[];
  readonly floors: readonly { x: number; z: number; rot: number; hw: number; hd: number; y: number }[];
  readonly props: Readonly<Record<CabinPropKind, readonly THREE.Matrix4[]>>;
  readonly firePit: THREE.Object3D | null;
  readonly lantern: THREE.Object3D | null;
  /** what its model hands `place` (src/engine/models/weld.ts) */
  readonly weld: WeldBuild;
}

/** a place the phone's pooled lights may visit: a building (its anchors, rooms and door) or a lamp site */
interface LightSite { root: THREE.Object3D; anchors: LightAnchor[]; lit?: () => boolean; rooms?: readonly Room[]; door?: [number, number] }

export class Cabins implements BuildingOwner {
  group = new THREE.Group();
  /** the hamlet's one set: its root, posed at the hamlet's centre (null without extra buildings); `place` welds into it */
  cluster: THREE.Group | null = null;
  /** metres the hamlet's buildings stand from its root (its detail bands are this much longer) */
  clusterPad = 0;
  /** radians per second of every mill wheel (the miller's errand can stop it: 0) */
  wheelSpeed = 0.55;
  private wheels: THREE.Object3D[] = [];
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  firePits: { x: number; y: number; z: number }[] = [];
  private doors: Door[] = [];
  private fires: Fire[] = [];
  private swings: Swing[] = [];
  private particleMats = new Set<THREE.ShaderMaterial>();
  private floors: Floor[] = [];
  /** PHYSICS P3: static boxes that are only in colliderDescs() (floors, porch, step, plinth, furniture, props) */
  private solids: ColliderDesc[] = [];
  /** the buildings and the lamp sites the phone's pooled lights may visit, in that order */
  private sites: LightSite[] = [];
  /** phone tier: the one shared set of point lights, taken from the scene's LightPool at boot (a constant NUM_POINT_LIGHTS
   *  keeps every shader from recompiling); they follow the nearest cabin's top-ranked anchors */
  private sharedLights: THREE.PointLight[] = [];
  /** emissive materials lit by the clock (window glass, lantern glass) and their full-night intensity (PH-L3) */
  private lampMats: { mat: THREE.MeshStandardMaterial; full: number }[] = [];
  private nearestCabin = -1;
  /** the eye is inside the nearest building (or at its door): its room lamp + hearth take the pooled pair */
  private indoors = false;
  /** the nearest building's anchors in the order the pooled pair takes them */
  private order: LightAnchor[] = [];
  private tmpL = new THREE.Vector3();
  private cabinCount = 0;
  private tmpV = new THREE.Vector3();
  /** every building, as its model sees it (E315 M2) */
  readonly buildings: CabinBuilding[] = [];
  /** what the buildings were built from: kept for the Model Explorer's specimens */
  private loaded: { mats: Mats; props: Record<PropKind, PropPart[]>; firePit: THREE.Object3D; lantern: THREE.Object3D; geometries: CabinGeometries } | null = null;

  constructor(private sky: Sky) {}

  /** what the buildings were built from (their materials, the props' scans, the fire pit and the lantern, the bake); null before `build` */
  get kit(): { readonly mats: Mats; readonly props: Readonly<Record<PropKind, readonly PropPart[]>>; readonly firePit: THREE.Object3D; readonly lantern: THREE.Object3D; readonly geometries: CabinGeometries } | null { return this.loaded; }

  /** what the building just built by `b` is, for its model */
  private record(b: LogBuilding, id: string, index: number, x: number, y: number, z: number, rot: number, hamlet: boolean): void {
    this.buildings.push({ id, index, x, y, z, rot, root: b.root, hamlet, colliders: b.colliderDescs(), floors: b.floors, props: b.props, firePit: b.firePitObj, lantern: b.lanternObj, weld: b.weldBuild() });
    this.sites.push({ root: b.root, anchors: b.anchors, rooms: b.rooms, door: b.doorAt });
  }

  /** a prop kind's parts (for its model's specimen), their node transforms baked in; null before `build` */
  propParts(kind: CabinPropKind): readonly PropPart[] | null { return this.loaded?.props[kind] ?? null; }
  /** the fire pit's and the lantern's loaded models (for their models' specimens); null before `build` */
  get models(): { firePit: THREE.Object3D; lantern: THREE.Object3D } | null { return this.loaded ? { firePit: this.loaded.firePit, lantern: this.loaded.lantern } : null; }

  /**
   * Assemble every building where it stands from the offline bake (../generators/logCabin.ts → ./cabinBake.ts), one per
   * task: the cabins, then the hamlet (its root posed at its centre). Nothing is drawn merged yet: `placeCabins` places
   * their models. A bake that did not load leaves no buildings (a page fault).
   */
  async build(): Promise<{ group: THREE.Group; colliders: Collider[]; interactables: Interactable[] }> {
    // the seven PBR sets, the six models and the bake in one round of fetches
    const [mats, [firePitGltf, lanternGltf, crate, barrel, bucket, hatchet], geometries] = await Promise.all([cabinMats(this.sky), Promise.all([
      loadGLTF('stone_fire_pit'), loadLod('Lantern_01'), loadGLTF('wooden_crate_02'), loadGLTF('wine_barrel_01'), loadGLTF('wooden_bucket_01'), loadGLTF('hatchet'),
    ]), loadCabinBake()]);
    // each model's parts share one material: merged into one part, a cabin's crates / barrels / buckets are one draw each (9 → 4)
    const props = { crate: mergeParts(prepModel(crate.scene, this.sky)), barrel: mergeParts(prepModel(barrel.scene, this.sky)), bucket: mergeParts(prepModel(bucket.scene, this.sky)), hatchet: mergeParts(prepModel(hatchet.scene, this.sky)) };
    this._lamp(mats.glass, mats.glass.emissiveIntensity);
    // the phone's shared cabin lights (PH-L3): TWO pooled lights, not one per anchor — every point light is per-fragment
    // cost on every lit surface, grass included; the nearest cabin's fire pit and porch lantern (else its room / hearth)
    if (TIER_CONFIG.sharedCabinLights) for (let k = 0; k < SHARED_CABIN_LIGHTS; k++) this.sharedLights.push(LightPool.for(this.sky.sceneRoot).acquire(0xffa050, 0, 10, 2));
    if (geometries === null) return { group: this.group, colliders: this.colliders, interactables: this.interactables };
    this.loaded = { mats, props, firePit: firePitGltf.scene, lantern: lanternGltf.scene, geometries };
    const models = { firePit: firePitGltf.scene, lantern: lanternGltf.scene };
    for (const row of CABIN_ROWS.buildings.filter((r) => !r.hamlet)) {
      if (this.buildings.length > 0) await macrotask(); // one cabin per task: the whole homestead in one go was a 180 ms long task at 4x CPU
      const b = new LogBuilding(this, row, geometries, mats, this.sky, models, 'cabin');
      this.group.add(b.root);
      if (b.casters !== null) {
        // desktop: the props' depth goes into this cabin's double-sided near proxy (they cast no shadow of their own)
        const toRoot = b.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
        for (const k of PROP_KINDS) for (const part of props[k]) for (const mat of b.props[k]) b.casters.push(twoSidedPositions(part.geometry, m.multiplyMatrices(toRoot, mat).multiply(part.matrix)));
      }
      this.record(b, row.id, row.index, ...row.at, row.rot, false);
    }
    this.cabinCount = this.buildings.length;
    const hamlet = CABIN_ROWS.hamlet;
    if (hamlet !== null) await this.buildHamlet(hamlet, geometries, mats, models);
    return { group: this.group, colliders: this.colliders, interactables: this.interactables };
  }

  /** the hamlet's buildings (PH-B3), one per task; their root, at their centre, takes their welded set (`place`) */
  private async buildHamlet(hamlet: { readonly at: readonly [number, number, number]; readonly pad: number }, geometries: CabinGeometries, mats: Mats, models: { firePit: THREE.Object3D; lantern: THREE.Object3D }): Promise<void> {
    const root = new THREE.Group();
    root.name = 'cabin-cluster';
    root.position.set(...hamlet.at);
    root.updateMatrixWorld(true);
    for (const row of CABIN_ROWS.buildings.filter((r) => r.hamlet)) {
      await macrotask(); // one building per task, as the cabins
      const b = new LogBuilding(this, row, geometries, mats, this.sky, models, 'member');
      b.root.name = row.id;
      this.record(b, row.id, row.index, ...row.at, row.rot, true);
      this.group.add(b.root);
    }
    this.group.add(root);
    this.cluster = root;
    this.clusterPad = hamlet.pad;
  }

  /** each cabin's own root, in CABIN_SITES order (Explore's catalog shows one at a time) — not the cluster's buildings */
  get roots(): readonly THREE.Object3D[] { return this.buildings.slice(0, this.cabinCount).map((b) => b.root); }

  /**
   * PHYSICS P3: every cabin's static collision in world space — the legacy boxes (walls, chimney, porch posts and rails,
   * bed, table, woodpiles, fire pit, benches) minus the door boxes, plus the floors / porch decks / porch steps whose tops
   * are `floorHeightAt`, the stone plinths, and the furniture drawn without a legacy box (chairs, shelves, hearth, the
   * crates / barrels / buckets). src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] {
    const doorBoxes = new Set(this.doors.map((d) => d.collider));
    return [...this.colliders.filter((c) => !doorBoxes.has(c)).map((c) => boxDesc(c)), ...this.solids];
  }

  /**
   * PHYSICS P3: one piece per door — the leaf as a box in its pivot's local frame (the pivot turns about +Y as the door
   * swings inward), for a kinematic body that follows the pivot. `swinging()` is true from the moment the door is
   * toggled until it is fully shut or fully open (`active: () => !swinging()` lets the player through mid-swing).
   */
  doorPieces(): { id: string; pivot: THREE.Object3D; colliders: ColliderDesc[]; swinging: () => boolean }[] {
    return this.doors.map((d) => ({ id: d.id, pivot: d.pivot, colliders: [d.slab], swinging: () => d.t !== (d.open ? 1 : 0) }));
  }

  /** world y of a floor / deck under (x,z) if inside a cabin or porch footprint */
  floorHeightAt(x: number, z: number): number | undefined {
    for (const f of this.floors) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
      if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd) return f.y;
    }
    return undefined;
  }

  update(dt: number, t: number): void {
    // the phone's shared lights follow the nearest lit building (the detail bands are `place`'s: src/engine/models/weld.ts)
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmpV);
    let nearest = -1, nearestD2 = Infinity;
    for (const [i, s] of this.sites.entries()) {
      const d2 = s.root.position.distanceToSquared(this.tmpV);
      if (s.anchors.length > 0 && d2 < nearestD2 && (s.lit?.() ?? true)) { nearestD2 = d2; nearest = i; }
    }
    for (const w of this.wheels) w.rotation.x += dt * this.wheelSpeed;
    const l = this.sites[nearest];
    if (this.sharedLights.length > 0 && nearest >= 0 && l !== undefined) {
      // indoors (the eye over one of its rooms' floors, or within 3 m of its door) the room light and the hearth take the
      // pair, so the room is lit at night; outdoors the fire pit and the porch lantern keep it (intensity only either way)
      let indoors = false;
      if (l.rooms && l.door) {
        const p = l.root.worldToLocal(this.tmpL.copy(this.tmpV));
        indoors = l.rooms.some((r) => Math.abs(p.x - r.x) <= r.hw && Math.abs(p.z - r.z) <= r.hd) || Math.hypot(p.x - l.door[0], p.z - l.door[1]) < 3;
      }
      if (nearest !== this.nearestCabin || indoors !== this.indoors) {
        this.nearestCabin = nearest; this.indoors = indoors;
        const indoorRank = (a: LightAnchor): number => (a.rank === 2 ? 0 : a.rank === 3 ? 1 : a.rank + 2);
        this.order = indoors ? [...l.anchors].sort((a, b) => indoorRank(a) - indoorRank(b)) : l.anchors;
        this.fires = this.fires.filter((f) => !this.sharedLights.includes(f.light));
        this.sharedLights.forEach((light, i) => {
          const a = this.order[i];
          if (!a) { light.intensity = 0; return; }
          light.color.set(a.color); light.distance = a.distance; light.decay = a.decay;
          this.fires.push({ light, base: a.intensity, seed: a.seed, kind: a.kind });
        });
      }
      this.sharedLights.forEach((light, i) => { const a = this.order[i]; if (a) a.anchor.getWorldPosition(light.position); });
    }
    for (const d of this.doors) {
      const target = d.open ? 1 : 0;
      if (d.t === target) continue;
      d.t = Math.max(0, Math.min(1, d.t + Math.sign(target - d.t) * dt / 0.6));
      const e = d.t < 0.5 ? 2 * d.t * d.t : 1 - (-2 * d.t + 2) ** 2 / 2; // ease in-out
      d.pivot.rotation.y = -e * 1.85;
    }
    // the night lights on the clock (PH-L3): by intensity only — the light count never changes. `sky.lamps` is 0 by day …
    // 1 by night (the fixed sunset keeps 1: every light as before). A fire burns all day; lanterns and rooms are lit at dusk
    const lamps = this.sky.lamps, fireK = 0.7 + 0.3 * lamps, lampK = 0.1 + 0.9 * lamps;
    for (const f of this.fires) {
      const n = Math.sin(t * 11 + f.seed) * 0.5 + Math.sin(t * 23.7 + f.seed * 2.3) * 0.3 + Math.sin(t * 3.1 + f.seed) * 0.2;
      f.light.intensity = f.base * (1 + 0.28 * n) * (f.kind === 'fire' ? fireK : lampK);
    }
    for (const m of this.lampMats) m.mat.emissiveIntensity = m.full * (0.2 + 0.8 * lamps);
    cabinNight.uLamps.value = lamps; cabinNight.uShade.value = 1 - 0.8 * this.sky.night;
    for (const sw of this.swings) { sw.pivot.rotation.z = Math.sin(t * 1.35 + sw.seed) * 0.05 + Math.sin(t * 2.9 + sw.seed * 1.7) * 0.015; sw.pivot.rotation.x = Math.cos(t * 1.1 + sw.seed) * 0.03; }
    for (const m of this.particleMats) { const u = m.uniforms['uTime']; if (u !== undefined) u.value = t; }
  }

  private readonly doorBars = new Map<Interactable, () => boolean>();
  private readonly doorListeners = new Set<(door: Interactable, opening: boolean) => void>();
  /** bar a door: while `barred()` says true its use does nothing (the caller toasts / plays why) */
  barDoor(door: Interactable, barred: () => boolean): void { this.doorBars.set(door, barred); }
  /** hear every door that moves (`opening`: it swung open); returns the unsubscribe */
  onDoor(fn: (door: Interactable, opening: boolean) => void): () => void { this.doorListeners.add(fn); return () => { this.doorListeners.delete(fn); }; }
  /** @internal */ _doorUse(d: Door, toggle: () => void): void {
    if (this.doorBars.get(d.interactable)?.() === true) return;
    toggle();
    for (const fn of this.doorListeners) fn(d.interactable, d.open);
  }
  /** @internal */ _door(d: Door): void { this.doors.push(d); this.colliders.push(d.collider); this.interactables.push(d.interactable); }
  /** @internal */ _fire(f: Fire): void { this.fires.push(f); }
  /** @internal */ _lamp(mat: THREE.MeshStandardMaterial, full: number): void { this.lampMats.push({ mat, full }); }
  /** @internal */ _swing(sw: Swing): void { this.swings.push(sw); }
  /** @internal */ _particles(m: THREE.ShaderMaterial): void { this.particleMats.add(m); }
  /** @internal */ _floor(f: Floor): void { this.floors.push(f); }
  /** @internal */ _solid(d: ColliderDesc, _prop: boolean): void { this.solids.push(d); }
  /** @internal */ _wheel(o: THREE.Object3D): void { this.wheels.push(o); }
  /** @internal */ _collider(c: Collider): void { this.colliders.push(c); }
  /** @internal */ _firePit(at: { x: number; y: number; z: number }): void { this.firePits.push(at); }

  /**
   * PH-B3: a lamp the phone's pooled pair may visit when it is the nearest lit site (a waystone lantern): `anchor` sits in
   * world space (a child of a group at the origin). No light of its own on any tier; `lit()` false keeps the pair away.
   */
  addLampSite(anchor: THREE.Object3D, color: number, intensity: number, distance: number, lit: () => boolean = () => true): void {
    const a: LightAnchor = { anchor, color, intensity, distance, decay: 2, seed: anchor.position.x * 0.37, kind: 'lamp', rank: 0 };
    this.sites.push({ root: anchor, anchors: [a], lit });
  }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

const lodLoader = new GLTFLoader();
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return new Promise<{ scene: THREE.Group }>((resolve, reject) => { lodLoader.load(`/assets/models/${id}/${id}_lod.glb`, resolve, undefined, reject); });
}

/** flatten a glTF scene into (geometry, material, world matrix) triples with sky-aware materials */
export function prepModel(scene: THREE.Object3D, sky: Sky): PropPart[] {
  scene.updateMatrixWorld(true);
  const out: PropPart[] = [];
  scene.traverse((m) => {
    if (!isMesh(m)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (t) t.anisotropy = 8;
    sky.setupMaterial(mat);
    out.push({ geometry: m.geometry, material: mat, matrix: m.matrixWorld.clone() });
  });
  return out;
}

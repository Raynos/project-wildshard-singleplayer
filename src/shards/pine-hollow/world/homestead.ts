import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadPBR, loadGLTF, pbrMaterial, type PBRSet } from '@wildshard/engine/core/assets';
import { SEED } from '@wildshard/engine/core/config';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { twoSidedPositions, type WeldBuild } from '@wildshard/engine/models/weld';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { paintCanvas } from '@wildshard/sdk/looks/canvasAtlas';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { installMossOverlay } from '@wildshard/sdk/looks/mossOverlay';
import { riseParticleMaterial } from '@wildshard/sdk/looks/riseParticles';
import { flattenGlbParts, loadLodGlb } from '@wildshard/sdk/kit/lodGlb';
import { BuildingLife } from '@wildshard/sdk/props/buildingLife';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineSetCap } from '../debug/options';
import { END_GRAIN_PAINT, GLOW_PAINT, NOISE_PAINT } from '../data/cabinPaint';
import { CABIN_DOOR_EDITS, CABIN_LIFE, CABIN_MOSS_EDITS, CABIN_PARTICLE_GLSL, CABIN_PARTICLE_KINDS } from '../data/cabinLook';
import { mergeParts, type PropPart } from '../models/logCabin';
import { PROP_KINDS, type PropKind } from './logKit';
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
  const t = new THREE.CanvasTexture(paintCanvas(END_GRAIN_PAINT, { SEED })); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** the lamps' soft glow (../data/cabinPaint.ts `GLOW_PAINT`) */
export function makeGlowTexture(): THREE.CanvasTexture {
  return new THREE.CanvasTexture(paintCanvas(GLOW_PAINT));
}

function makeNoiseTexture() {
  const t = new THREE.CanvasTexture(paintCanvas(NOISE_PAINT, { SEED })); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

let noiseTex: THREE.Texture | undefined;

/** the night's hold on the cabins' particles: uShade dims the smoke's shadow side, uLamps lights the chimney glow (Cabins.update) */
const cabinNight = { uShade: { value: 1 }, uLamps: { value: 1 } };
/** the phone's pooled cabin lights (PH-L3) */
const SHARED_CABIN_LIGHTS = 2;

/** Billboard particle material driven entirely by uTime (no per-frame CPU work): @wildshard/sdk/looks/riseParticles, one program for smoke / flame / ember (../data/cabinLook.ts) */
function makeParticleMaterial(kind: 'smoke' | 'flame' | 'ember', sky: Sky) {
  noiseTex ??= cacheUntilDisposed(makeNoiseTexture(), () => { noiseTex = undefined; });
  // the sky's own sun (the clock moves it) and the night's hold, shared by every kind
  return riseParticleMaterial(CABIN_PARTICLE_KINDS[kind], { smoke: 0, flame: 1, ember: 2 }[kind], CABIN_PARTICLE_GLSL,
    { noise: noiseTex, uniforms: { uSunDir: { value: sky.sunDir }, uSunColor: { value: sky.sunColor }, uShade: cabinNight.uShade, uLamps: cabinNight.uLamps } });
}

/**
 * Procedural moss / lichen overlay (@wildshard/sdk/looks/mossOverlay, the GLSL edits ../data/cabinLook.ts `CABIN_MOSS_EDITS`):
 * denser where the `moss` vertex attribute is high (eaves, foundation base) and on faces turned away from the sun; the
 * roof's full strength and up-only, the stone's 0.6 — uniforms, so roof and stone share one program.
 */
function installMoss(mat: THREE.MeshStandardMaterial, sky: Sky, kind: 'roof' | 'stone') {
  installMossOverlay(mat, { id: 'pine.cabin-moss', key: 'cabin-moss', sunDir: sky.sunDir, strength: kind === 'roof' ? 1.0 : 0.6, upOnly: kind === 'roof', edits: CABIN_MOSS_EDITS });
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

/**
 * The homestead: the buildings built from the bake, and their life (@wildshard/sdk/props/buildingLife, the look
 * ../data/cabinLook.ts `CABIN_LIFE`: doors, fires and lamps on the clock, the phone's pooled lights, swings, the wheel,
 * floors and solids). The particles' night hold is Pine's (`cabinNight`).
 */
export class Cabins extends BuildingLife implements BuildingOwner {
  group = new THREE.Group();
  /** the hamlet's one set: its root, posed at the hamlet's centre (null without extra buildings); `place` welds into it */
  cluster: THREE.Group | null = null;
  /** metres the hamlet's buildings stand from its root (its detail bands are this much longer) */
  clusterPad = 0;
  private cabinCount = 0;
  private tmpV = new THREE.Vector3();
  /** every building, as its model sees it (E315 M2) */
  readonly buildings: CabinBuilding[] = [];
  /** what the buildings were built from: kept for the Model Explorer's specimens */
  private loaded: { mats: Mats; props: Record<PropKind, PropPart[]>; firePit: THREE.Object3D; lantern: THREE.Object3D; geometries: CabinGeometries } | null = null;
  private readonly sky: Sky;

  constructor(sky: Sky) {
    super(CABIN_LIFE);
    this.sky = sky;
  }

  /** what the buildings were built from (their materials, the props' scans, the fire pit and the lantern, the bake); null before `build` */
  get kit(): { readonly mats: Mats; readonly props: Readonly<Record<PropKind, readonly PropPart[]>>; readonly firePit: THREE.Object3D; readonly lantern: THREE.Object3D; readonly geometries: CabinGeometries } | null { return this.loaded; }

  /** what the building just built by `b` is, for its model */
  private record(b: LogBuilding, id: string, index: number, x: number, y: number, z: number, rot: number, hamlet: boolean): void {
    this.buildings.push({ id, index, x, y, z, rot, root: b.root, hamlet, colliders: b.colliderDescs(), floors: b.floors, props: b.props, firePit: b.firePitObj, lantern: b.lanternObj, weld: b.weldBuild() });
    this.addSite({ root: b.root, anchors: b.anchors, rooms: b.rooms, door: b.doorAt });
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
    if (TIER_CONFIG.sharedCabinLights) for (let k = 0; k < SHARED_CABIN_LIGHTS; k++) this.addSharedLight(LightPool.for(this.sky.sceneRoot).acquire(0xffa050, 0, 10, 2));
    if (geometries === null) return { group: this.group, colliders: this.colliders, interactables: this.interactables };
    this.loaded = { mats, props, firePit: firePitGltf.scene, lantern: lanternGltf.scene, geometries };
    const models = { firePit: firePitGltf.scene, lantern: lanternGltf.scene };
    for (const row of CABIN_ROWS.buildings.filter((r) => !r.hamlet)) {
      if (this.buildings.length > 0) await macrotask(); // one cabin per task: the whole homestead in one go was a 180 ms long task at 4x CPU
      const b = new LogBuilding(this, row, geometries, mats, this.sky, models, 'standalone');
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

  /** per frame: the buildings' life from the eye and the clock (the phone's pooled lights, doors, flicker, swings, the
   *  wheel), then the particles' night hold */
  update(dt: number, t: number): void {
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmpV);
    this.tick(dt, t, this.tmpV, this.sky.lamps);
    cabinNight.uLamps.value = this.sky.lamps; cabinNight.uShade.value = 1 - 0.8 * this.sky.night;
  }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

/** a model library's LOD glTF (@wildshard/sdk/kit/lodGlb) */
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return loadLodGlb(`/assets/models/${id}/${id}_lod.glb`);
}

/** flatten a glTF scene into (geometry, material, world matrix) triples with sky-aware materials */
export function prepModel(scene: THREE.Object3D, sky: Sky): PropPart[] {
  return flattenGlbParts(scene, (m) => { sky.setupMaterial(m); });
}

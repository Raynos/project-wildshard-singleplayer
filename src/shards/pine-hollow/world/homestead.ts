import { memoUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadPBR, loadGLTF, pbrMaterial } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { twoSidedPositions, type WeldBuild } from '@wildshard/engine/models/weld';
import { BuildingLife } from '../runtime/props/buildingLife';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineSetCap } from '../runtime/debug/options';
import { loadPainted } from '../runtime/looks/paintedTextures';
import { CABIN_DOOR_LOOK, CABIN_LIFE, CABIN_MOSS_LOOKS } from '../data/cabinLook';
import { HEARTH_LOOKS } from '../data/hearthLook';
import { pineLook, pineMappedLook, setPineLookParam, setPineLookTexture } from '../runtime/looks/graphLooks';
import type { PropPart } from '../runtime/models/logCabin';
import { PROP_KINDS, type PropKind, type BakedBuilding } from './logKit';
import { pineModels } from './context';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE, CABIN_LIGHT } from '../data/cabinAssembly';
import { CABIN_ROWS, LogBuilding, loadCabinBake, type BuildingOwner, type CabinGeometries } from './cabinBake';

/**
 * Pine Hollow's homestead: the three log cabins and the mill hamlet's five buildings, as a living place (E347: its log kit
 * and the buildings' drawing moved onto the model contract — src/shards/pine-hollow/runtime/models/logCabin.ts builds each
 * building where it stands, `place` merges and welds them and drops their detail with distance,
 * src/shards/pine-hollow/world/cabins.ts).
 *
 *   const cabins = new Cabins(sky, game.scene);
 *   const { group, interactables } = await cabins.build();     // every building built where it stands, one per task
 *   scene.add(group);
 *   await placeCabins({ cabins, sky, registry, scope: ctx.scope });              // their models placed: drawn, registered
 *   game.onUpdate((dt, t) => cabins.update(dt, t));
 *
 * - `group`         the buildings' roots (doors, fires, smoke, lanterns, the wheel) and what `place` draws of them.
 * - `interactables` one per door: `{ position, radius, label, onInteract() }`. `label` toggles
 *                   "Open door" / "Close door". Call `onInteract()` from the HUD's use key.
 * - `update(dt, t)` door swing (0.6 s ease in-out), fire / lantern flicker on the clock, the phone's pooled lights, the wheel.
 * - `floorHeightAt(x, z)` → world y of a cabin floor / porch deck under (x,z), or undefined.
 * - `firePits`      `{ x, y, z }` of the camp fires (audio / warmth logic).
 * - Static collision belongs to each placed building's weld and its prop models; `doorPieces()` hands the door slabs
 *   to the kinematic pieces that follow each pivot.
 *
 * The kit's materials (the Poly Haven PBR sets, the moss, the particles) are here: the landmarks' timber shares them.
 */

/** `weak`: shown only when no other prompt is in reach (the saddle's Dismount: it hid the Wind Cairn's tie, E288) */


// ───────────────────────────── materials ─────────────────────────────

export interface Mats {
  log: THREE.MeshStandardMaterial; endGrain: THREE.MeshStandardMaterial; chink: THREE.MeshStandardMaterial;
  roof: THREE.Material; beam: THREE.MeshStandardMaterial; deck: THREE.MeshStandardMaterial;
  door: THREE.Material; stone: THREE.Material; glass: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; cloth: THREE.MeshStandardMaterial;
  char: THREE.MeshStandardMaterial;
  smoke: THREE.Material; flame: THREE.Material; ember: THREE.Material; glow: THREE.MeshBasicMaterial;
}
export type MatKey = Exclude<keyof Mats, 'smoke' | 'flame' | 'ember' | 'glow' | 'glass'>;

const matsCache = new WeakMap<Sky, Promise<Mats>>();
/** the cabins' PBR materials, loaded once per sky and shared (PH-B3: the landmarks build with the same set — no new programs) */
export function cabinMats(sky: Sky): Promise<Mats> {
  return memoUntilDisposed(matsCache, sky, () => loadMats(sky));
}

async function loadMats(sky: Sky): Promise<Mats> {
  const cap = pineSetCap(TIER_CONFIG.maxTexture); // G180 B1: 512² on the phone with the memory trim on
  const [endGrain, glow] = await Promise.all([loadPainted('endGrain'), loadPainted('glow')]); // the log ends' and the lamps' (baked offline)
  const scans = new Map(await Promise.all(CABIN_PBR.map(async row => [row.key, pbrMaterial(await loadPBR(row.scan, 1, cap), {
    metalness: 0, color: new THREE.Color(...row.color), normalScale: new THREE.Vector2(...row.normal),
  })] as const)));
  const scan = (key: typeof CABIN_PBR[number]['key']): THREE.MeshStandardMaterial => {
    const material = scans.get(key); if (material === undefined) throw new Error(`Missing cabin material ${key}`); return material;
  };
  const m: Mats = {
    log: scan('log'), endGrain: new THREE.MeshStandardMaterial({ ...CABIN_MATERIALS.endGrain, map: endGrain }),
    chink: new THREE.MeshStandardMaterial(CABIN_MATERIALS.chink), roof: pineMappedLook(CABIN_MOSS_LOOKS.roof, scan('roof')), beam: scan('beam'), deck: scan('deck'),
    door: pineMappedLook(CABIN_DOOR_LOOK, scan('door')), // the scan pulled toward a weathered grey-brown, over the set's maps (../data/cabinLook.ts)
    stone: pineMappedLook(CABIN_MOSS_LOOKS.stone, scan('stone')), // the roof and the stone mossed over their scans' maps (../data/cabinLook.ts)
    glass: new THREE.MeshStandardMaterial({ ...CABIN_MATERIALS.glass, emissive: new THREE.Color(...CABIN_GLASS_EMISSIVE) }), bark: scan('bark'),
    iron: new THREE.MeshStandardMaterial(CABIN_MATERIALS.iron), cloth: new THREE.MeshStandardMaterial(CABIN_MATERIALS.cloth), char: new THREE.MeshStandardMaterial(CABIN_MATERIALS.char),
    smoke: pineLook(HEARTH_LOOKS.smoke), flame: pineLook(HEARTH_LOOKS.flame), ember: pineLook(HEARTH_LOOKS.ember),
    glow: new THREE.MeshBasicMaterial({ map: glow, color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  };
  // the moss graphs light their scans' normal maps themselves (their authored shading normal replaces the borrowed one)
  for (const key of ['roof', 'stone'] as const) {
    const normal = scan(key).normalMap;
    if (normal === null) throw new Error(`Cabin scan ${key} has no normal map`);
    setPineLookTexture(CABIN_MOSS_LOOKS[key], 'normalMap', normal);
  }
  for (const k of ['log', 'endGrain', 'chink', 'beam', 'deck', 'glass', 'bark', 'iron', 'cloth', 'char'] as const) sky.setupMaterial(m[k]);
  return m;
}

/** the phone's pooled cabin lights (PH-L3) */


// ───────────────────────────── the homestead ─────────────────────────────


/** a prop kind the buildings set about (E315 M2: each is a model — src/shards/pine-hollow/runtime/models/) */
export type CabinPropKind = PropKind;

/**
 * One building as its model sees it (E315 M2 / E347): which (the 3 cabins in CABIN_SITES order, then the extras), where it
 * stands, what it collides with and stands on (world space, the doors apart), the props it set about (world matrices), its
 * fire pit and porch lantern, and what its model hands `place` (`weld`).
 */
export interface CabinBuilding {
  readonly id: string;
  readonly index: number;
  /** Borrow the authored site and actual building owner; keep the weld captured at registration. */
  readonly site: BakedBuilding;
  readonly owner: LogBuilding;
  readonly weld: WeldBuild;
}

/**
 * The homestead: the buildings built from the bake, and their life (@wildshard/sdk/props/buildingLife, the look
 * ../data/cabinLook.ts `CABIN_LIFE`: doors, fires and lamps on the clock, the phone's pooled lights, swings, the wheel,
 * floors and solids). The smoke's sun and night hold are Pine's (`update`).
 */
export class Cabins extends BuildingLife implements BuildingOwner {
  group = new THREE.Group();
  /** the hamlet's one set: its root, posed at the hamlet's centre (null without extra buildings); `place` welds into it */
  cluster: THREE.Group | null = null;
  /** metres the hamlet's buildings stand from its root (its detail bands are this much longer) */
  clusterPad = 0;
  private cabinCount = 0;
  private tmpV = new THREE.Vector3();
  private sunColour = [1, 1, 1];
  /** every building, as its model sees it (E315 M2) */
  readonly buildings: CabinBuilding[] = [];
  /** what the buildings were built from: kept for the Model Explorer's specimens */
  private loaded: { mats: Mats; props: Record<PropKind, PropPart[]>; firePit: THREE.Object3D; lantern: THREE.Object3D; geometries: CabinGeometries } | null = null;
  private readonly sky: Sky;
  /** the content scene the phone's shared cabin lights join (`game.scene`: a grid region's parked frame) */
  private readonly lightScene: THREE.Scene;

  /**
   * `lightScene` is the scene the homestead's content goes in (`game.scene`), never the page's root: a light added to
   * the live root while a region builds changes every visible program's light count (sp-o6: nine programs relinked in one
   * 162 ms Simulator frame of Pine's `world` hook). In the parked frame the lights are future lights the entry warms.
   */
  constructor(sky: Sky, lightScene: THREE.Scene) {
    super(CABIN_LIFE);
    this.sky = sky;
    this.lightScene = lightScene;
  }

  /** what the buildings were built from (their materials, the props' scans, the fire pit and the lantern, the bake); null before `build` */
  get kit(): { readonly mats: Mats; readonly props: Readonly<Record<PropKind, readonly PropPart[]>>; readonly firePit: THREE.Object3D; readonly lantern: THREE.Object3D; readonly geometries: CabinGeometries } | null { return this.loaded; }

  /** a prop kind's parts (for its model's specimen), their node transforms baked in; null before `build` */
  propParts(kind: CabinPropKind): readonly PropPart[] | null { return this.loaded?.props[kind] ?? null; }


  /**
   * Assemble every building where it stands from the offline bake (../generators/logCabin.ts → ./cabinBake.ts), one per
   * task: the cabins, then the hamlet (its root posed at its centre). Nothing is drawn merged yet: `placeCabins` places
   * their models. A bake that did not load leaves no buildings (a page fault).
   */
  async build(): Promise<{ group: THREE.Group; interactables: Interactable[] }> {
    // the seven PBR sets, the six models and the bake in one round of fetches
    const [mats, [firePitGltf, lanternGltf, ...scans], geometries] = await Promise.all([cabinMats(this.sky), Promise.all([
      loadGLTF('stone_fire_pit'), loadLod('Lantern_01'), loadRigFile('/assets/models/wooden_crate_02/wooden_crate_02.gltf', authored.propMaterials), loadRigFile('/assets/models/wine_barrel_01/wine_barrel_01.gltf', authored.propMaterials), loadRigFile('/assets/models/wooden_bucket_01/wooden_bucket_01.gltf', authored.propMaterials), loadRigFile('/assets/models/hatchet/hatchet.gltf', authored.propMaterials),
    ]), loadCabinBake(pineModels(this.sky))]);
    const props: Record<PropKind, PropPart[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
    if (geometries !== null) for (const [index, kind] of PROP_KINDS.entries()) {
      const scan = scans[index], row = authored.cabinProps[kind];
      if (scan === undefined) throw new Error('Cabin material recipe missing');
      props[kind] = prepModel(scan.scene, this.sky).map(part => ({ geometry: geometries.geometry(row.name), material: part.material, matrix: new THREE.Matrix4().fromArray(row.matrix) }));
    }
    this._lamp(mats.glass, mats.glass.emissiveIntensity);
    // the phone's shared cabin lights (PH-L3): TWO pooled lights, not one per anchor — every point light is per-fragment
    // cost on every lit surface, grass included; the nearest cabin's fire pit and porch lantern (else its room / hearth)
    if (TIER_CONFIG.sharedCabinLights) for (let k = 0; k < CABIN_LIGHT.count; k++) this.addSharedLight(LightPool.for(this.lightScene).acquire(CABIN_LIGHT.color, CABIN_LIGHT.intensity, CABIN_LIGHT.distance, CABIN_LIGHT.decay));
    if (geometries === null) return { group: this.group, interactables: this.interactables };
    this.loaded = { mats, props, firePit: firePitGltf.scene, lantern: lanternGltf.scene, geometries };
    const models = { firePit: firePitGltf.scene, lantern: lanternGltf.scene };
    const hamlet = CABIN_ROWS.hamlet;
    const ordered = [...CABIN_ROWS.buildings.filter(row => !row.hamlet), ...CABIN_ROWS.buildings.filter(row => row.hamlet)];
    for (const row of ordered) {
      if (row.hamlet && this.cluster === null) {
        if (hamlet === null) throw new Error('Hamlet building requires its authored cluster');
        this.cluster = new THREE.Group(); this.cluster.name = 'cabin-cluster'; this.cluster.position.set(...hamlet.at); this.cluster.updateMatrixWorld(true); this.clusterPad = hamlet.pad;
      }
      if (this.buildings.length > 0 || row.hamlet) await macrotask(); // one native building per task, in original role order
      const b = new LogBuilding(this, row, geometries, mats, this.sky, models, row.hamlet ? 'member' : 'standalone');
      if (row.hamlet) b.root.name = row.id;
      else {
        this.group.add(b.root);
        if (b.casters !== null) {
          const toRoot = b.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
          for (const k of PROP_KINDS) for (const part of props[k]) for (const mat of b.props[k]) b.casters.push(twoSidedPositions(part.geometry, m.multiplyMatrices(toRoot, mat).multiply(part.matrix)));
        }
      }
      this.buildings.push({ id: row.id, index: row.index, site: row, owner: b, weld: b.weldBuild() });
      this.addSite({ root: b.root, anchors: b.anchors, rooms: b.rooms, door: b.doorAt });
      if (row.hamlet) this.group.add(b.root);
      else this.cabinCount++;
    }
    if (this.cluster !== null) this.group.add(this.cluster);
    return { group: this.group, interactables: this.interactables };
  }

  /** each cabin's own root, in CABIN_SITES order (Explore's catalog shows one at a time) — not the cluster's buildings */
  get roots(): readonly THREE.Object3D[] { return this.buildings.slice(0, this.cabinCount).map((b) => b.owner.root); }

  /** per frame: the buildings' life from the eye and the clock (the phone's pooled lights, doors, flicker, swings, the
   *  wheel), then the smoke's sun colour and night hold (its shade dims at night, the chimney glow lights with the lamps) */
  update(dt: number, t: number): void {
    const cam = this.sky.viewCamera, sky = this.sky; cam.getWorldPosition(this.tmpV);
    this.tick(dt, t, this.tmpV, sky.lamps);
    const id = HEARTH_LOOKS.smoke, c = sky.sunColor;
    this.sunColour[0] = c.r; this.sunColour[1] = c.g; this.sunColour[2] = c.b;
    setPineLookParam(id, 'sunColour', this.sunColour); setPineLookParam(id, 'lamps', sky.lamps); setPineLookParam(id, 'shade', 1 - 0.8 * sky.night);
  }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

/** A model library's LOD file, through the shared loader and its declared material aliases. */
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return loadRigFile(`/assets/models/${id}/${id}_lod.glb`, authored.propMaterials);
}

/** A model library's LOD file's node tree alone (for `prepModel`): what a scan model's loader reads. */
export async function loadLodNodes(id: string): Promise<THREE.Object3D> {
  return (await loadLod(id)).scene;
}

/** flatten a glTF scene into (geometry, material, world matrix) triples with sky-aware materials */
const isPropMesh = (node: THREE.Object3D): node is THREE.Mesh => 'isMesh' in node;
export function prepModel(scene: THREE.Object3D, sky: Sky): PropPart[] {
  scene.updateMatrixWorld(true);
  const out: PropPart[] = [];
  scene.traverse((node) => {
    if (!isPropMesh(node)) return;
    const mat = node.material as THREE.MeshStandardMaterial;
    for (const texture of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (texture) texture.anisotropy = 8;
    sky.setupMaterial(mat);
    out.push({ geometry: node.geometry, material: mat, matrix: node.matrixWorld.clone() });
  });
  return out;
}

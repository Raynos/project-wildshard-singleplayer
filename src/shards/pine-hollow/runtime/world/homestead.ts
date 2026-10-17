import { memoUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadRigFile, rigRoot } from '@wildshard/engine/anim/rig';
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { loadPBR, loadGLTF, pbrMaterial } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { twoSidedPositions, type WeldBuild } from '@wildshard/engine/models/weld';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import { SceneResources } from '@wildshard/game/shardfile/sceneResources';
import { BakedBuildingLookSchema, BuildingLifeLookSchema, emptyBuildingLifeRows, type BakedBuildingLook } from '@wildshard/format/buildings';
import type { SiteLightState } from '@wildshard/engine/fx/SiteLights';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineSetCap } from '../debug/options';
import { loadPainted } from '../looks/paintedTextures';
import * as v from 'valibot';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { lentLook, lentMappedLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import type { PropPart } from '../models/logCabin';
import { PROP_KINDS, type PropKind, type BakedBuilding } from '../../world/logKit';
import { pineModels } from './context';
import authored from '../../data/timberWorld.generated.json' with { type: 'json' };
import { CABIN_ROWS, createLogBuilding, loadCabinBake, type LogBuilding, type CabinGeometries } from './cabinBake';

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

const number = v.pipe(v.number(), v.finite()), pair = v.tuple([number, number]), triple = v.tuple([number, number, number]);
const materialRow = v.strictObject({ color: number, roughness: number, metalness: number,
  transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(number), envMapIntensity: v.exactOptional(number),
  emissiveIntensity: v.exactOptional(number), emissive: v.exactOptional(number), side: v.exactOptional(v.picklist([0, 1, 2])),
  depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) });
const timberDraw = v.strictObject({ depth: v.picklist(['proxy', 'near']), receiveShadow: v.boolean(),
  castShadow: v.exactOptional(v.boolean()), until: v.exactOptional(number) });
/** Client-only author rows: unknown fields, malformed vectors and unbounded lists refuse before construction. */
export const CabinRowsSchema = v.strictObject({
  BUILDING_LOOK: BakedBuildingLookSchema,
  CABIN_DOOR_LOOK: v.string(), CABIN_MOSS_LOOKS: v.strictObject({ roof: v.string(), stone: v.string() }),
  HEARTH_LOOKS: v.strictObject({ smoke: v.string(), flame: v.string(), ember: v.string() }),
  CABIN_LIFE: BuildingLifeLookSchema,
  CABIN_PBR: v.pipe(v.array(v.strictObject({ key: v.picklist(['log', 'roof', 'beam', 'deck', 'door', 'stone', 'bark']),
    scan: v.string(), color: triple, normal: pair })), v.length(7)),
  CABIN_MATERIALS: v.strictObject({ endGrain: materialRow, chink: materialRow, glass: materialRow, iron: materialRow, cloth: materialRow, char: materialRow }),
  TIMBER_DRAWS: v.strictObject({ log: timberDraw, endGrain: timberDraw, chink: timberDraw, roof: timberDraw, beam: timberDraw, deck: timberDraw,
    door: timberDraw, stone: timberDraw, bark: timberDraw, iron: timberDraw, cloth: timberDraw, char: timberDraw }),
  TIMBER_GLASS: v.strictObject({ renderOrder: number, receiveShadow: v.boolean() }),
  CABIN_GLASS_EMISSIVE: triple, CABIN_LIGHT: v.strictObject({ count: number, color: number, intensity: number, distance: number, decay: number }),
});
type CabinRows = v.InferOutput<typeof CabinRowsSchema>;
/** Read verified named JSON before the building or its materials are constructed. */
export async function loadCabinRows(): Promise<CabinRows> {
  const product = await loadFirstPartyProduct('pine-hollow');
  return v.parse(CabinRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('world/cabins.json'))));
}

const matsCache = new WeakMap<Sky, Promise<Mats>>();
/** the cabins' PBR materials, loaded once per sky and shared (PH-B3: the landmarks build with the same set — no new programs) */
export function cabinMats(sky: Sky): Promise<Mats> {
  return memoUntilDisposed(matsCache, sky, () => loadMats(sky));
}

async function loadMats(sky: Sky): Promise<Mats> {
  const { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS, HEARTH_LOOKS, CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE } = await loadCabinRows();
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
    chink: new THREE.MeshStandardMaterial(CABIN_MATERIALS.chink), roof: lentMappedLook(CABIN_MOSS_LOOKS.roof, scan('roof')), beam: scan('beam'), deck: scan('deck'),
    door: lentMappedLook(CABIN_DOOR_LOOK, scan('door')), // the scan pulled toward a weathered grey-brown, over the set's maps (../../generators/cabinLook.ts)
    stone: lentMappedLook(CABIN_MOSS_LOOKS.stone, scan('stone')), // the roof and the stone mossed over their scans' maps (../../generators/cabinLook.ts)
    glass: new THREE.MeshStandardMaterial({ ...CABIN_MATERIALS.glass, emissive: new THREE.Color(...CABIN_GLASS_EMISSIVE) }), bark: scan('bark'),
    iron: new THREE.MeshStandardMaterial(CABIN_MATERIALS.iron), cloth: new THREE.MeshStandardMaterial(CABIN_MATERIALS.cloth), char: new THREE.MeshStandardMaterial(CABIN_MATERIALS.char),
    smoke: lentLook(HEARTH_LOOKS.smoke), flame: lentLook(HEARTH_LOOKS.flame), ember: lentLook(HEARTH_LOOKS.ember),
    glow: new THREE.MeshBasicMaterial({ map: glow, color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  };
  // the moss graphs light their scans' normal maps themselves (their authored shading normal replaces the borrowed one)
  for (const key of ['roof', 'stone'] as const) {
    const normal = scan(key).normalMap;
    if (normal === null) throw new Error(`Cabin scan ${key} has no normal map`);
    setLentTexture(CABIN_MOSS_LOOKS[key], 'normalMap', normal);
  }
  for (const k of ['log', 'endGrain', 'chink', 'beam', 'deck', 'glass', 'bark', 'iron', 'cloth', 'char'] as const) sky.setupMaterial(m[k]);
  return m;
}

/** the phone's pooled cabin lights (PH-L3): at most this many */
const MAX_SHARED_LIGHTS = 4;
/** the four prop kinds; most buildings (3 cabins + the hamlet's 5 today), parts per prop scan and copies of one kind at
 *  one building (each throws past it) */
const PROP_KIND_COUNT = 4, MAX_BUILDINGS = 16, MAX_PROP_PARTS = 16, MAX_PROP_COPIES = 64;


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
 * The homestead: the buildings built from the bake, and their shared living-building host (the look
 * ../../generators/cabinLook.ts `CABIN_LIFE`: doors, fires and lamps on the clock, the phone's pooled lights, swings, the wheel,
 * floors and solids). The smoke's sun and night hold are Pine's (`update`).
 */
export class Cabins {
  readonly resources: SceneResources;
  readonly life: LivingBuildings;
  private readonly lampStates: { readonly id: string; readonly state: SiteLightState }[] = [];
  get interactables(): Interactable[] { return this.life.interactables; }
  get audioState(): LivingBuildings['audioState'] { return this.life.audioState; }
  get buildingLook(): BakedBuildingLook { return this.rows.BUILDING_LOOK; }
  get wheelSpeed(): number { return this.life.wheelSpeed; }
  set wheelSpeed(value: number) { this.life.wheelSpeed = value; }
  doorPieces(): ReturnType<LivingBuildings['doorPieces']> { return this.life.doorPieces(); }
  /** Temporary publication of native waystone anchors; ignition crosses as an id command. */
  addLampSite(anchor: THREE.Object3D, color: number, intensity: number, distance: number, state: SiteLightState): void {
    if (this.lampStates.length >= 8) throw new Error('Building lamp site capacity');
    const id = this.resources.lend(anchor), rows = emptyBuildingLifeRows();
    rows.sites.push({ id, root: id, anchors: [{ anchor: id, color, intensity, distance, decay: 2, seed: anchor.position.x * 0.37, kind: 'lamp', rank: 0 }] });
    this.life.add(rows); this.lampStates.push({ id, state });
  }
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
  private readonly rows: CabinRows;
  /** the content scene the phone's shared cabin lights join (`game.scene`: a grid region's parked frame) */
  private readonly lightScene: THREE.Scene;

  /**
   * `lightScene` is the scene the homestead's content goes in (`game.scene`), never the page's root: a light added to
   * the live root while a region builds changes every visible program's light count (sp-o6: nine programs relinked in one
   * 162 ms Simulator frame of Pine's `world` hook). In the parked frame the lights are future lights the entry warms.
   */
  constructor(sky: Sky, lightScene: THREE.Scene, rows: CabinRows) {
    this.resources = new SceneResources(sky);
    this.life = new LivingBuildings(this.resources, rows.CABIN_LIFE);
    this.rows = rows;
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
    const { CABIN_LIGHT } = this.rows;
    // the seven PBR sets, the six models and the bake in one round of fetches
    const [mats, [firePitGltf, lanternGltf, ...scans], geometries] = await Promise.all([cabinMats(this.sky), Promise.all([
      loadGLTF('stone_fire_pit'), loadLod('Lantern_01'), loadRigFile('/assets/models/wooden_crate_02/wooden_crate_02.gltf', authored.propMaterials), loadRigFile('/assets/models/wine_barrel_01/wine_barrel_01.gltf', authored.propMaterials), loadRigFile('/assets/models/wooden_bucket_01/wooden_bucket_01.gltf', authored.propMaterials), loadRigFile('/assets/models/hatchet/hatchet.gltf', authored.propMaterials),
    ]), loadCabinBake(pineModels(this.sky))]);
    const props: Record<PropKind, PropPart[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
    if (geometries !== null) for (let index = 0; index < Math.min(PROP_KINDS.length, PROP_KIND_COUNT); index++) {
      const scan = scans[index], kind = PROP_KINDS[index];
      if (scan === undefined || kind === undefined) throw new Error('Cabin material recipe missing');
      const row = authored.cabinProps[kind];
      props[kind] = prepModel(rigRoot(scan), this.sky).map(part => ({ geometry: geometries.geometry(row.name), material: part.material, matrix: new THREE.Matrix4().fromArray(row.matrix) }));
    }
    const lifeRows = emptyBuildingLifeRows();
    lifeRows.lamps.push({ material: this.resources.lend(mats.glass), full: mats.glass.emissiveIntensity });
    // the phone's shared cabin lights (PH-L3): TWO pooled lights, not one per anchor — every point light is per-fragment
    // cost on every lit surface, grass included; the nearest cabin's fire pit and porch lantern (else its room / hearth)
    if (TIER_CONFIG.sharedCabinLights) for (let k = 0; k < Math.min(CABIN_LIGHT.count, MAX_SHARED_LIGHTS); k++) lifeRows.shared.push(this.resources.lend(LightPool.for(this.lightScene).acquire(CABIN_LIGHT.color, CABIN_LIGHT.intensity, CABIN_LIGHT.distance, CABIN_LIGHT.decay)));
    this.life.add(lifeRows);
    if (geometries === null) return { group: this.group, interactables: this.interactables };
    const models = { firePit: rigRoot(firePitGltf), lantern: rigRoot(lanternGltf) };
    this.loaded = { mats, props, firePit: models.firePit, lantern: models.lantern, geometries };
    const hamlet = CABIN_ROWS.hamlet;
    const ordered = [...CABIN_ROWS.buildings.filter(row => !row.hamlet), ...CABIN_ROWS.buildings.filter(row => row.hamlet)];
    if (ordered.length > MAX_BUILDINGS) throw new Error(`[cabins] ${String(ordered.length)} buildings is over ${String(MAX_BUILDINGS)}`);
    for (let i = 0; i < Math.min(ordered.length, MAX_BUILDINGS); i++) {
      const row = ordered[i];
      if (row === undefined) continue;
      if (row.hamlet && this.cluster === null) {
        if (hamlet === null) throw new Error('Hamlet building requires its authored cluster');
        this.cluster = new THREE.Group(); this.cluster.name = 'cabin-cluster'; this.cluster.position.set(...hamlet.at); this.cluster.updateMatrixWorld(true); this.clusterPad = hamlet.pad;
      }
      if (this.buildings.length > 0 || row.hamlet) await macrotask(); // one native building per task, in original role order
      const b = createLogBuilding(this.resources, row, geometries, mats, models, row.hamlet ? 'member' : 'standalone', this.rows.BUILDING_LOOK);
      if (row.hamlet) b.root.name = row.id;
      else {
        this.group.add(b.root);
        if (b.casters !== null) {
          const toRoot = b.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
          for (let ki = 0; ki < Math.min(PROP_KINDS.length, PROP_KIND_COUNT); ki++) {
            const k = PROP_KINDS[ki];
            if (k === undefined) continue;
            const parts = props[k], copies = b.props[k];
            if (parts.length > MAX_PROP_PARTS || copies.length > MAX_PROP_COPIES) throw new Error(`[cabins] ${row.id}'s ${k}: ${String(parts.length)} parts × ${String(copies.length)} copies is over ${String(MAX_PROP_PARTS)} × ${String(MAX_PROP_COPIES)}`);
            for (let p = 0; p < Math.min(parts.length, MAX_PROP_PARTS); p++) for (let c = 0; c < Math.min(copies.length, MAX_PROP_COPIES); c++) {
              const part = parts[p], mat = copies[c];
              if (part !== undefined && mat !== undefined) b.casters.push(twoSidedPositions(part.geometry, m.multiplyMatrices(toRoot, mat).multiply(part.matrix)));
            }
          }
        }
      }
      this.buildings.push({ id: row.id, index: row.index, site: row, owner: b, weld: b.weldBuild() });
      b.lifeRows.sites.push({ id: row.id, root: this.resources.lend(b.root),
        anchors: b.anchors.map(anchor => ({ ...anchor, anchor: this.resources.lend(anchor.anchor) })), rooms: [...b.rooms], door: b.doorAt });
      this.life.add(b.lifeRows);
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
    for (let i = 0; i < 8; i++) { const lamp = this.lampStates[i]; if (lamp !== undefined) this.life.setLit(lamp.id, lamp.state.lit); }
    this.life.tick(dt, t, this.tmpV, sky.lamps);
    const id = this.rows.HEARTH_LOOKS.smoke, c = sky.sunColor;
    this.sunColour[0] = c.r; this.sunColour[1] = c.g; this.sunColour[2] = c.b;
    setLentParam(id, 'sunColour', this.sunColour); setLentParam(id, 'lamps', sky.lamps); setLentParam(id, 'shade', 1 - 0.8 * sky.night);
  }
}

// ───────────────────────────── glTF helpers ─────────────────────────────

/** A model library's LOD file, through the shared loader and its declared material aliases. */
export function loadLod(id: string): Promise<{ scene: THREE.Group }> {
  return loadRigFile(`/assets/models/${id}/${id}_lod.glb`, authored.propMaterials);
}

/** A model library's LOD file's node tree alone (for `prepModel`): what a scan model's loader reads. */
export async function loadLodNodes(id: string): Promise<THREE.Object3D> {
  return rigRoot(await loadLod(id));
}

/** flatten a glTF scene into (geometry, material, world matrix) triples with sky-aware materials */
const isPropMesh = (node: THREE.Object3D): node is THREE.Mesh => 'isMesh' in node;
export function prepModel(root: THREE.Object3D, sky: Sky): PropPart[] {
  root.updateMatrixWorld(true);
  const out: PropPart[] = [];
  const sharpen = (texture: THREE.Texture | null): void => { if (texture) texture.anisotropy = 8; };
  root.traverse((node) => {
    if (!isPropMesh(node)) return;
    const mat = node.material as THREE.MeshStandardMaterial;
    sharpen(mat.map); sharpen(mat.normalMap); sharpen(mat.roughnessMap); sharpen(mat.aoMap);
    sky.setupMaterial(mat);
    out.push({ geometry: node.geometry, material: mat, matrix: node.matrixWorld.clone() });
  });
  return out;
}

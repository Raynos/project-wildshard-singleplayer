import { prepareWorldSceneSurfaces, worldSceneSurfaceMaterial } from '@wildshard/game/shardfile/worldSceneSurface';
import { resourceScope } from '@wildshard/engine/app/resources';
import { plumbingKnob } from '@wildshard/game/shard/declaredPlumbing';
import { memoUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { LivingBuildings } from '@wildshard/game/shardfile/livingBuildings';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { emptyBuildingLifeRows } from '@wildshard/format/buildings';
import type { SiteLightState } from '@wildshard/engine/fx/SiteLights';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { productCoverAppearance } from '@wildshard/game/looks/coverAppearance';
import { loadFirstPartyProduct, slugRuntimeProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import type { BakedBuilding, CabinAppearance, CustomSections } from '../productSections.generated.d.ts';
import { CABIN_ROWS, createLogBuilding, type LogBuilding } from './cabinBake';

/** The living cabin owner: doors, fires, lanterns, wheel and pooled lights.
 * Frozen shells and specimen models are admitted independently through world/scenes.
 * The timber landmarks share the original cabin materials. */

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

type CabinRows = CabinAppearance;
/** Read verified named JSON before the building or its materials are constructed. */
export async function loadCabinRows(): Promise<CabinRows> {
  const product = await loadFirstPartyProduct('pine-hollow');
  return product.section<CustomSections['custom/cabinAppearance']>('custom/cabinAppearance');
}

const matsCache = new WeakMap<Sky, Promise<Mats>>();
/** the cabins' PBR materials, loaded once per sky and shared (PH-B3: the landmarks build with the same set — no new programs) */
export function cabinMats(sky: Sky, resources?: SceneHandles): Promise<Mats> {
  return memoUntilDisposed(matsCache, sky, () => loadMats(sky, resources));
}

async function loadMats(sky: Sky, resources?: SceneHandles): Promise<Mats> {
  const owner = resourceScope();
  const { HEARTH_LOOKS } = await loadCabinRows();
  const product = await loadFirstPartyProduct('pine-hollow'), appearance = await productCoverAppearance(product, 'look/cover-appearance.json');
  const surfaces = new Map<string, THREE.Material>();
  if (resources === undefined) {
    const rows = product.section('world/scenes').materials.filter(row => row.kind === 'surface');
    await prepareWorldSceneSurfaces(rows, sky, product, owner);
    await rows.reduce(async (pending, row) => { await pending; surfaces.set(row.id, await worldSceneSurfaceMaterial(row, sky, product, owner)); }, Promise.resolve());
  }
  const material = (key: string): THREE.Material => { const value = resources?.material(`materials.timber.${key}`) ?? surfaces.get(`timber.${key}`); if (value === undefined) throw new Error(`Missing cabin surface: ${key}`); return value; };
  const standard = (key: string): THREE.MeshStandardMaterial => { const value = material(key); if (!(value instanceof THREE.MeshStandardMaterial)) throw new Error(`Expected standard cabin surface: ${key}`); return value; };
  const glow = await appearance.texture(product, 'glow');
  return { log: standard('log'), endGrain: standard('endGrain'), chink: standard('chink'), roof: material('roof'), beam: standard('beam'), deck: standard('deck'),
    door: material('door'), stone: material('stone'), glass: standard('glass'), bark: standard('bark'), iron: standard('iron'), cloth: standard('cloth'), char: standard('char'),
    smoke: lentLook(HEARTH_LOOKS.smoke), flame: lentLook(HEARTH_LOOKS.flame), ember: lentLook(HEARTH_LOOKS.ember),
    glow: new THREE.MeshBasicMaterial({ map: glow, color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }) };
}

/** the phone's pooled cabin lights (PH-L3): at most this many */
const MAX_SHARED_LIGHTS = 4;
/** Maximum admitted living buildings. */
const MAX_BUILDINGS = 16;


// ───────────────────────────── the homestead ─────────────────────────────


/** Authored site and its living owner, in native cabin/hamlet order. */
export interface CabinBuilding {
  readonly id: string;
  readonly index: number;
  readonly site: BakedBuilding;
  readonly owner: LogBuilding;
}

/**
 * The homestead: the buildings built from the bake, and their shared living-building host (the look
 * ../../generators/cabinLook.ts `CABIN_LIFE`: doors, fires and lamps on the clock, the phone's pooled lights, swings, the wheel,
 * floors and solids). The smoke's sun and night hold are Pine's (`update`).
 */
export class Cabins {
  readonly resources: SceneHandles;
  readonly life: LivingBuildings;
  private readonly lampStates: { readonly id: string; readonly state: SiteLightState }[] = [];
  get interactables(): Interactable[] { return this.life.interactables; }
  get audioState(): LivingBuildings['audioState'] { return this.life.audioState; }
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
  private cabinCount = 0;
  private tmpV = new THREE.Vector3();
  private sunColour = [1, 1, 1];
  /** every building, as its model sees it (E315 M2) */
  readonly buildings: CabinBuilding[] = [];
  private loaded = false;
  private readonly sky: Sky;
  private readonly rows: CabinRows;
  /** the content scene the phone's shared cabin lights join (`game.scene`: a grid region's parked frame) */
  private readonly lightScene: THREE.Scene;

  /**
   * `lightScene` is the scene the homestead's content goes in (`game.scene`), never the page's root: a light added to
   * the live root while a region builds changes every visible program's light count (sp-o6: nine programs relinked in one
   * 162 ms Simulator frame of Pine's `world` hook). In the parked frame the lights are future lights the entry warms.
   */
  constructor(sky: Sky, lightScene: THREE.Scene, rows: CabinRows, resources: SceneHandles) {
    this.resources = resources;
    this.life = new LivingBuildings(this.resources, rows.CABIN_LIFE);
    this.rows = rows;
    this.sky = sky;
    this.lightScene = lightScene;
    resources.publish('cabins.root', this.group);
  }

  /** Availability for the admitted audio/floor rows. Static specimens load from the product catalogue. */
  get kit(): true | null { return this.loaded ? true : null; }

  /** Build live nodes in native order before the deferred frozen scene is assembled. */
  async build(): Promise<{ group: THREE.Group; interactables: Interactable[] }> {
    const { CABIN_LIGHT } = this.rows;
    const mats = await cabinMats(this.sky, this.resources);
    const lifeRows = emptyBuildingLifeRows();
    lifeRows.lamps.push({ material: this.resources.lend(mats.glass), full: mats.glass.emissiveIntensity });
    // the phone's shared cabin lights (PH-L3): TWO pooled lights, not one per anchor — every point light is per-fragment
    // cost on every lit surface, grass included; the nearest cabin's fire pit and porch lantern (else its room / hearth)
    if (plumbingKnob(slugRuntimeProduct('pine-hollow')?.source.plumbing, buildTier(), 'pine.sharedCabinLights', 'boolean', TIER_CONFIG)) for (let k = 0; k < Math.min(CABIN_LIGHT.count, MAX_SHARED_LIGHTS); k++) lifeRows.shared.push(this.resources.lend(LightPool.for(this.lightScene).acquire(CABIN_LIGHT.color, CABIN_LIGHT.intensity, CABIN_LIGHT.distance, CABIN_LIGHT.decay)));
    this.life.add(lifeRows);
    const models = { firePit: this.resources.object('cabins.source.pit'), lantern: this.resources.object('cabins.source.lantern') };
    this.loaded = true;
    const ordered = [...CABIN_ROWS.buildings.filter(row => !row.hamlet), ...CABIN_ROWS.buildings.filter(row => row.hamlet)];
    if (ordered.length > MAX_BUILDINGS) throw new Error(`[cabins] ${String(ordered.length)} buildings is over ${String(MAX_BUILDINGS)}`);
    for (let i = 0; i < Math.min(ordered.length, MAX_BUILDINGS); i++) {
      const row = ordered[i];
      if (row === undefined) continue;
      if (this.buildings.length > 0 || row.hamlet) await macrotask(); // one native building per task, in original role order
      const b = createLogBuilding(this.resources, row, mats, models, row.hamlet ? 'member' : 'standalone', this.rows.BUILDING_LOOK);
      if (row.hamlet) b.root.name = row.id;
      this.group.add(b.root);
      this.buildings.push({ id: row.id, index: row.index, site: row, owner: b });
      b.lifeRows.sites.push({ id: row.id, root: this.resources.lend(b.root),
        anchors: b.anchors.map(anchor => ({ ...anchor, anchor: this.resources.lend(anchor.anchor) })), rooms: [...b.rooms], door: b.doorAt });
      this.life.add(b.lifeRows);
      if (!row.hamlet) this.cabinCount++;
    }
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

/**
 * PineLandmarks — Pine Hollow's landmarks (PINE-HOLLOW-REMASTER PH-B3 and the B6-adjacent buildings), every site from
 * src/shards/pine-hollow/data/layout.generated.ts:
 *
 *   · the FIRE LOOKOUT on the ridge pad: four splayed peeled-log legs with girts and X-bracing, a stair of five flights
 *     inside a railed cage (treads the character climbs), a 6 m deck with a railing, the glazed cab with a hipped moss
 *     roof, and the zipline's launch jutting off the deck toward the Hollow;
 *   · the ZIPLINE: the steel cable (a sagging chord) from the launch gantry to the LANDING platform in the Hollow (4, 20),
 *     a 3 m deck on log posts with a stair down; `zipTop` / `zipBottom` are the ride's anchors (the ride is a later row);
 *   · the CREEK FOOTBRIDGE on the E road: two log stringers, split-plank deck, log trestles in the gully, a log handrail;
 *   · image-to-3D hero props (TRELLIS.2, PBR kept; public/assets/models/pine-hollow-hero/), models on the contract
 *     (E315 M2, src/shards/pine-hollow/runtime/models/): the King's 7 standing stones, the 3 waystone lanterns (pond shore, ridge
 *     by the lookout, the den's cave mouth), the beaver dam on the sill, the canoe on the pond shore, the lodge's
 *     contract board, and the bear cave's rock arch (opened into the cave). Placed here, each type a set: LOD0 until
 *     the nearest copy is past its distance, then LOD1, gone past the props' range (`place`'s `lodBy: 'set'`).
 *
 * The timber pieces are models too (E315 M2): pine-hollow/fire-lookout, zipline-landing, creek-footbridge and the
 * zip-cable, built on the cabins' own kit and materials (src/shards/pine-hollow/world/timber.ts: one merged mesh per
 * material per landmark, two position-only shadow proxies, no new programs), placed here at the frames their old
 * world-space builders used; the landing and the footbridge are fitted to the ground under them. Each prop type is ONE
 * InstancedMesh per LOD. Lights: none of their own — the waystones' flames and the cab's glass are emissive, driven by
 * `sky.lamps` (PH-L3), and the waystones are lamp sites the phone's pooled cabin pair may visit (Cabins.addLampSite).
 *
 *   const lm = await installPineLandmarks({ sky, registry, cabins, game });   // registers, adds to the scene, updates
 *   lm.setLit('pond', true);                                                  // the quest relights a waystone
 */
import * as THREE from 'three';
import authored from '../../data/timberWorld.generated.json' with { type: 'json' };
import { macrotask } from '@wildshard/engine/boot/plan';
import { floorAtRects } from '@wildshard/engine/physics/box';
import type { ModelDef } from '@wildshard/engine/models/model';
import type { SceneHandles } from '@wildshard/game/shardfile/worldScenes';
import { ModelPlacementBatch, modelPoseMatrix as placeMatrix, type ModelPose as Place } from '@wildshard/engine/models/placementBatch';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Cabins } from './homestead';
import { loadPainted } from '../looks/paintedTextures';
import { pineModels } from './context';
import { loadTimber, type Floor } from './timber';
import { bridgeSite, landingSite, lookoutSite, loadSiteTimbers } from './timberSites';
import { timberLandmark } from '../models/fireLookout';
import { zipCable } from '../models/zipCable';
import { loadCodeParts } from './codeParts';
import { CaveInterior } from '../kit/caveInterior';
import { TIER } from '@wildshard/engine/core/tier';



// ───────────────────────────── the fire lookout, the zipline and the footbridge (models: ../chunks/pine-hollow/models/) ─────


// ───────────────────────────── the creek footbridge (the E road over the gully) ─────────────────────────────


// ───────────────────────────── the image-to-3D hero props ─────────────────────────────

/** Native quest readers borrow the same generated landmark facts as the world. */
export const CANOE_SITE = { x: -67.8, z: 119 };
export function contractBoardSite(): { x: number; z: number; yaw: number } { return { ...authored.landmarks.contractBoardSite }; }
export type WaystoneId = 'pond' | 'ridge' | 'den';
/** the three waystones, in their sites' order (the glow's points) */
const WAYSTONE_IDS: readonly WaystoneId[] = ['pond', 'ridge', 'den'];
const WAYSTONES = 3;
export function waystoneSites(): Record<WaystoneId, { x: number; z: number; yaw: number }> { return structuredClone(authored.landmarks.waystoneSites); }

// ───────────────────────────── the whole set ─────────────────────────────

export class PineLandmarks {
  readonly group = new THREE.Group();
  zip = { top: new THREE.Vector3(0, 0, 0), bottom: new THREE.Vector3(0, 0, 0), launch: new THREE.Vector3(0, 0, 0), landing: new THREE.Vector3(0, 0, 0) };
  /** the timber models' colliders, then the props' (world space: the navmesh bake reads them) */
  readonly timberColliders: ColliderDesc[] = [];
  readonly propColliders: ColliderDesc[] = [];
  private floors: Floor[] = [];
  private lit: Record<WaystoneId, { lit: boolean }> = { pond: { lit: true }, ridge: { lit: true }, den: { lit: true } };
  /** the drawn-up canoe: its place and its copies (PH-C8 hides it while you paddle) */
  private canoe: { place: Place; placed: Awaited<ReturnType<ModelPlacementBatch['place']>> } | null = null;
  private glow: THREE.Points | null = null;
  private glowMat: THREE.PointsMaterial | null = null;
  private anchors: Record<WaystoneId, THREE.Object3D> | null = null;
  private tmp = new THREE.Vector3();
  /** PH-B2: the Ridge's granite and the bear cave (null: the kit is not in this build) */
  crags: { readonly cave: CaveInterior } | null = null;

  constructor(private sky: Sky, private readonly scenes: SceneHandles) { this.group.name = 'pine-landmarks'; }

  /**
   * `registry`: where the placed models register (null: only built, and drawn under `group`). The crags stand where their
   * bake put them (G285: ../generators/crags.ts stepped them round the forest's trunks).
   */
  async build(cabins: Cabins | null, registry: WorldRegistry | null = null): Promise<this> {
    const cave = CaveInterior.load(); // the kit + the cave + their textures, fetched while the timber builds
    const ctx = pineModels(this.sky);
    await Promise.all([loadTimber(ctx), loadSiteTimbers(ctx), loadCodeParts()]);
    const batch = new ModelPlacementBatch({ ctx, registry, fallbackParent: this.group, colliders: this.timberColliders });
    const placeTimber = async <P extends object>(model: ModelDef<P>, frame: THREE.Matrix4, params: P | undefined, id: keyof typeof authored.landmarks.timberFloors): Promise<void> => {
      const mine: readonly Floor[] = authored.landmarks.timberFloors[id];
      await batch.frames(model, [frame], params, { draw: 'single', piece: { id, solidFloor: true, floor: (x, z) => floorAtRects(mine, x, z, 'highest') } });
      this.floors.push(...mine);
    };
    // the timber landmarks (models), one task each, at the frames their world-space builders used
    const lookoutAt = lookoutSite();
    await placeTimber(timberLandmark('fire-lookout'), lookoutAt, undefined, 'pine-lookout');
    await macrotask();
    const landingAt = landingSite().at, atSite = { site: 'world' } as const;
    await placeTimber(timberLandmark('zipline-landing'), landingAt, atSite, 'pine-zip-landing');
    const zip=authored.landmarks.zip;
    this.zip={top:new THREE.Vector3(...zip.top),bottom:new THREE.Vector3(...zip.bottom),launch:new THREE.Vector3(...zip.launch),landing:new THREE.Vector3(...zip.landing)};
    // the steel cable between the two gantries (baked between the same anchors, ../generators/codeParts.ts)
    const { top } = this.zip;
    await batch.place(zipCable, [{ x: top.x, y: top.y, z: top.z }], { draw: 'single', piece: { id: 'pine-zip-cable' } });
    await macrotask();
    const bridge = bridgeSite();
    await placeTimber(timberLandmark('creek-footbridge'), bridge.at, atSite, 'pine-footbridge');
    await macrotask();
    this.crags = { cave: await cave };
    await this.buildProps(cabins);
    await macrotask();
    for (const kind of ['crag-cliff', 'crag-boulder', 'scree']) await this.scenes.place(`crags.${TIER}.${kind}`);
    this.scenes.object(`crags.${TIER}`); // append the fixed skin and cave after the module placements
    const cragFx = new THREE.Group(); cragFx.name = 'pine-crags';
    this.crags.cave.buildFx(); cragFx.add(...this.crags.cave.fx); this.group.add(cragFx);
    return this;
  }

  private async buildProps(cabins: Cabins | null): Promise<void> {
    const stones = authored.landmarks.stones;
    if (stones.length > 16) throw new Error('Standing-stone row bound exceeded');
    for (let i = 0; i < Math.min(stones.length, 16); i++) { const row = stones[i]; if (row !== undefined) this.propColliders.push(...(await this.scenes.place(`heroes.${row.kind}`)).colliders); }
    this.propColliders.push(...(await this.scenes.place('heroes.waystone')).colliders);
    this.lanterns(cabins, await loadPainted('glow'));
    this.propColliders.push(...(await this.scenes.place('heroes.beaver-dam')).colliders);
    const drawnUp = await this.scenes.place('heroes.canoe'), canoePlace = authored.landmarks.canoe[0];
    this.propColliders.push(...drawnUp.colliders);
    this.canoe = canoePlace === undefined ? null : { place: canoePlace, placed: drawnUp };
    this.propColliders.push(...(await this.scenes.place('heroes.contract-board')).colliders);
    this.propColliders.push(...(await this.scenes.place(this.crags?.cave ? 'heroes.cave-arch' : 'heroes.closed-arch')).colliders);
  }

  /** the waystones' flames (emissive, one instanced draw) and their glow (one Points draw), both on sky.lamps */
  private lanterns(cabins: Cabins | null, glow: THREE.Texture): void {
    const lamps = authored.landmarks.lamps, glowPos = Float32Array.from(lamps.flat());
    const anchors = {} as Record<WaystoneId, THREE.Object3D>;
    lamps.forEach((w, i) => { const id = WAYSTONE_IDS[i]; if (id) { const a = new THREE.Object3D(); a.position.fromArray(w); this.group.add(a); anchors[id] = a; } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
    // the flame: one additive point per lantern (the lantern's own glass is in its baked texture), bright core, soft halo
    this.glowMat = new THREE.PointsMaterial({ map: glow, color: 0xffa050, size: 0.95, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glow = new THREE.Points(g, this.glowMat);
    this.glow.name = 'waystone-glow';
    this.glow.renderOrder = 6;
    this.group.add(this.glow);
    this.anchors = anchors;
    if (cabins) for (const id of ['pond', 'ridge', 'den'] as const) { const a = anchors[id]; cabins.addLampSite(a, 0xffb060, 9, 12, this.lit[id]); }
  }

  /** the canoe secret (PH-C8): the drawn-up canoe is gone from the shore while you paddle it (the ride draws its own) */
  setCanoeAway(away: boolean): void {
    const c = this.canoe;
    if (!c) return;
    const m = away ? new THREE.Matrix4().makeScale(0, 0, 0) : placeMatrix(c.place);
    c.placed.object.traverse((o) => { if (o instanceof THREE.InstancedMesh) { o.setMatrixAt(0, m); o.instanceMatrix.needsUpdate = true; } });
  }

  setLit(id: WaystoneId, on: boolean): void {
    this.lit[id].lit = on;
    const i = WAYSTONE_IDS.indexOf(id);
    const pos = this.glow?.geometry.getAttribute('position');
    if (pos && this.anchors) { const a = this.anchors[id]; pos.setY(i, on ? a.position.y : -1e4); pos.needsUpdate = true; }
  }

  floorHeightAt(x: number, z: number): number | undefined { return floorAtRects(this.floors, x, z, 'highest'); }

  update(t: number): void {
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmp);
    this.crags?.cave.presentFrame(t, this.sky);
    // the lanterns on the clock (PH-L3): a banked ember by day, full flame at night, a slow flicker
    const lamps = this.sky.lamps;
    if (this.glowMat && this.glow && this.anchors) {
      // a banked ember by day, the full flame at night, a slow flicker; past 150 m (or none lit) it is not drawn at all
      this.glowMat.opacity = (0.1 + 0.9 * lamps) * (1 + 0.1 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 23.1));
      let near = Infinity;
      for (let i = 0; i < WAYSTONES; i++) { const id = WAYSTONE_IDS[i]; if (id !== undefined && this.lit[id].lit) near = Math.min(near, this.anchors[id].position.distanceToSquared(this.tmp)); }
      this.glow.visible = near < 150 * 150;
    }
  }
}

/**
 * Build Pine Hollow's landmarks, register them (drawn, colliding, the decks as floors) and keep them updated. The hamlet's
 * buildings are not here: `new Cabins(sky, game.scene)` assembles them with the cabins from the bake (../generators/logCabin.ts).
 */
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry; cabins: Cabins | null; scenes: SceneHandles; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void; }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky, h.scenes).build(h.cabins, h.registry);
  // what is left is light: the waystones' flames and anchors, the cave's shaft and drips
  h.registry.add({ id: 'pine-landmarks', name: 'Landmark lights', category: 'props', file: 'src/shards/pine-hollow/runtime/world/landmarks.ts', object: lm.group });
  // PH-B2: the crags' modules registered themselves (models, 90 hulls a task); the cave's shell + the ground over it
  const crags = lm.crags;
  if (crags) {
    await macrotask();
    h.registry.add({ id: 'pine-cave', name: 'Bear cave', category: 'nature', file: 'src/shards/pine-hollow/runtime/kit/caveInterior.ts', colliders: [...crags.cave.shell, ...crags.cave.roofPatch()], surface: 'rock' });
  }
  h.onUpdate((_dt, t) => { lm.update(t); });
  return lm;
}

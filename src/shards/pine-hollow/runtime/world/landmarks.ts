import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
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
import { admitLandmarkRows, landmarkRows, landmarkFloors } from './landmarkRows';
import { PineQuestViews } from '../../quest/views';
import { macrotask } from '@wildshard/engine/boot/plan';
import { type FloorRect, floorAtRects } from '@wildshard/engine/physics/box';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { type ModelPlacementBatch, modelPoseMatrix as placeMatrix, type ModelPose as Place } from '@wildshard/engine/models/placementBatch';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { forestPage, type LivingPage as PineCabins } from '@wildshard/game/shardfile/forestPage';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { emptyBuildingLifeRows } from '@wildshard/format/buildings';
import { productCoverAppearance } from '@wildshard/game/looks/coverAppearance';
import { loadCodeParts } from './codeParts';
import { CaveInterior } from '../kit/caveInterior';
import { TIER } from '@wildshard/engine/core/tier';
import { installRangedPage } from '@wildshard/game/loadout/rangedPage';
import { finishForestPageAudio } from '@wildshard/game/audio/forestPage';
import { installRuntimeAudioEntry } from '@wildshard/game/plugin/audio';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { RainFx } from '../looks/rainFx';
import { pineMemoryTrim } from '../debug/options';
import { registerPineLap } from '../dev/perfLap';
import type { RangedPageRows } from '@wildshard/format/rangedPage';



// ───────────────────────────── the fire lookout, the zipline and the footbridge (models: ../chunks/pine-hollow/models/) ─────


// ───────────────────────────── the creek footbridge (the E road over the gully) ─────────────────────────────


// ───────────────────────────── the image-to-3D hero props ─────────────────────────────

/** Native quest readers borrow the same generated landmark facts as the world. */
export const CANOE_SITE = { x: -67.8, z: 119 };
export type WaystoneId = 'pond' | 'ridge' | 'den';
/** the three waystones, in their sites' order (the glow's points) */
const WAYSTONE_IDS: readonly WaystoneId[] = ['pond', 'ridge', 'den'];
const WAYSTONES = 3;


// ───────────────────────────── the whole set ─────────────────────────────

export class PineLandmarks {
  readonly group = new THREE.Group();
  zip = { top: new THREE.Vector3(0, 0, 0), bottom: new THREE.Vector3(0, 0, 0), launch: new THREE.Vector3(0, 0, 0), landing: new THREE.Vector3(0, 0, 0) };
  /** the timber models' colliders, then the props' (world space: the navmesh bake reads them) */
  readonly timberColliders: ColliderDesc[] = [];
  readonly propColliders: ColliderDesc[] = [];
  private floors: FloorRect[] = [];
  private lit: Record<WaystoneId, { lit: boolean }> = { pond: { lit: true }, ridge: { lit: true }, den: { lit: true } };
  /** the drawn-up canoe: its place and its copies (PH-C8 hides it while you paddle) */
  private canoe: { place: Place; placed: Awaited<ReturnType<ModelPlacementBatch['place']>> } | null = null;
  private cabins: PineCabins | null = null;
  private chapter: PineQuestViews | null = null;
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
  async build(cabins: PineCabins | null): Promise<this> {
    await admitLandmarkRows(await loadFirstPartyProduct('pine-hollow'));
    const cave = CaveInterior.load(); // the kit + the cave + their textures, fetched while the timber builds
    await loadCodeParts(); // the retained cave roof still borrows its native collider part
    this.timberColliders.push(...(await this.scenes.place('timbers.fire-lookout')).colliders);
    this.floors.push(...landmarkFloors('pine-lookout'));
    await macrotask();
    this.timberColliders.push(...(await this.scenes.place('timbers.zipline-landing')).colliders);
    this.floors.push(...landmarkFloors('pine-zip-landing'));
    const zip = landmarkRows().zip;
    this.zip = { top: new THREE.Vector3(...zip.top), bottom: new THREE.Vector3(...zip.bottom), launch: new THREE.Vector3(...zip.launch), landing: new THREE.Vector3(...zip.landing) };
    this.timberColliders.push(...(await this.scenes.place('timbers.zip-cable')).colliders);
    await macrotask();
    this.timberColliders.push(...(await this.scenes.place('timbers.creek-footbridge')).colliders);
    this.floors.push(...landmarkFloors('pine-footbridge'));
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

  private async buildProps(cabins: PineCabins | null): Promise<void> {
    const product = await loadFirstPartyProduct('pine-hollow');
    const stones = landmarkRows().stones;
    if (stones.length > 16) throw new Error('Standing-stone row bound exceeded');
    for (let i = 0; i < Math.min(stones.length, 16); i++) { const row = stones[i]; if (row !== undefined) this.propColliders.push(...(await this.scenes.place(`heroes.${row.kind}`)).colliders); }
    this.propColliders.push(...(await this.scenes.place('heroes.waystone')).colliders);
    this.lanterns(cabins, await (await productCoverAppearance(product, 'look/cover-appearance.json')).texture(product, 'glow'));
    this.propColliders.push(...(await this.scenes.place('heroes.beaver-dam')).colliders);
    const drawnUp = await this.scenes.place('heroes.canoe'), canoePlace = landmarkRows().canoe[0];
    this.propColliders.push(...drawnUp.colliders);
    this.canoe = canoePlace === undefined ? null : { place: canoePlace, placed: drawnUp };
    this.propColliders.push(...(await this.scenes.place('heroes.contract-board')).colliders);
    this.propColliders.push(...(await this.scenes.place(this.crags?.cave ? 'heroes.cave-arch' : 'heroes.closed-arch')).colliders);
  }

  /** the waystones' flames (emissive, one instanced draw) and their glow (one Points draw), both on sky.lamps */
  private lanterns(cabins: PineCabins | null, glow: THREE.Texture): void {
    const lamps = landmarkRows().lamps, glowPos = Float32Array.from(lamps.flat());
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
    this.cabins = cabins;
    if (cabins) for (const id of ['pond', 'ridge', 'den'] as const) {
      const anchor = anchors[id], handle = cabins.resources.lend(anchor), rows = emptyBuildingLifeRows();
      rows.sites.push({ id: `waystone.${id}`, root: handle, anchors: [{ anchor: handle, color: 0xffb060, intensity: 9, distance: 12, decay: 2, seed: anchor.position.x * 0.37, kind: 'lamp', rank: 0 }] });
      cabins.life.add(rows);
    }
  }

  /** Counted custom chapter/landmark view binding. Platform services take rows. */
  async installChapter(ctx: ShardContext, input: RangedPageRows): Promise<void> {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Missing landmark play services');
    const floor = forestPage(ctx.scope, input.forest), { game, player } = world, { animals, audio, music, hud } = play;
    installRuntimeAudioEntry(ctx, 'play', { audio, music });
    const page = await installRangedPage(ctx, { ...input, shadowBatch: !pineMemoryTrim() });
    installEnteredRuntimeService(ctx, scope => { registerPineLap({ game, player, animals, music, hud, elites: page.fights.elites, king: page.fights.encounter }, scope); });
    this.chapter = await PineQuestViews.install(ctx, this);
    const quest = this.chapter.quest;
    const ambience = await finishForestPageAudio(ctx, input.id); quest.useSfx(ambience.sfx);
    const spots = this.crags?.cave.spots() ?? [];
    for (let i = 0; i < Math.min(spots.length, 256); i++) { const spot = spots[i]; if (spot !== undefined) ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); }
    await RainFx.installPage(ctx, await ctx.product.json('world/weather-observations.json'));
    const life = await installPageLife(ctx, await ctx.product.json(input.life), page.compendium?.state ?? null, ambience.sfx);
    Object.assign(runtime.objects, { pineLife: life });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins: floor.cabins, props: floor.props, streams: floor.streams, pineLife: life });
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
    this.cabins?.life.setLit(`waystone.${id}`, on);
    const i = WAYSTONE_IDS.indexOf(id);
    const pos = this.glow?.geometry.getAttribute('position');
    if (pos && this.anchors) { const a = this.anchors[id]; pos.setY(i, on ? a.position.y : -1e4); pos.needsUpdate = true; }
  }

  floorHeightAt(x: number, z: number): number | undefined { return floorAtRects(this.floors, x, z, 'highest'); }

  update(dt: number, t: number): void {
    this.chapter?.present(dt, t);
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
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry; cabins: PineCabins | null; scenes: SceneHandles; }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky, h.scenes).build(h.cabins);
  // what is left is light: the waystones' flames and anchors, the cave's shaft and drips
  h.registry.add({ id: 'pine-landmarks', name: 'Landmark lights', category: 'props', file: 'src/shards/pine-hollow/runtime/world/landmarks.ts', object: lm.group });
  // PH-B2: the crags' modules registered themselves (models, 90 hulls a task); the cave's shell + the ground over it
  const crags = lm.crags;
  if (crags) {
    await macrotask();
    h.registry.add({ id: 'pine-cave', name: 'Bear cave', category: 'nature', file: 'src/shards/pine-hollow/runtime/kit/caveInterior.ts', colliders: [...crags.cave.shell, ...crags.cave.roofPatch()], surface: 'rock' });
  }
  return lm;
}

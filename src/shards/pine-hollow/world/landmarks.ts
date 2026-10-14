/**
 * PineLandmarks — Pine Hollow's landmarks (PINE-HOLLOW-REMASTER PH-B3 and the B6-adjacent buildings), every site from
 * src/shards/pine-hollow/data/layout.ts:
 *
 *   · the FIRE LOOKOUT on the ridge pad: four splayed peeled-log legs with girts and X-bracing, a stair of five flights
 *     inside a railed cage (treads the character climbs), a 6 m deck with a railing, the glazed cab with a hipped moss
 *     roof, and the zipline's launch jutting off the deck toward the Hollow;
 *   · the ZIPLINE: the steel cable (a sagging chord) from the launch gantry to the LANDING platform in the Hollow (4, 20),
 *     a 3 m deck on log posts with a stair down; `zipTop` / `zipBottom` are the ride's anchors (the ride is a later row);
 *   · the CREEK FOOTBRIDGE on the E road: two log stringers, split-plank deck, log trestles in the gully, a log handrail;
 *   · image-to-3D hero props (TRELLIS.2, PBR kept; public/assets/models/pine-hollow-hero/), models on the contract
 *     (E315 M2, src/shards/pine-hollow/models/): the King's 7 standing stones, the 3 waystone lanterns (pond shore, ridge
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
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { macrotask } from '@wildshard/engine/boot/plan';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { CullOptions } from '@wildshard/engine/models/cull';
import type { ModelDef, Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { makeGlowTexture, type Cabins } from './homestead';
import { PINE_HERO_IDS, type PineHeroId } from './heroFiles';
import { pineModels } from './context';
import { HERO_FRONT, heroLod0, loadPineHero } from './hero';
import { STONE_KINDS, standingStone } from '../models/standingStone';
import { waystone } from '../models/waystone';
import { beaverDam } from '../models/beaverDam';
import { canoe } from '../models/canoe';
import { contractBoard } from '../models/contractBoard';
import { caveArch, openCaveArch } from '../models/caveArch';
import { loadTimber, type Floor } from './timber';
import { bridgeSite, landingSite, lookoutSite, loadSiteTimbers } from './timberSites';
import { fireLookout, loadFireLookout } from '../models/fireLookout';
import { ziplineLanding } from '../models/ziplineLanding';
import { creekFootbridge } from '../models/creekFootbridge';
import { zipCable } from '../models/zipCable';
import { PineCrags } from './crags';
import { CRAG_ROWS } from './cragBake';

type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);


// ───────────────────────────── the fire lookout, the zipline and the footbridge (models: ../chunks/pine-hollow/models/) ─────


// ───────────────────────────── the creek footbridge (the E road over the gully) ─────────────────────────────


/** the highest deck rectangle over (x, z) */
function floorIn(floors: readonly Floor[], x: number, z: number): number | undefined {
  let best: number | undefined;
  for (const f of floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
    if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd && (best === undefined || f.y > best)) best = f.y;
  }
  return best;
}

// ───────────────────────────── the image-to-3D hero props ─────────────────────────────

/** every prop the landmarks can place (src/shards/pine-hollow/world/heroFiles.ts lists the ones built so far: the rest are skipped) */
type HeroId = PineHeroId;
interface Place { x: number; y: number; z: number; yaw: number; scale: number; pitch?: number; roll?: number }
const placeMatrix = (p: Place): THREE.Matrix4 => new THREE.Matrix4().compose(
  V(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch ?? 0, p.yaw, p.roll ?? 0, 'YXZ')), V(p.scale, p.scale, p.scale));

/** Native quest readers borrow the same generated landmark facts as the world. */
export const CANOE_SITE = { x: -67.8, z: 119 };
export function contractBoardSite(): { x: number; z: number; yaw: number } { return { ...authored.landmarks.contractBoardSite }; }
export type WaystoneId = 'pond' | 'ridge' | 'den';
export function waystoneSites(): Record<WaystoneId, { x: number; z: number; yaw: number }> { return structuredClone(authored.landmarks.waystoneSites); }

// ───────────────────────────── the whole set ─────────────────────────────

export interface PineLandmarksHandle {
  group: THREE.Group;
  /** the zipline's cable ends (world) and where you stand to ride / where you land */
  zip: { top: V3; bottom: V3; launch: V3; landing: V3 };
  setLit: (id: WaystoneId, on: boolean) => void;
  setCanoeAway: (away: boolean) => void;
  isLit: (id: WaystoneId) => boolean;
  floorHeightAt: (x: number, z: number) => number | undefined;
}

export class PineLandmarks implements PineLandmarksHandle {
  readonly group = new THREE.Group();
  zip = { top: V(0, 0, 0), bottom: V(0, 0, 0), launch: V(0, 0, 0), landing: V(0, 0, 0) };
  /** the timber models' colliders, then the props' (world space: the navmesh bake reads them) */
  readonly timberColliders: ColliderDesc[] = [];
  readonly propColliders: ColliderDesc[] = [];
  private floors: Floor[] = [];
  private lit: Record<WaystoneId, boolean> = { pond: true, ridge: true, den: true };
  /** the drawn-up canoe: its place and its copies (PH-C8 hides it while you paddle) */
  private canoe: { place: Place; placed: Placed } | null = null;
  private glow: THREE.Points | null = null;
  private glowMat: THREE.PointsMaterial | null = null;
  private anchors: Record<WaystoneId, THREE.Object3D> | null = null;
  private tmp = new THREE.Vector3();
  /** PH-B2: the Ridge's granite and the bear cave (null: the kit is not in this build) */
  crags: PineCrags | null = null;

  constructor(private sky: Sky) { this.group.name = 'pine-landmarks'; }

  /**
   * `registry`: where the placed models register (null: only built, and drawn under `group`). The crags stand where their
   * bake put them (G285: ../generators/crags.ts stepped them round the forest's trunks).
   */
  async build(cabins: Cabins | null, registry: WorldRegistry | null = null): Promise<this> {
    const crags = PineCrags.load(this.sky); // the kit + the cave + their textures, fetched while the timber builds
    const ctx = pineModels(this.sky);
    await Promise.all([loadTimber(ctx), loadFireLookout(ctx), loadSiteTimbers(ctx)]);
    // the timber landmarks (models), one task each, at the frames their world-space builders used
    const lookoutAt = lookoutSite();
    this.placeTimber(fireLookout, lookoutAt, undefined, 'pine-lookout', registry);
    await macrotask();
    const landingAt = landingSite().at, atSite = { site: 'world' } as const;
    this.placeTimber(ziplineLanding, landingAt, atSite, 'pine-zip-landing', registry);
    const zip=authored.landmarks.zip;
    this.zip={top:new THREE.Vector3(...zip.top),bottom:new THREE.Vector3(...zip.bottom),launch:new THREE.Vector3(...zip.launch),landing:new THREE.Vector3(...zip.landing)};
    // the steel cable between the two gantries
    const { top, bottom } = this.zip;
    const cable = place(zipCable, [{ x: top.x, y: top.y, z: top.z, params: { span: [bottom.x - top.x, bottom.y - top.y, bottom.z - top.z] } }], { ctx, draw: 'single', registry, piece: { id: 'pine-zip-cable' } });
    if (registry === null) this.group.add(cable.object);
    await macrotask();
    const bridge = bridgeSite();
    this.placeTimber(creekFootbridge, bridge.at, atSite, 'pine-footbridge', registry);
    await macrotask();
    this.crags = await crags;
    await this.buildProps(cabins, registry);
    await macrotask();
    if (this.crags) {
      // PH-B2: the kit over the Ridge, and the cave behind the arch
      await this.crags.prepareSkin(macrotask);
      await this.crags.build(CRAG_ROWS.places, registry, macrotask); // the modules are models: they register themselves
      this.group.add(this.crags.group);
    }
    return this;
  }

  /**
   * Place a timber model once at its frame: drawn, colliding, its decks the piece's floors (`facts` reads them once the
   * copy is built: the build keeps them).
   */
  private placeTimber<P extends object>(model: ModelDef<P>, frame: THREE.Matrix4, params: P | undefined, id: keyof typeof authored.landmarks.timberFloors, registry: WorldRegistry | null): void {
    const mine: readonly Floor[] = authored.landmarks.timberFloors[id], e = frame.elements;
    const placed = place(model, [{ x: e[12], y: e[13], z: e[14], matrix: frame, ...(params === undefined ? {} : { params }) }], { ctx: pineModels(this.sky), draw: 'single', registry,
      piece: { id, solidFloor: true, floor: (x, z) => floorIn(mine, x, z) } });
    this.floors.push(...mine);
    this.timberColliders.push(...placed.colliders);
    if (registry === null) this.group.add(placed.object);
  }

  private async buildProps(cabins: Cabins | null, registry: WorldRegistry | null): Promise<void> {
    const ctx = pineModels(this.sky);
    await Promise.all(PINE_HERO_IDS.map((id) => loadPineHero(ctx, id)));
    // the props' own draw distance: the forest props' (phone 220 m), capped at 260 m on desktop — a 3 m stone is a few
    // pixels there, and desktop's 700 m kept every set (and its shadows) drawn from anywhere on the slab. Each type is a
    // set: its LOD from the nearest copy on the ground (E315 M2: the models' `lods`, `place`'s `lodBy: 'set'`)
    const cull: CullOptions = { lodBy: 'set', flat: true, from: 'origin', far: Math.min(TIER_CONFIG.propsFar, 260) };
    const add = <P extends object>(model: ModelDef<P>, id: HeroId, places: Place[], extra: Pick<Placement<P>, 'variant' | 'params'> = {}): { places: Place[]; placed: Placed } | null => {
      if (!heroLod0(ctx, id) || places.length === 0) return null;
      const turned = places.map((p) => ({ ...p, yaw: p.yaw + HERO_FRONT[id] }));
      const placed = place(model, turned.map((p): Placement<P> => ({ x: p.x, y: p.y, z: p.z, matrix: placeMatrix(p), ...extra })), { ctx, draw: 'instanced', cull, registry });
      this.propColliders.push(...placed.colliders);
      if (registry === null) this.group.add(placed.object);
      return { places: turned, placed };
    };
    const sites = authored.landmarks;
    for (const row of sites.stones) { const kind = STONE_KINDS.find(value => value === row.kind); if (kind) add(standingStone, kind, row.places, { variant: kind }); }
    // Deck support remains the live timber owner's; the base terrain site is authored.
    const wsPlaces = sites.waystones.map((p): Place => ({ ...p, y: (this.floorHeightAt(p.x, p.z) ?? p.y) - 0.15 }));
    const waySet = add(waystone, 'waystone', wsPlaces);
    const wayGeo = heroLod0(ctx, 'waystone')?.geometry;
    if (waySet && wayGeo) this.lanterns(waySet.places, cabins);

    add(beaverDam, 'beaver-dam', sites.dam);
    const drawnUp = add(canoe, 'canoe', sites.canoe);
    const canoePlace = drawnUp?.places[0];
    this.canoe = drawnUp && canoePlace ? { place: canoePlace, placed: drawnUp.placed } : null;

    add(contractBoard, 'contract-board', sites.board);
    const arch = sites.arch;
    const hollow = (this.crags?.caveMetaData ?? null) !== null;
    if (hollow && heroLod0(ctx, 'cave-arch')) openCaveArch(ctx);
    add(caveArch, 'cave-arch', [arch], hollow ? {} : { variant: 'closed' });
  }

  /** the waystones' flames (emissive, one instanced draw) and their glow (one Points draw), both on sky.lamps */
  private lanterns(places: readonly Place[], cabins: Cabins | null): void {
    const lamp = new THREE.Vector3(...authored.landmarks.lamp);
    const glowPos = new Float32Array(places.length * 3);
    const anchors = {} as Record<WaystoneId, THREE.Object3D>;
    const ids: WaystoneId[] = ['pond', 'ridge', 'den'];
    places.forEach((p, i) => {
      const w = lamp.clone().applyMatrix4(placeMatrix(p));
      glowPos.set([w.x, w.y, w.z], i * 3);
      const id = ids[i];
      if (id) { const a = new THREE.Object3D(); a.position.copy(w); this.group.add(a); anchors[id] = a; }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
    // the flame: one additive point per lantern (the lantern's own glass is in its baked texture), bright core, soft halo
    this.glowMat = new THREE.PointsMaterial({ map: makeGlowTexture(), color: 0xffa050, size: 0.95, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glow = new THREE.Points(g, this.glowMat);
    this.glow.name = 'waystone-glow';
    this.glow.renderOrder = 6;
    this.group.add(this.glow);
    this.anchors = anchors;
    if (cabins) for (const id of ids) { const a = anchors[id]; cabins.addLampSite(a, 0xffb060, 9, 12, () => this.lit[id]); }
  }

  /** the canoe secret (PH-C8): the drawn-up canoe is gone from the shore while you paddle it (the ride draws its own) */
  setCanoeAway(away: boolean): void {
    const c = this.canoe;
    if (!c) return;
    const m = away ? new THREE.Matrix4().makeScale(0, 0, 0) : placeMatrix(c.place);
    c.placed.object.traverse((o) => { if (o instanceof THREE.InstancedMesh) { o.setMatrixAt(0, m); o.instanceMatrix.needsUpdate = true; } });
  }

  setLit(id: WaystoneId, on: boolean): void {
    this.lit[id] = on;
    const i = (['pond', 'ridge', 'den'] as const).indexOf(id);
    const pos = this.glow?.geometry.getAttribute('position');
    if (pos && this.anchors) { const a = this.anchors[id]; pos.setY(i, on ? a.position.y : -1e4); pos.needsUpdate = true; }
  }
  isLit(id: WaystoneId): boolean { return this.lit[id]; }

  floorHeightAt(x: number, z: number): number | undefined { return floorIn(this.floors, x, z); }

  update(t: number): void {
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmp);
    this.crags?.update(t);
    // the lanterns on the clock (PH-L3): a banked ember by day, full flame at night, a slow flicker
    const lamps = this.sky.lamps;
    if (this.glowMat && this.glow && this.anchors) {
      // a banked ember by day, the full flame at night, a slow flicker; past 150 m (or none lit) it is not drawn at all
      this.glowMat.opacity = (0.1 + 0.9 * lamps) * (1 + 0.1 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 23.1));
      let near = Infinity;
      for (const id of ['pond', 'ridge', 'den'] as const) if (this.lit[id]) near = Math.min(near, this.anchors[id].position.distanceToSquared(this.tmp));
      this.glow.visible = near < 150 * 150;
    }
  }
}

/**
 * Build Pine Hollow's landmarks, register them (drawn, colliding, the decks as floors) and keep them updated. The hamlet's
 * buildings are not here: `new Cabins(sky, game.scene)` assembles them with the cabins from the bake (../generators/logCabin.ts).
 */
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry; cabins: Cabins | null; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void; }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky).build(h.cabins, h.registry); // the models register themselves (E315 M2)
  // what is left is light: the waystones' flames and anchors, the cave's shaft and drips
  h.registry.add({ id: 'pine-landmarks', name: 'Landmark lights', category: 'props', file: 'src/shards/pine-hollow/world/landmarks.ts', object: lm.group });
  // PH-B2: the crags' modules registered themselves (models, 90 hulls a task); the cave's shell + the ground over it
  const crags = lm.crags;
  if (crags) {
    await macrotask();
    h.registry.add({ id: 'pine-cave', name: 'Bear cave', category: 'nature', file: 'src/shards/pine-hollow/world/crags.ts', colliders: crags.caveColliders, surface: 'rock' });
  }
  h.onUpdate((_dt, t) => { lm.update(t); });
  return lm;
}

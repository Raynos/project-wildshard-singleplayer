import * as THREE from 'three';
import { graniteOutcrop, roundedBoulder, fieldstoneBaked as fieldstone, stoneStep, watchtower, cragLedge, leopardCave, kurganEntrance, kurganKerb, eagleRock } from '../models/campProps';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { app } from '@wildshard/engine/app/runtime';
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import { instancedQuad } from '@wildshard/sdk/looks/cardField';
import { hasLentLook, lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { Flutter } from './Flutter';
import { nomadCampSteps } from './NomadCamp';
import { preloadNalatiPlaces, bakedPlaceSliced, bakedPlaceSteps, bakedPlaceAnchors, placer } from './placeBake';
import { buildBridge } from './Bridge';
import { buildRoadFurniture } from './RoadFurniture';
import { summerCampSteps } from './SummerCamp';
import { buildBalbals, type Balbals } from './Balbals';
import { buildCairn } from './Cairn';
import { buildKokpar, buildFarHerds, buildSnowLotus, buildGlacier } from './Bowl';
import type { Box } from './solid';
import { NO_PLUMES, type Ground, type PlumeOptions, type Plumes, type PoiCtx, type PoiPiece, type KurganEntrance, type Ledge } from './types';

/**
 * Nalati POIs (B5) — builds every point of interest on the Nalati Grasslands and wires them into the player.
 *
 *   import { NalatiPOIs } from '../world/nalati';
 *   const pois = new NalatiPOIs(sky).build();          // uses the active chunk's heightAt
 *   await pois.place(game.scene, player, macrotask);  // meshes; each POI into the world registry, a task apart
 *   pois.addTo(game.scene, player);                    // the same at once (the dev pages)
 *   game.onUpdate((dt) => pois.update(dt));             // cloth + smoke
 *
 * E306 / E315 M3: a POI places models (src/shards/nalati-grasslands/models/: the kerb stones, the balbals, the bridge,
 * the watchtower, the kokpar's goals and riders …) through a NalatiSet (./painted.ts) and registers itself — one
 * `place` per model, its colliders and floor with it — and every named place is a set (./places.ts, M12: the Kurgan
 * field, the Kokpar field, the Spring and Summer camps …, registered once the whole shard is placed). A POI with no
 * thing in it (the glacier's snout, the terrain's) is world, and is not registered.
 *
 * NALATI-MERGE P1: every collider is in the world registry (src/engine/world/registry.ts) — boxes (with their material),
 * decks / floors as slabs, stairs as treads, rocks as hulls; a floor function is placement only. Nothing goes into
 * `its registry piece` / `player.platforms`; `colliders` stays as data (the weather's yurts, the dressing's keep-out).
 *
 * Handles for later rows: `pois.balbals` (B11 wakes them: `setAwake(i, true)` hides the statue), `HITCHING_RAIL` /
 * `HITCH_HORSE_SPOTS` (B8), `CRAG_CAVE` / `pois.crags.ledges` (B12 Aqbars), `GREAT_KURGAN` + `pois.kurgans.entrance`
 * (B13), `WIND_CAIRN` (B14). Layout: `./layout.ts`.
 *
 * Draw calls: one merged mesh per POI (all on the one painterly material) + the shared cloth mesh + the shared smoke
 * mesh + the balbal InstancedMeshes.
 */

/** the camp smoke's look (data/lookGraphs.json, compiled and lent by runtime/index.ts): each puff a camera-facing card
 *  whose whole life (rise, swell, lean downwind, fade) the graph computes from its plume, seed and the look clock */
const SMOKE_LOOK = 'nalati-camp-smoke';
const KURGAN_PLACERS = new Map([placer(kurganKerb), placer(fieldstone), placer(kurganEntrance)]);
const EAGLE_PLACERS = new Map([placer(eagleRock)]);
const CRAG_PLACERS = new Map([placer(cragLedge), placer(leopardCave)]);
interface Plume { x: number; y: number; z: number; puffs: number; rise: number; s0: number; s1: number; life: number }
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export class NalatiPOIs {
  group = new THREE.Group();
  pieces: PoiPiece[] = [];
  flutter = new Flutter();
  private readonly plumes: Plume[] = [];
  /** every chimney / cook-fire plume the places make, drawn as one instanced quad on the camp-smoke look */
  readonly smoke: Plumes = { emitter: (p: THREE.Vector3, o: PlumeOptions = {}) => {
    const [s0, s1] = o.size ?? [0.35, 2.8];
    this.plumes.push({ x: p.x, y: p.y, z: p.z, puffs: o.puffs ?? 12, rise: o.rise ?? 8, s0, s1, life: o.life ?? 9 });
  } };
  private smokeMesh: THREE.Mesh | null = null;
  /** every POI's boxes, as data (the weather's yurts, the dressing's keep-out) — the physics has them via the registry */
  colliders: Box[] = [];
  /** build ms per piece */
  timings: Record<string, number> = {};
  /** every balbal statue (on the kurgan crowns) — B11 wakes them */
  balbals: Balbals | null = null;
  /** the great kurgan's doorway (B13) */
  kurganEntrance: KurganEntrance | null = null;
  /** the snow leopard's ledges + cave porch (B12) */
  cragLedges: Ledge[] = [];
  cragCave: { x: number; y: number; z: number; facing: number } | null = null;
  /** the player's position (from addTo): the herds hide the horses near it */
  private viewer: THREE.Vector3 | null = null;
  /** where a rider ties a strip at the Wind Cairn (B14) */
  cairnTieSpot: THREE.Vector3 | null = null;

  /** what each POI placed (its models), by piece name — the named places' sets hold them (./places.ts) */
  readonly placed = new Map<string, readonly Placed[]>();

  /** the shard's model context (its sky: the painterly look) for the POIs' models */
  private readonly models: ModelContext;

  constructor(private sky: Sky, private ground: Ground = (x, z) => heightAt(x, z)) { this.group.name = 'nalati-pois'; this.models = modelContext(sky); }

  build(): this {
    const steps = this.steps();
    while (steps.next().done !== true) { /* every POI now */ }
    return this;
  }

  /** `build`, a task apart per POI (SF67: the camp, the kurgans and the crags were 0.4–1.2 s of one task at 4× CPU); the
   *  same pieces in the same order from the same rng streams */
  async buildSliced(yieldTask: () => Promise<void>): Promise<this> {
    await preloadNalatiPlaces(); // the camps' and the bridge's bake (./placeBake.ts)
    const steps = this.steps();
    while (steps.next().done !== true) await yieldTask();
    return this;
  }

  private *steps(): Generator<void, void> {
    const ctx: PoiCtx = { sky: this.sky, ground: this.ground, flutter: this.flutter, smoke: this.smoke };
    const add = (name: string, p: PoiPiece, ms: number) => {
      this.timings[name] = Math.round(ms);
      this.pieces.push(p);
      this.group.add(p.object);
      this.colliders.push(...p.colliders);
    };
    const run = (name: string, f: (c: PoiCtx) => PoiPiece) => { const t0 = diagnosticNow(); const p = f(ctx); add(name, p, diagnosticNow() - t0); };
    // a builder a part a task (SF67): its own build time, the yields left out
    const timed = function* timed<T>(parts: Generator<void, T>): Generator<void, { value: T; ms: number }> {
      let ms = 0;
      for (;;) {
        const t0 = diagnosticNow(), step = parts.next(); ms += diagnosticNow() - t0;
        if (step.done === true) return { value: step.value, ms };
        yield;
      }
    };
    { const camp = yield* timed(nomadCampSteps(ctx)); add('camp', camp.value, camp.ms); }
    yield;
    run('bridge', buildBridge);
    yield;
    run('roads', buildRoadFurniture);
    yield;
    { const summer = yield* timed(summerCampSteps(ctx)); add('summerCamp', summer.value, summer.ms); }
    yield;
    let crownSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
    { const k = yield* timed(bakedPlaceSteps('kurgans', ctx, KURGAN_PLACERS)), anchors = bakedPlaceAnchors('kurgans'); this.kurganEntrance = anchors.entrance ?? null; crownSpots = anchors.balbalSpots ?? []; add('kurgans', k.value, k.ms); }
    yield;
    // the balbals stand only on the kurgan crowns (layout v2: the balbal circle is cut)
    run('balbals', (c) => { const b = buildBalbals(c, crownSpots); this.balbals = b.balbals; return b.piece; });
    yield;
    { const rock = yield* timed(bakedPlaceSteps('eagleRock', ctx, EAGLE_PLACERS)); add('eagleRock', rock.value, rock.ms); }
    yield;
    run('cairn', (c) => { const k = buildCairn(c); this.cairnTieSpot = k.tieSpot; return k.piece; });
    yield;
    { const k = yield* timed(bakedPlaceSteps('crags', ctx, CRAG_PLACERS)), anchors = bakedPlaceAnchors('crags'); this.cragLedges = anchors.ledges ?? []; this.cragCave = anchors.cave ?? null; add('crags', k.value, k.ms); }
    yield;
    // layout v2 (N9): the watchtower, the kokpar field + its riders, the herds in the hundreds, snow lotus
    { const tower = yield* timed(bakedPlaceSteps('watchtower', ctx, new Map([placer(watchtower), placer(fieldstone), placer(stoneStep)]))); add('watchtower', tower.value, tower.ms); }
    yield;
    run('kokpar', buildKokpar);
    yield;
    run('farHerds', buildFarHerds);
    yield;
    run('snowLotus', buildSnowLotus);
    yield;
    run('glacier', buildGlacier);
    yield;
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    if (this.plumes.length > 0 && hasLentLook(SMOKE_LOOK)) { this.smokeMesh = this.buildSmoke(); this.group.add(this.smokeMesh); }
  }

  /** one card per puff: its plume, its seed (spread, spin, lobe, the phase of its life) and its plume's rise / size / life */
  private buildSmoke(): THREE.Mesh {
    const emitter: number[] = [], seed: number[] = [], cfg: number[] = [], box = new THREE.Box3();
    let s = 12345;
    const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (const e of this.plumes) {
      box.expandByPoint(new THREE.Vector3(e.x, e.y, e.z)).expandByPoint(new THREE.Vector3(e.x, e.y + e.rise + e.s1, e.z));
      for (let i = 0; i < e.puffs; i++) {
        seed.push(rnd(), rnd(), rnd(), i / e.puffs + rnd() * 0.3 / e.puffs);
        emitter.push(e.x, e.y, e.z); cfg.push(e.rise, e.s0, e.s1, e.life);
      }
    }
    const attribute = (a: number[], size: number): THREE.InstancedBufferAttribute => new THREE.InstancedBufferAttribute(new Float32Array(a), size);
    const geometry = instancedQuad(new THREE.PlaneGeometry(1, 1), { aEmitter: attribute(emitter, 3), aSeed: attribute(seed, 4), aCfg: attribute(cfg, 4) });
    const sphere = box.getBoundingSphere(new THREE.Sphere()); sphere.radius += 12; geometry.boundingSphere = sphere;
    const mesh = new THREE.Mesh(geometry, lentLook(SMOKE_LOOK));
    mesh.name = 'nalati-smoke'; mesh.renderOrder = 3;
    return mesh;
  }

  /** into the scene, and each POI into the world registry (drawn, collides, in Explore) — at once (the dev pages) */
  addTo(scene: THREE.Object3D, player: { position?: THREE.Vector3 }, registry: WorldRegistry = app.registry): void {
    scene.add(this.group);
    this.viewer = player.position ?? null;
    for (const _ of this.registrations(registry)) { /* every piece, no yielding */ }
  }

  /** the shard's boot: the same, a task apart per POI (the 30 ms per-task collider budget on the phone) */
  async place(scene: THREE.Object3D, player: { position?: THREE.Vector3 }, yieldTask: () => Promise<void>, registry: WorldRegistry = app.registry): Promise<void> {
    scene.add(this.group);
    this.viewer = player.position ?? null;
    for (const _ of this.registrations(registry)) await yieldTask();
  }

  private *registrations(registry: WorldRegistry): Generator<string> {
    for (const p of this.pieces) {
      if (p.register) { this.placed.set(p.name, p.register({ registry, ctx: this.models })); yield p.name; continue; }
      // world (the glacier's snout): nothing to register — a POI that collides places models
      if (p.colliders.some((b) => b.ghost !== true) || (p.descs?.length ?? 0) > 0) throw new Error(`NalatiPOIs: '${p.name}' collides but places no models`);
    }
    this.balbals?.register(registry, this.group.getObjectByName('nalati-balbals') ?? this.group);
  }

  update(dt: number): void {
    this.flutter.update(dt);
    if (this.smokeMesh !== null) {
      const { uPWind, uPShade } = painterlyUniforms, wind = uPWind.value, shade = uPShade.value, sun = this.sky.sunColor;
      setLentParam(SMOKE_LOOK, 'wind', [clamp(wind.x, -8, 8), clamp(wind.y, -8, 8), clamp(wind.z, -8, 8)]);
      setLentParam(SMOKE_LOOK, 'shade', [shade.r, shade.g, shade.b]);
      setLentParam(SMOKE_LOOK, 'sunColour', [sun.r, sun.g, sun.b]);
    }
    for (const p of this.pieces) p.update?.(dt, this.viewer);
  }

  /** triangles per piece (+ cloth / smoke) for the perf report */
  stats(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.pieces) out[p.name] = p.tris;
    out['cloth'] = (this.flutter.mesh?.geometry.index?.count ?? 0) / 3;
    out['smoke'] = this.smokeMesh === null ? 0 : this.plumes.reduce((n, e) => n + 2 * e.puffs, 0);
    return out;
  }
}

/** Static escarpment geometry shares the same baked-place owner as the landmarks. */
export async function buildBakedOutcrops(sky: Sky, yieldTask: () => Promise<void>): Promise<PoiPiece> {
  await preloadNalatiPlaces();
  return bakedPlaceSliced('outcrops', { sky, ground: () => 0, flutter: new Flutter(), smoke: NO_PLUMES }, new Map([placer(graniteOutcrop), placer(roundedBoulder)]), yieldTask, { every: 200, yieldTask });
}

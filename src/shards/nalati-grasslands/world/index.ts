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
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { modelContext, type ModelContext } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Flutter } from './Flutter';
import { Smoke } from './Smoke';
import { nomadCampSteps } from './NomadCamp';
import { buildBridge } from './Bridge';
import { buildRoadFurniture } from './RoadFurniture';
import { buildSummerCamp } from './SummerCamp';
import { buildKurganField, type KurganEntrance } from './KurganField';
import { buildBalbals, type Balbals } from './Balbals';
import { buildEagleRock } from './EagleRock';
import { buildCairn } from './Cairn';
import { buildCrags, type Ledge } from './Crags';
import { buildWatchtower, buildKokpar, buildFarHerds, buildSnowLotus, buildGlacier } from './Bowl';
import type { Box } from './solid';
import type { Ground, PoiCtx, PoiPiece } from './types';

export class NalatiPOIs {
  group = new THREE.Group();
  pieces: PoiPiece[] = [];
  flutter = new Flutter();
  smoke = new Smoke();
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
    const run = (name: string, f: (c: PoiCtx) => PoiPiece) => { const t0 = performance.now(); const p = f(ctx); add(name, p, performance.now() - t0); };
    {
      // the camp a part a task (SF67): its own build time, the yields left out
      const camp = nomadCampSteps(ctx);
      let ms = 0;
      for (;;) {
        const t0 = performance.now(), step = camp.next(); ms += performance.now() - t0;
        if (step.done === true) { add('camp', step.value, ms); break; }
        yield;
      }
    }
    yield;
    run('bridge', buildBridge);
    yield;
    run('roads', buildRoadFurniture);
    yield;
    run('summerCamp', buildSummerCamp);
    yield;
    let crownSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
    run('kurgans', (c) => { const k = buildKurganField(c); this.kurganEntrance = k.entrance; crownSpots = k.balbalSpots; return k.piece; });
    yield;
    // the balbals stand only on the kurgan crowns (layout v2: the balbal circle is cut)
    run('balbals', (c) => { const b = buildBalbals(c, crownSpots); this.balbals = b.balbals; return b.piece; });
    yield;
    run('eagleRock', buildEagleRock);
    yield;
    run('cairn', (c) => { const k = buildCairn(c); this.cairnTieSpot = k.tieSpot; return k.piece; });
    yield;
    run('crags', (c) => { const k = buildCrags(c); this.cragLedges = k.ledges; this.cragCave = k.cave; return k.piece; });
    yield;
    // layout v2 (N9): the watchtower, the kokpar field + its riders, the herds in the hundreds, snow lotus
    run('watchtower', buildWatchtower);
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
    if (this.smoke.count > 0) this.group.add(this.smoke.build(this.sky));
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
    this.smoke.update(dt);
    for (const p of this.pieces) p.update?.(dt, this.viewer);
  }

  /** triangles per piece (+ cloth / smoke) for the perf report */
  stats(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.pieces) out[p.name] = p.tris;
    out['cloth'] = (this.flutter.mesh?.geometry.index?.count ?? 0) / 3;
    out['smoke'] = (this.smoke.mesh?.geometry.index?.count ?? 0) / 3;
    return out;
  }
}

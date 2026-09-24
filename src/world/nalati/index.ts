/**
 * Nalati POIs (B5) — builds every point of interest on the Nalati Grasslands and wires them into the player.
 *
 *   import { NalatiPOIs } from '../world/nalati';
 *   const pois = new NalatiPOIs(sky).build();          // uses the active chunk's heightAt
 *   await pois.place(game.scene, player, macrotask);  // meshes; each POI into the world registry, a task apart
 *   pois.addTo(game.scene, player);                    // the same at once (the dev pages)
 *   game.onUpdate((dt) => pois.update(dt));             // cloth + smoke
 *
 * NALATI-MERGE P1: every POI is a piece in the world registry (src/world/registry.ts via ./solid.ts) — its boxes (with
 * their material), its decks / floors as slabs, its stairs as treads, its rocks as hulls; its floor function is
 * placement only. Nothing goes into `player.colliders` / `player.platforms`; `colliders` stays as data (the weather's
 * yurts, the dressing's keep-out).
 *
 * Handles for later rows: `pois.balbals` (B11 wakes them: `setAwake(i, true)` hides the statue), `HITCHING_RAIL` /
 * `HITCH_HORSE_SPOTS` (B8), `CRAG_CAVE` / `pois.crags.ledges` (B12 Aqbars), `GREAT_KURGAN` + `pois.kurgans.entrance`
 * (B13), `WIND_CAIRN` (B14). Layout: `./layout.ts`.
 *
 * Draw calls: one merged mesh per POI (all on the one painterly material) + the shared cloth mesh + the shared smoke
 * mesh + the balbal InstancedMeshes.
 */
import * as THREE from 'three';
import { heightAt } from '../Heightfield';
import { Flutter } from './Flutter';
import { Smoke } from './Smoke';
import { buildNomadCamp } from './NomadCamp';
import { buildBridge } from './Bridge';
import { buildRoadFurniture } from './RoadFurniture';
import { buildSummerCamp } from './SummerCamp';
import { buildKurganField, type KurganEntrance } from './KurganField';
import { buildBalbals, type Balbals } from './Balbals';
import { buildEagleRock } from './EagleRock';
import { buildCairn } from './Cairn';
import { buildCrags, type Ledge } from './Crags';
import { buildWatchtower, buildKokpar, buildFarHerds, buildSnowLotus, buildGlacier } from './Bowl';
import type { Sky } from '../Sky';
import { activeRegistry, type PieceCategory, type WorldRegistry } from '../registry';
import { boxDescs, registerSolid, type Box } from './solid';
import type { Ground, PoiCtx, PoiPiece } from './types';

/** each POI's entry in the registry (and Explore's catalog when `model`) */
const ENTRY: Record<string, { name: string; category: PieceCategory; file: string; model: boolean }> = {
  camp: { name: 'Spring camp', category: 'buildings', file: 'src/world/nalati/NomadCamp.ts', model: true },
  bridge: { name: 'Kunes bridge', category: 'buildings', file: 'src/world/nalati/Bridge.ts', model: true },
  roads: { name: 'Road fences', category: 'props', file: 'src/world/nalati/RoadFurniture.ts', model: false },
  summerCamp: { name: 'Summer camp', category: 'buildings', file: 'src/world/nalati/SummerCamp.ts', model: true },
  kurgans: { name: 'Kurgan field', category: 'buildings', file: 'src/world/nalati/KurganField.ts', model: true },
  balbals: { name: 'Balbals', category: 'buildings', file: 'src/world/nalati/Balbals.ts', model: true },
  eagleRock: { name: 'Eagle Rock', category: 'nature', file: 'src/world/nalati/EagleRock.ts', model: true },
  cairn: { name: 'Wind Cairn', category: 'buildings', file: 'src/world/nalati/Cairn.ts', model: true },
  crags: { name: 'Crag ledges + the leopard cave', category: 'nature', file: 'src/world/nalati/Crags.ts', model: true },
  watchtower: { name: 'Watchtower', category: 'buildings', file: 'src/world/nalati/Bowl.ts', model: true },
  kokpar: { name: 'Kokpar field', category: 'props', file: 'src/world/nalati/Bowl.ts', model: true },
  snowLotus: { name: 'Snow lotus', category: 'nature', file: 'src/world/nalati/Bowl.ts', model: true },
  glacier: { name: 'Glacier', category: 'nature', file: 'src/world/nalati/Bowl.ts', model: true },
};

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

  constructor(private sky: Sky, private ground: Ground = (x, z) => heightAt(x, z)) { this.group.name = 'nalati-pois'; }

  build(): this {
    const ctx: PoiCtx = { sky: this.sky, ground: this.ground, flutter: this.flutter, smoke: this.smoke };
    const run = (name: string, f: (c: PoiCtx) => PoiPiece) => {
      const t0 = performance.now();
      const p = f(ctx);
      this.timings[name] = Math.round(performance.now() - t0);
      this.pieces.push(p);
      this.group.add(p.object);
      this.colliders.push(...p.colliders);
    };
    run('camp', buildNomadCamp);
    run('bridge', buildBridge);
    run('roads', buildRoadFurniture);
    run('summerCamp', buildSummerCamp);
    let crownSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
    run('kurgans', (c) => { const k = buildKurganField(c); this.kurganEntrance = k.entrance; crownSpots = k.balbalSpots; return k.piece; });
    // the balbals stand only on the kurgan crowns (layout v2: the balbal circle is cut)
    run('balbals', (c) => { const b = buildBalbals(c, crownSpots); this.balbals = b.balbals; return b.piece; });
    run('eagleRock', buildEagleRock);
    run('cairn', (c) => { const k = buildCairn(c); this.cairnTieSpot = k.tieSpot; return k.piece; });
    run('crags', (c) => { const k = buildCrags(c); this.cragLedges = k.ledges; this.cragCave = k.cave; return k.piece; });
    // layout v2 (N9): the watchtower, the kokpar field + its riders, the herds in the hundreds, snow lotus
    run('watchtower', buildWatchtower);
    run('kokpar', buildKokpar);
    run('farHerds', buildFarHerds);
    run('snowLotus', buildSnowLotus);
    run('glacier', buildGlacier);
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    if (this.smoke.count > 0) this.group.add(this.smoke.build(this.sky));
    return this;
  }

  /** into the scene, and each POI into the world registry (drawn, collides, in Explore) — at once (the dev pages) */
  addTo(scene: THREE.Object3D, player: { position?: THREE.Vector3 }, registry: WorldRegistry = activeRegistry()): void {
    scene.add(this.group);
    this.viewer = player.position ?? null;
    for (const _ of this.registrations(registry)) { /* every piece, no yielding */ }
  }

  /** the shard's boot: the same, a task apart per POI (the 30 ms per-task collider budget on the phone) */
  async place(scene: THREE.Object3D, player: { position?: THREE.Vector3 }, yieldTask: () => Promise<void>, registry: WorldRegistry = activeRegistry()): Promise<void> {
    scene.add(this.group);
    this.viewer = player.position ?? null;
    for (const _ of this.registrations(registry)) await yieldTask();
  }

  private *registrations(registry: WorldRegistry): Generator<string> {
    for (const p of this.pieces) {
      const e = ENTRY[p.name];
      const colliders = [...boxDescs(p.colliders), ...(p.descs ?? [])];
      if (colliders.length === 0 && e?.model !== true) continue;
      registerSolid(registry, {
        id: `nalati-${p.name}`, name: e?.name ?? p.name, category: e?.category ?? 'props', file: e?.file ?? 'src/world/nalati/index.ts',
        object: p.object, colliders, surface: p.surface, ...(p.floor ? { floor: p.floor } : {}), ...(e?.model === true ? { model: {} } : {}),
      });
      yield p.name;
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

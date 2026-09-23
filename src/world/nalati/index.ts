/**
 * Nalati POIs (B5) — builds every point of interest on the Nalati Grasslands and wires them into the player.
 *
 *   import { NalatiPOIs } from '../world/nalati';
 *   const pois = new NalatiPOIs(sky).build();          // uses the active chunk's heightAt
 *   pois.addTo(game.scene, player);                     // meshes + colliders + platforms
 *   game.onUpdate((dt) => pois.update(dt));             // cloth + smoke
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
import { buildBalbals, balbalRingSpots, buildBalbalCircleDressing, type Balbals } from './Balbals';
import { buildEagleRock } from './EagleRock';
import { buildCairn } from './Cairn';
import { buildCrags, type Ledge } from './Crags';
import { BALBAL_CIRCLE } from './layout';
import type { Collider } from '../../player/Player';
import type { Sky } from '../Sky';
import type { Ground, Platform, PoiCtx, PoiPiece } from './types';

export * from './layout';

export interface PoiHost { colliders: Collider[]; platforms: Platform[] }

export class NalatiPOIs {
  group = new THREE.Group();
  pieces: PoiPiece[] = [];
  flutter = new Flutter();
  smoke = new Smoke();
  colliders: Collider[] = [];
  platforms: Platform[] = [];
  /** build ms per piece */
  timings: Record<string, number> = {};
  /** every balbal statue (the ring first, then the kurgan crowns) — B11 wakes them */
  balbals: Balbals | null = null;
  /** the great kurgan's doorway (B13) */
  kurganEntrance: KurganEntrance | null = null;
  /** the snow leopard's ledges + cave porch (B12) */
  cragLedges: Ledge[] = [];
  cragCave: { x: number; y: number; z: number; facing: number } | null = null;
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
      this.platforms.push(...p.platforms);
    };
    run('camp', buildNomadCamp);
    run('bridge', buildBridge);
    run('roads', buildRoadFurniture);
    run('summerCamp', buildSummerCamp);
    let crownSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
    run('kurgans', (c) => { const k = buildKurganField(c); this.kurganEntrance = k.entrance; crownSpots = k.balbalSpots; return k.piece; });
    run('balbalCircle', (c) => buildBalbalCircleDressing(c, BALBAL_CIRCLE.x, BALBAL_CIRCLE.z, BALBAL_CIRCLE.r));
    run('balbals', (c) => { const b = buildBalbals(c, [...balbalRingSpots(BALBAL_CIRCLE.x, BALBAL_CIRCLE.z, BALBAL_CIRCLE.r, BALBAL_CIRCLE.count), ...crownSpots]); this.balbals = b.balbals; return b.piece; });
    run('eagleRock', buildEagleRock);
    run('cairn', (c) => { const k = buildCairn(c); this.cairnTieSpot = k.tieSpot; return k.piece; });
    run('crags', (c) => { const k = buildCrags(c); this.cragLedges = k.ledges; this.cragCave = k.cave; return k.piece; });
    if (this.flutter.count > 0) this.group.add(this.flutter.build(this.sky));
    if (this.smoke.count > 0) this.group.add(this.smoke.build(this.sky));
    return this;
  }

  addTo(scene: THREE.Object3D, player: PoiHost): void {
    scene.add(this.group);
    player.colliders.push(...this.colliders);
    player.platforms.push(...this.platforms);
  }

  update(dt: number): void {
    this.flutter.update(dt);
    this.smoke.update(dt);
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

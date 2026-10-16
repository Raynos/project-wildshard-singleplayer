/**
 * Boat — where the sailboat you arrived in is moored, and how it rides (E306 / E315 M1: the boat itself is the model
 * src/shards/driftwood-isle/models/boat.ts; this is the world side). It places the dinghy beside the pier, runs its
 * mooring lines to the pier's bollards (world geometry between two placed models: a separate static mesh, so they don't
 * bob; baked offline with the pier's post choice, generators/mooringLines.ts, the fixed-model template `mooring-lines`) and bobs it on the swell in `update(dt)`. Its colliders ride it on a kinematic body (`follows: 'copy'`).
 *
 *   const boat = new Boat(sky, { x: -4.2, z: -244, heading: 0, waterY: 0.8, moored: true }).place(registry);
 *   scene.add(boat.group); if (boat.ropes) scene.add(boat.ropes);
 *   its registry piece.push(...boat.colliders);
 *   player.platforms.push((x, z) => boat.floorHeightAt(x, z));   // you can jump in
 *   game.onUpdate((dt) => boat.update(dt));
 *
 * `heading` is radians about +y (0 = bow toward −z, i.e. out to sea when moored at the south pier).
 */
import type * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { floorAtRects, type BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { waveHeight, seaDamp } from '@wildshard/engine/world/waves';
import { MooringLines, type MooringLines as MooringLinesSet } from '../runtime/props/mooringLines';
import { MOORING_LINES_GEOMETRY } from '../runtime/boot/fixedGeometry';
import { BEAM, BOAT_FLOOR, LENGTH, boat } from '../models/boat';

export interface BoatSpec {
  x: number; z: number;
  heading?: number;
  /** still-water level; the hull floats with its waterline here */
  waterY: number;
  /** draw the baked mooring lines to the south pier's posts (generators/mooringLines.ts: the world's boat at BOAT_MOOR) */
  moored?: boolean;
}

export class Boat {
  /** the placed boat (the hull with its gear, the sail): posed on the swell every frame */
  group!: THREE.Object3D;
  /** its `place` (the Pier landing set's member, M12) */
  placed: Placed | null = null;
  colliders: Collider[] = [];
  private t = 0;
  /** The gameplay installer projects an admitted fixed-step script; dev model pages retain their preview clock. */
  private floorY: number;

  constructor(private sky: Sky, private spec: BoatSpec) { this.floorY = spec.waterY + BOAT_FLOOR; }

  /** the game's: placed and registered (piece `boat`, the catalog's Sailboat; its colliders ride it) */
  place(registry: WorldRegistry): this {
    const heading = this.spec.heading ?? 0;
    const placed = place(boat, [{ x: this.spec.x, y: this.spec.waterY, z: this.spec.z, ...(heading === 0 ? {} : { yaw: heading }) }], { ctx: modelContext(this.sky), draw: 'single', registry,
      piece: { id: 'boat', follows: 'copy', floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    const mat = lowPolyLookMaterial(this.sky, 'still');

    // mooring lines: bow / stern cleats → the posts, in world space (a separate static mesh so they don't bob)
    if (this.spec.moored === true) {
      this.moorings = new MooringLines(MOORING_LINES_GEOMETRY.copy(), [-LENGTH / 2 + 0.3, LENGTH / 2 - 0.3], mat);
      this.ropes = this.moorings.mesh;
    }
    // gunwales + bow / stern as thin walls: they keep you in the boat once you're in, and keep a swimmer out
    // of the hull; from the pier deck (above yTop) you step over them and drop onto the floor
    {
      const h = this.spec.heading ?? 0, cs = Math.cos(h), sn = Math.sin(h), yTop = this.spec.waterY + 0.8, yBottom = this.spec.waterY - 1.2;
      const wall = (lx: number, lz: number, hw: number, hd: number) => this.colliders.push({ x: this.spec.x + lx * cs + lz * sn, z: this.spec.z - lx * sn + lz * cs, hw, hd, rot: -h, yTop, yBottom });
      wall(-BEAM / 2, 0, 0.08, LENGTH / 2); wall(BEAM / 2, 0, 0.08, LENGTH / 2); wall(0, -LENGTH / 2, BEAM / 2, 0.08); wall(0, LENGTH / 2, BEAM / 2, 0.08);
    }
    return this;
  }

  /** static mesh with the mooring lines (world space) — add it to the scene beside `group` */
  ropes: THREE.Mesh | null = null;

  /** the boat's floor if (x, z) is inside the hull */
  floorHeightAt(x: number, z: number): number | undefined {
    return floorAtRects([{ x: this.spec.x, z: this.spec.z, hw: BEAM / 2 * 0.8, hd: LENGTH / 2 - 0.3, y: this.floorY, rot: this.spec.heading ?? 0 }], x, z, 'first');
  }

  private moorings: MooringLinesSet | null = null;

  /**
   * Ride the shared swell (W3, src/engine/world/waves.ts — the same Gerstner sum the ocean shader draws): heave from the wave
   * height under the hull, pitch from 2 m fore / aft, roll from 2 m to either side; the mooring lines' cleat ends follow.
   */
  update(dt: number): void {
    this.t += dt;
    const g = this.group, x = this.spec.x, z = this.spec.z, w = this.spec.waterY;
    const damp = seaDamp(w - heightAt(x, z));
    const h = this.spec.heading ?? 0, fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);   // bow (local −z), starboard (+x)
    const hFore = waveHeight(x + fx * 2, z + fz * 2, undefined, damp), hAft = waveHeight(x - fx * 2, z - fz * 2, undefined, damp);
    const hStar = waveHeight(x + sx * 2, z + sz * 2, undefined, damp), hPort = waveHeight(x - sx * 2, z - sz * 2, undefined, damp);
    g.rotation.order = 'YXZ';
    g.position.y = w + waveHeight(x, z, undefined, damp);
    g.rotation.x = Math.atan2(hFore - hAft, 4);            // bow up when the crest is under it
    g.rotation.z = Math.atan2(hStar - hPort, 4);           // port side up when the crest is to port
    this.refreshPose();
  }

  refreshPose(): void {
    const g = this.group, w = this.spec.waterY;
    // the mooring lines: lift each rope's cleat end with the hull (heave + pitch at that cleat), the post end stays put
    this.moorings?.lift(g.position.y - w, Math.sin(g.rotation.x));
  }
}

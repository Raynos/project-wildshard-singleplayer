/**
 * Boat — where the sailboat you arrived in is moored, and how it rides (E306 / E315 M1: the boat itself is the model
 * src/shards/driftwood-isle/runtime/models/boat.ts; this is the world side). It places the dinghy beside the pier, runs its
 * mooring lines to the pier's bollards (world geometry between two placed models: a separate static mesh, so they don't
 * bob; baked offline with the pier's post choice, generators/mooringLines.ts, the fixed-model template `mooring-lines`) and bobs it on the swell in `update(dt)`. Its colliders ride it on a kinematic body (`follows: 'copy'`).
 *
 *   const boat = new Boat(sky).place(registry);
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
import { fixedDraw } from '../runtime/boot/blobAssets';
import { boat } from '../runtime/models/boat';
import { driftwoodRows } from '../runtime/boot/rows';

export class Boat {
  /** the placed boat (the hull with its gear, the sail): posed on the swell every frame */
  group!: THREE.Object3D;
  /** its `place` (the Pier landing set's member, M12) */
  placed: Placed | null = null;
  colliders: Collider[] = [];
  private t = 0;
  /** The gameplay installer projects an admitted fixed-step script; dev model pages retain their preview clock. */
  private readonly row = driftwoodRows('custom/fixedLayouts').boat;
  private readonly spec = this.row.spec;

  constructor(private sky: Sky) {}

  /** the game's: placed and registered (piece `boat`, the catalog's Sailboat; its colliders ride it) */
  place(registry: WorldRegistry): this {
    const placed = place(boat, [this.row.placement], { ctx: modelContext(this.sky), draw: 'single', registry,
      piece: { id: 'boat', follows: 'copy', floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    const mat = lowPolyLookMaterial(this.sky, 'still');

    this.moorings = new MooringLines(fixedDraw('mooringLines').copy(), this.row.cleats, mat);
    this.ropes = this.moorings.mesh;
    // JSON has no signed zero; retain the original heading-zero wall orientation.
    this.colliders = this.row.walls.map(row => ({ ...row, rot: -0 }));
    return this;
  }

  /** static mesh with the mooring lines (world space) — add it to the scene beside `group` */
  ropes: THREE.Mesh | null = null;

  /** the boat's floor if (x, z) is inside the hull */
  floorHeightAt(x: number, z: number): number | undefined {
    return floorAtRects(this.row.floors, x, z, 'first');
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
    const h = this.spec.heading, fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);   // bow (local −z), starboard (+x)
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

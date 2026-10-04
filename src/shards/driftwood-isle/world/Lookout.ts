/**
 * Lookout — where the headland's watchtower stands (E306 / E315 M1: the tower itself is the model
 * src/shards/driftwood-isle/models/lookout.ts; this is the world side). It places the tower on the headland summit: the
 * model is built for its site (where it stands, which side its stair descends toward, the terrain under its posts, the
 * sea cave its zipline post faces) and handed over in its own space, placed back by the site's origin; this side turns
 * its anchors, floor and legacy boxes into the world's.
 *
 *   const lookout = new Lookout(sky, { x, z, rot }).place(registry);   // the game (main.ts): piece `lookout`; rot: which side the stair descends toward
 *   const lookout = new Lookout(sky, { x, z, rot }).build();           // a dev page / the navmesh bake: not registered
 *   scene.add(lookout.group); its registry piece.push(...lookout.colliders);
 *   player.platforms.push((x, z) => lookout.floorHeightAt(x, z));
 *
 * `anchors` (world coords, y = platform unless noted, yaw = world facing, 0 = +Z): beacon, shard, zipTop, stairFoot
 * (see the model).
 */
import type * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Cove } from './Cove';
import { lookout, lookoutLayout, lookoutOrigin, type LookoutAnchor, type LookoutParams } from '../models/lookout';

export interface LookoutSpec { x: number; z: number; rot: number }

export class Lookout {
  /** what it draws: the kit mesh */
  group!: THREE.Object3D;
  /** the legacy boxes (posts, railings, the zipline post, the foot posts, the signpost): the melee sweep and the ocean's foam */
  colliders: Collider[] = [];
  anchors: Record<string, LookoutAnchor> = {};
  /** the platform's world y */
  platformY = 0;
  private readonly params: LookoutParams;
  /** the site's origin: own space + this = world */
  private readonly o: { x: number; y: number; z: number };
  private lay: ReturnType<typeof lookoutLayout> | null = null;
  private descs: ColliderDesc[] = [];
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;

  constructor(private sky: Sky, spec: LookoutSpec) {
    const cave = Cove.forIsland().cave;
    this.params = { site: { x: spec.x, z: spec.z, rot: spec.rot }, ground: heightAt, zipTo: { x: cave.x, z: cave.z } };
    this.o = lookoutOrigin(this.params);
  }

  /** the game's: placed and registered (piece `lookout`, the catalog's Lookout tower) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's / the navmesh bake's: the same tower, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const o = this.o;
    const placed = place(lookout, [{ x: o.x, y: o.y, z: o.z, params: this.params }], { ctx: modelContext(this.sky), draw: 'merged', registry,
      piece: { id: 'lookout', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    this.descs = [...placed.colliders];
    const lay = this.lay = lookoutLayout(this.params);
    this.platformY = lay.platformY + o.y;
    for (const c of lay.colliders) this.colliders.push({ ...c, x: c.x + o.x, z: c.z + o.z, yTop: c.yTop + o.y, yBottom: c.yBottom + o.y });
    for (const [k, a] of Object.entries(lay.anchors)) this.anchors[k] = { x: a.x + o.x, y: a.y + o.y, z: a.z + o.z, yaw: a.yaw };
    return this;
  }

  /**
   * PHYSICS P4: the tower's static collision in world space — its posts / railings (the legacy boxes), the platform slab
   * and the stair's treads above the headland (the model's own-space colliders, placed). src/engine/physics/pieces.ts turns it
   * into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** platform under (x, z), or the stair ramp, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const y = (this.lay ??= lookoutLayout(this.params)).floorHeightAt(x - this.o.x, z - this.o.z);
    return y === undefined ? undefined : y + this.o.y;
  }
}

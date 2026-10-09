/**
 * Hut — where the castaway's hut stands (E306 / E315 M1: the hut itself is the model
 * src/shards/driftwood-isle/models/hut.ts; this is the world side). It places the hut on the plateau: the model is
 * built for its site (where it stands, which way its door faces, the terrain under its stilts) and handed over in its
 * own space, placed back by the site's origin; this side turns its anchors, floor and legacy boxes into the world's.
 *
 *   const hut = new Hut(sky, { x, z, rot }).place(registry);   // the game (main.ts): piece `hut`; rot: which way the door faces (0 = −z)
 *   const hut = new Hut(sky, { x, z, rot }).build();           // a dev page / the Blender export: not registered
 *   scene.add(hut.group); its registry piece.push(...hut.colliders);
 *   player.platforms.push((x, z) => hut.floorHeightAt(x, z)); // porch + floor + steps are walkable
 *
 * `anchors` (world coords, y = floor, yaw = world facing, 0 = +Z): npc, hutChest, door, porch (see the model).
 */
import type * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { hut, hutLayout, hutOrigin, type HutAnchor, type HutParams } from '../models/hut';

export interface HutSpec { x: number; z: number; rot: number }

export class Hut {
  /** what it draws: the kit mesh and the flames (a group of the two) */
  group!: THREE.Object3D;
  /** the legacy boxes (walls, posts, railings, the crates and barrels): the melee sweep and the ocean's foam */
  colliders: Collider[] = [];
  anchors: Record<string, HutAnchor> = {};
  /** the floor's world y */
  floorY = 0;
  private readonly params: HutParams;
  /** the site's origin: own space + this = world */
  private readonly o: { x: number; y: number; z: number };
  private lay: ReturnType<typeof hutLayout> | null = null;
  private descs: ColliderDesc[] = [];
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;

  constructor(private sky: Sky, spec: HutSpec) {
    this.params = { site: { x: spec.x, z: spec.z, rot: spec.rot }, ground: heightAt };
    this.o = hutOrigin(this.params);
  }

  /** the game's: placed and registered (piece `hut`, the catalog's Hut) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's / the Blender export's: the same hut, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const o = this.o;
    const placed = place(hut, [{ x: o.x, y: o.y, z: o.z, params: this.params }], { ctx: modelContext(this.sky), draw: 'merged', registry,
      piece: { id: 'hut', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
    this.descs = [...placed.colliders];
    const lay = this.lay = hutLayout(this.params);
    this.floorY = lay.floorY + o.y;
    for (const c of lay.colliders) this.colliders.push({ ...c, x: c.x + o.x, z: c.z + o.z, yTop: c.yTop + o.y, yBottom: c.yBottom + o.y });
    for (const [k, a] of Object.entries(lay.anchors)) this.anchors[k] = { x: a.x + o.x, y: a.y + o.y, z: a.z + o.z, yaw: a.yaw };
    return this;
  }

  /**
   * PHYSICS P4: the hut's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry: the deck slab, the front steps' treads, the chart table (the model's
   * own-space colliders, placed). src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** deck / floor height under (x, z), the steps ramp down in front, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const y = (this.lay ??= hutLayout(this.params)).floorHeightAt(x - this.o.x, z - this.o.z);
    return y === undefined ? undefined : y + this.o.y;
  }
}

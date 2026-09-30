/**
 * Hut — where the castaway's hut stands (E306 / E315 M1: the hut itself is the model
 * src/chunks/driftwood-isle/models/hut.ts; this is the world side). It places the hut on the plateau, its stilts on
 * the terrain there (the model reads the site's ground), and turns the model's own-space anchors, floor and colliders
 * into the world's.
 *
 *   const hut = new Hut(sky, { x, z, rot }).place(registry);   // the game (main.ts): piece `hut`; rot: which way the door faces (0 = −z)
 *   const hut = new Hut(sky, { x, z, rot }).build();           // a dev page / the Blender export: not registered
 *   scene.add(hut.group); player.colliders.push(...hut.colliders);
 *   player.platforms.push((x, z) => hut.floorHeightAt(x, z)); // porch + floor + steps are walkable
 *
 * Frame: hut-local x right, z toward the back, the door at −z; world = origin + R_y(rot) · local. `anchors` (world
 * coords, y = floor, yaw = world facing, 0 = +Z): npc, hutChest, door, porch (see the model).
 */
import type * as THREE from 'three';
import { heightAt } from './Heightfield';
import type { Collider } from '../player/Player';
import type { ColliderDesc, WorldRegistry } from './registry';
import type { Sky } from './Sky';
import { hut, hutLayout, type HutAnchor, type HutParams } from '../chunks/driftwood-isle/models/hut';
import { modelContext } from '../models/model';
import { place } from '../models/place';

export type { HutAnchor } from '../chunks/driftwood-isle/models/hut';
export interface HutSpec { x: number; z: number; rot: number }

export class Hut {
  /** what it draws: the kit mesh and the flames (a group of the two) */
  group!: THREE.Object3D;
  /** the legacy boxes (walls, posts, railings, the crates and barrels): the melee sweep and the ocean's foam */
  colliders: Collider[] = [];
  anchors: Record<string, HutAnchor> = {};
  /** the floor's world y */
  floorY = 0;
  private cos = 1; private sin = 0;
  /** the ground at the hut's centre: its own origin's world y */
  private readonly y0: number;
  private params: HutParams;
  private lay: ReturnType<typeof hutLayout> | null = null;
  private descs: ColliderDesc[] = [];

  constructor(private sky: Sky, private spec: HutSpec) {
    this.cos = Math.cos(spec.rot); this.sin = Math.sin(spec.rot);
    this.y0 = heightAt(spec.x, spec.z);
    // the site: the terrain under an own-space point, own y
    this.params = { ground: (lx, lz) => heightAt(...this.toWorld(lx, lz)) - this.y0 };
  }

  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }

  /** the game's: placed and registered (piece `hut`, the catalog's Hut) */
  place(registry: WorldRegistry): this { return this.draw(registry); }

  /** a dev page's / the Blender export's: the same hut, not registered */
  build(): this { return this.draw(null); }

  private draw(registry: WorldRegistry | null): this {
    const { x, z, rot } = this.spec;
    const placed = place(hut, [{ x, y: this.y0, z, ...(rot === 0 ? {} : { yaw: rot }), params: this.params }], { ctx: modelContext(this.sky), draw: 'merged', registry,
      piece: { id: 'hut', floor: (px, pz) => this.floorHeightAt(px, pz), solidFloor: true } });
    this.group = placed.object;
    this.descs = [...placed.colliders];
    const lay = this.lay = hutLayout(this.params);
    this.floorY = this.y0 + lay.floorY;
    for (const c of lay.colliders) {
      const [wx, wz] = this.toWorld(c.x, c.z);
      this.colliders.push({ x: wx, z: wz, hw: c.hw, hd: c.hd, rot: c.rot - rot, yBottom: c.yBottom + this.y0, yTop: c.yTop + this.y0 });
    }
    for (const [k, a] of Object.entries(lay.anchors)) { const [wx, wz] = this.toWorld(a.x, a.z); this.anchors[k] = { x: wx, y: a.y + this.y0, z: wz, yaw: rot + a.yaw }; }
    return this;
  }

  /**
   * PHYSICS P4: the hut's static collision in world space — its walls / posts (the legacy boxes) and every floor
   * `floorHeightAt` describes, as real geometry: the deck slab, the front steps' treads, the chart table (the model's
   * own-space colliders, placed). src/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** deck / floor height under (x, z), the steps ramp down in front, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * this.sin + dz * this.cos, lx = dx * this.cos - dz * this.sin;
    const y = (this.lay ??= hutLayout(this.params)).floorHeightAt(lx, lz);
    return y === undefined ? undefined : y + this.y0;
  }
}

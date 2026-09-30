/**
 * Pier — where Driftwood Isle's wooden piers stand (E306 / E315 M1: the pier itself is the model
 * src/chunks/driftwood-isle/models/pier.ts; this is the world side): the south entry pier with its landing on the
 * crescent beach, and the three jetties at the other entry roads — four placements of one model, each its own merged
 * mesh (one draw), each its own registry piece (`pier`, `jetty-0..2`).
 *
 *   const pier = new Pier(sky, { x: 0, z: -250, length: 60, width: 4, deckY: 1.8, landing: true }).place(registry, 'pier');
 *   const pier = new Pier(sky, { … }).build();              // a dev page / the Blender export: not registered
 *   scene.add(pier.group); player.colliders.push(...pier.colliders);
 *   player.platforms.push((x, z) => pier.floorHeightAt(x, z)); // the deck is walkable
 *
 * The pier runs from (x, z) along its heading (`rot`, 0 = +z, north) for `length` metres. The landing is measured here:
 * it marches on over the shallows to the first dry sand and steps down onto it (the model is handed the sand's height).
 * `floorHeightAt` returns the deck's top for any (x, z) over the deck, else undefined — same contract as `Cabins`.
 * `bollards` are the two tall rope-wrapped posts at the sea end (the sailboat moors to them); `posts` every piling.
 * `mooringsFor(x, z)` picks the bollard and the piling nearest a boat moored alongside at (x, z) — pass it as
 * `Boat.moorTo`.
 */
import type * as THREE from 'three';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import { heightAt, waterLevel } from './Heightfield';
import type { ColliderDesc, WorldRegistry } from './registry';
import { PENNANT_WIND, pier, pierBoxes, pierDeckAt, pierPosts, type PierParams } from '../chunks/driftwood-isle/models/pier';
import { modelContext, type Placement } from '../models/model';
import { place } from '../models/place';

export interface PierSpec {
  x: number; z: number;
  /** metres along +z from (x, z) */
  length: number;
  /** deck width, metres */
  width: number;
  /** world y of the deck top */
  deckY: number;
  /** direction along the pier in radians about +y (0 = +z); the sea end is at (x, z) */
  rot?: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  pileDepth?: number;
  /** run on past `length` over the shallows to the first dry sand, and step down onto it (the south pier, E43) */
  landing?: boolean;
}

export class Pier {
  /** what it draws: the deck's one mesh (+ the pennant's, on the south pier) */
  group!: THREE.Object3D;
  /** the legacy boxes of the posts and bollards: the ocean's foam rings and the melee sweep */
  colliders: Collider[] = [];
  /** the two tall mooring posts at the sea end, world xz */
  bollards: { x: number; z: number }[] = [];
  /** every piling along the deck, world xz (mooring lines, gulls…) */
  posts: { x: number; z: number }[] = [];
  readonly deckY: number;
  private cos: number; private sin: number;
  /** the model's params (its landing measured on the sand) */
  private params!: PierParams;
  private descs: ColliderDesc[] = [];

  constructor(private sky: Sky, private spec: PierSpec) {
    this.deckY = spec.deckY;
    const r = spec.rot ?? 0;
    this.cos = Math.cos(r); this.sin = Math.sin(r);
  }

  /** local (along, across) → world */
  private toWorld(along: number, across: number): [number, number] {
    return [this.spec.x + across * this.cos + along * this.sin, this.spec.z - across * this.sin + along * this.cos];
  }

  /** the game's: placed and registered as piece `id` (the catalog's Pier: the four are one model) */
  place(registry: WorldRegistry, id: string): this { return this.draw(registry, id); }

  /** a dev page's / the Blender export's: the same pier, not registered */
  build(): this { return this.draw(null, 'pier'); }

  private draw(registry: WorldRegistry | null, id: string): this {
    const { width, deckY } = this.spec, yaw = this.spec.rot ?? 0;
    let length = this.spec.length, landing: PierParams['landing'] = null;
    if (this.spec.landing) {
      // march on over the shallows to the first dry sand, then 5 m more: the last 6 m step down onto the beach
      const wl = waterLevel();
      let a = length;
      while (a < length + 80) { const [x, z] = this.toWorld(a, 0); if (heightAt(x, z) > wl + 0.1) break; a += 0.5; }
      const end = a + 4, [ex, ez] = this.toWorld(end, 0);
      const ground = (s: number): number => heightAt(...this.toWorld(end - 0.4, s * (width / 2 + 0.3))) - deckY;
      landing = { rampFrom: end - 5.5, landY: heightAt(ex, ez) + 0.12 - deckY, postGround: [ground(-1), ground(1)] };
      length = end;
    }
    // the pennant streams downwind: the world's wind turned into the pier's frame
    const [wx, wz] = PENNANT_WIND, c = Math.cos(yaw), s = Math.sin(yaw);
    const pennantDir: [number, number] = yaw === 0 ? [wx, wz] : [wx * c - wz * s, wx * s + wz * c];
    this.params = { length, width, pileDepth: this.spec.pileDepth ?? 8, landing, pennantDir };
    const pl: Placement<PierParams> = { x: this.spec.x, y: deckY, z: this.spec.z, ...(yaw === 0 ? {} : { yaw }), params: this.params };
    const placed = place(pier, [pl], { ctx: modelContext(this.sky), draw: 'merged', registry,
      piece: { id, floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    this.group = placed.object;
    this.descs = [...placed.colliders];
    const { posts, bollards } = pierPosts(this.params);
    for (const [along, across] of posts) { const [x, z] = this.toWorld(along, across); this.posts.push({ x, z }); }
    for (const [along, across] of bollards) { const [x, z] = this.toWorld(along, across); this.bollards.push({ x, z }); }
    for (const b of pierBoxes(this.params)) {
      const [x, z] = this.toWorld(b.z, b.x);
      this.colliders.push({ x, z, hw: b.hw, hd: b.hd, rot: -yaw, yTop: b.yTop + deckY, yBottom: b.yBottom + deckY });
    }
    return this;
  }

  /** [bollard, piling] on the side of (x, z) for a boat moored alongside — bow line and stern line */
  mooringsFor(x: number, z: number, sternZ = z + 3): { x: number; z: number }[] {
    const side = (x - this.spec.x) * this.cos - (z - this.spec.z) * this.sin < 0 ? -1 : 1;
    const onSide = (p: { x: number; z: number }): boolean => Math.sign((p.x - this.spec.x) * this.cos - (p.z - this.spec.z) * this.sin) === side;
    const bollard = this.bollards.find(onSide) ?? this.bollards[0];
    let post = this.posts[0], best = Infinity;
    for (const p of this.posts) { if (!onSide(p)) continue; const d = Math.hypot(p.x - x, p.z - sternZ); if (d < best) { best = d; post = p; } }
    if (!bollard || !post) throw new Error('Pier.mooringsFor(): build() first');
    return [bollard, post];
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its posts and bollards and every floor
   * `floorHeightAt` describes, as real geometry (the model's own-space colliders, placed: pierColliders in the model).
   * src/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** world y of the deck under (x, z), or undefined off the pier */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const along = dx * this.sin + dz * this.cos, across = dx * this.cos - dz * this.sin;
    if (along < -0.2 || along > this.params.length + 0.2 || Math.abs(across) > this.spec.width / 2 + 0.25) return undefined;
    return this.deckY + pierDeckAt(this.params, along);
  }
}

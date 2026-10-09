/**
 * Pier — where Driftwood Isle's wooden piers stand (E306 / E315 M1: the pier itself is the model
 * src/shards/driftwood-isle/models/pier.ts; this is the world side): the south entry pier with its landing on the
 * crescent beach, and the three jetties at the other entry roads — four placements of one model, each its own merged
 * mesh (one draw), each its own registry piece (`pier`, `jetty-0..2`).
 *
 *   const pier = new Pier(sky, { x: 0, z: -250, length: 60, width: 4, deckY: 1.8, landing: true }).place(registry, 'pier');
 *   const pier = new Pier(sky, { … }).build();              // a dev page / the Blender export: not registered
 *   scene.add(pier.group); its registry piece.push(...pier.colliders);
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
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { waterLevel } from '@wildshard/engine/world/Heightfield';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { PENNANT_WIND, pier, pierBoxes, pierDeckAt, pierHalfWidthAt, pierPosts, type PierParams } from '../models/pier';

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
  /** Step down onto sand: true extends through the shallows; 'end' keeps the authored extent. */
  landing?: boolean | 'end';
  /** with a landing: the pennant flies from the piling this many metres from the sea end (E308), not the sea-end bollard */
  pennantAt?: number;
  /** SF46 (G164): the deck ramps up over this many metres from road height (y = 0) at its sea end, where it meets the
   *  platform's entry socket (the lowered world's entries) */
  seaRamp?: number;
  /** SF72 (pick (c)): the sea ramp flares to this full width at its sea end (the entry socket's 8 m), narrowing to the
   *  deck's `width` at its top; absent: a straight ramp the deck's width */
  seaFlare?: number;
}

export class Pier {
  /** what it draws: the deck's one mesh (+ the pennant's, on the south pier) */
  group!: THREE.Object3D;
  /** its `place` (the Pier landing set's member, M12) */
  placed: Placed | null = null;
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
    if (this.spec.landing === true || this.spec.landing === 'end') {
      // march on over the shallows to the first dry sand, then 5 m more: the last 6 m step down onto the beach
      const wl = waterLevel();
      let a = length;
      while (this.spec.landing !== 'end' && a < length + 80) { const [x, z] = this.toWorld(a, 0); if (heightAt(x, z) > wl + 0.1) break; a += 0.5; }
      const end = this.spec.landing === 'end' ? length : a + 4, [ex, ez] = this.toWorld(end, 0);
      const ground = (s: number): number => heightAt(...this.toWorld(end - 0.4, s * (width / 2 + 0.3))) - deckY;
      landing = { rampFrom: end - 5.5, landY: heightAt(ex, ez) + 0.12 - deckY, postGround: [ground(-1), ground(1)] };
      length = end;
    }
    // the pennant streams downwind: the world's wind turned into the pier's frame
    const [wx, wz] = PENNANT_WIND, c = Math.cos(yaw), s = Math.sin(yaw);
    const pennantDir: [number, number] = yaw === 0 ? [wx, wz] : [wx * c - wz * s, wx * s + wz * c];
    const flare = this.spec.seaFlare === undefined ? {} : { flare: this.spec.seaFlare };
    const seaRamp = this.spec.seaRamp === undefined ? {} : { seaRamp: { run: this.spec.seaRamp, landY: -deckY, ...flare } };
    this.params = { length, width, pileDepth: this.spec.pileDepth ?? 8, landing, pennantDir, ...(this.spec.pennantAt === undefined ? {} : { pennantAt: this.spec.pennantAt }), ...seaRamp };
    const pl: Placement<PierParams> = { x: this.spec.x, y: deckY, z: this.spec.z, ...(yaw === 0 ? {} : { yaw }), params: this.params };
    const placed = place(pier, [pl], { ctx: modelContext(this.sky), draw: 'merged', registry,
      piece: { id, floor: (x, z) => this.floorHeightAt(x, z), solidFloor: true } });
    this.group = placed.object;
    this.placed = placed;
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

  /** [bow post, stern piling] on the side of (x, z) for a boat moored alongside — bow line and stern line. The bow line
   *  goes to the sea-end bollard when the bow is by it, else (E308: the boat half way down the pier) to the piling nearest
   *  the bow */
  mooringsFor(x: number, z: number, sternZ = z + 3, bowZ = z - 3): { x: number; z: number }[] {
    const side = (x - this.spec.x) * this.cos - (z - this.spec.z) * this.sin < 0 ? -1 : 1;
    const onSide = (p: { x: number; z: number }): boolean => Math.sign((p.x - this.spec.x) * this.cos - (p.z - this.spec.z) * this.sin) === side;
    const nearest = (at: number, of: readonly { x: number; z: number }[]): { x: number; z: number } | undefined => {
      let pick: { x: number; z: number } | undefined, best = Infinity;
      for (const p of of) { if (!onSide(p)) continue; const d = Math.hypot(p.x - x, p.z - at); if (d < best) { best = d; pick = p; } }
      return pick;
    };
    const bollard = this.bollards.find(onSide) ?? this.bollards[0];
    const post = nearest(sternZ, this.posts);
    const bow = bollard !== undefined && Math.hypot(bollard.x - x, bollard.z - bowZ) < 6 ? bollard : nearest(bowZ, this.posts) ?? bollard;
    if (!bow || !post) throw new Error('Pier.mooringsFor(): build() first');
    return [bow, post];
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — its posts and bollards and every floor
   * `floorHeightAt` describes, as real geometry (the model's own-space colliders, placed: pierColliders in the model).
   * src/engine/physics/pieces.ts turns it into Rapier colliders.
   */
  colliderDescs(): ColliderDesc[] { return this.descs.slice(); }

  /** world y of the deck under (x, z), or undefined off the pier */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const along = dx * this.sin + dz * this.cos, across = dx * this.cos - dz * this.sin;
    if (along < -0.2 || along > this.params.length + 0.2 || Math.abs(across) > pierHalfWidthAt(this.params, along) + 0.25) return undefined;
    return this.deckY + pierDeckAt(this.params, along);
  }
}

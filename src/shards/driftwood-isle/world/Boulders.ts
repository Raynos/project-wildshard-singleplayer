/**
 * Boulders — where Driftwood Isle's shore boulders stand (E306 M0b: the rock itself is the model
 * src/shards/driftwood-isle/models/shoreBoulder.ts; this is the world side). `scatterShore()` is the beach rule:
 * rocks along the water line and a few out in the surf, away from the pier corridor. `placements()` turns the specs
 * into the model's placements (yawed, leaned with the slope, half sunk), and `place()` draws them merged into one
 * mesh through src/engine/models/place.ts — one registry piece, `rocks`, with each big rock's hull.
 *
 *   const rocks = new Boulders(sky).place(Boulders.scatterShore(seed), registry);   // the game (main.ts)
 *   const rocks = new Boulders(sky).build(Boulders.scatterShore(seed));             // a dev page: no registry
 *   scene.add(rocks.mesh); its registry piece.push(...rocks.colliders);
 */
import type * as THREE from 'three';
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { place, placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { normalAt, waterLevel, inChunk } from '@wildshard/engine/world/Heightfield';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { WRECK } from '../manifest';
import { shoreBoulder, type ShoreBoulderParams } from '../models/shoreBoulder';

export interface BoulderSpec { x: number; z: number; r: number; rot?: number; squash?: number }

export class Boulders {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every rock, merged into one mesh */
  mesh!: THREE.Object3D;
  /** the legacy boxes (r > 0.9 m): the melee sweep and the ocean's foam rings */
  colliders: Collider[] = [];
  count = 0;
  /** PHYSICS P4: a convex hull of each colliding rock's drawn vertices (see colliderDescs) */
  private hulls: ColliderDesc[] = [];

  constructor(private sky: Sky) {}

  /**
   * Beach rule: walk the shoreline (where the ground crosses the water line) and drop rocks in
   * clusters — most on the sand just above the line, some in the shallows — skipping the
   * entry-road corridors so the piers stay clear.
   */
  static scatterShore(seed: number, count = 110): BoulderSpec[] {
    const rng = new Rng(seed ^ 0x0b0c);
    const wl = waterLevel();
    const out: BoulderSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20), z = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20);
      if (!inChunk(x, z, 15)) continue;
      const h = heightAt(x, z) - wl;
      if (h < -2.2 || h > 2.4) continue;                                      // the surf / the beach band only
      if (Math.abs(x) < ROAD_WIDTH / 2 + 8 && Math.abs(z) > 150) continue;    // N/S pier corridors
      if (Math.abs(z) < ROAD_WIDTH / 2 + 8 && Math.abs(x) > 150) continue;    // E/W
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.r + 2.5) * 1.6)) continue;
      const big = rng.next() < 0.3;
      const r = big ? rng.range(2.6, 4.6) : rng.range(0.9, 2.0);
      out.push({ x, z, r, rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.85) });
      // a cluster: one or two smaller ones beside a big one
      if (big) for (let k = 0; k < rng.int(1, 3); k++) {
        const a = rng.range(0, Math.PI * 2), d = r + rng.range(0.8, 2.2);
        out.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: rng.range(0.5, 1.2), rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.8) });
      }
    }
    // the wreck brings its own reef rocks and needs its beach side (the breach, the ramp) clear
    return out.filter((b) => Math.hypot(b.x - WRECK.x, b.z - WRECK.z) > 16 + b.r);
  }

  /** each spec as a placement of the shore boulder: yawed, leaned with the slope, sunk to a third of its height */
  static placements(specs: readonly BoulderSpec[]): Placement<ShoreBoulderParams>[] {
    return specs.map((b) => {
      const y = heightAt(b.x, b.z);
      const [nx, , nz] = normalAt(b.x, b.z, 1.5);
      return { x: b.x, y: y + b.r * (b.squash ?? 0.7) * 0.35, z: b.z, yaw: b.rot ?? 0, leanX: nz * 0.6, leanZ: -nx * 0.6, params: { r: b.r, squash: b.squash ?? 0.7 } };
    });
  }

  /** the game's: placed and registered (piece `rocks`, the catalog's Shore boulder) */
  place(specs: BoulderSpec[], registry: WorldRegistry): this { return this.draw(specs, registry); }

  /** a dev page's: the same rocks, not registered */
  build(specs: BoulderSpec[]): this { return this.draw(specs, null); }

  /** `place`, its merged copies built a slice at a time (SF67: `due` is the load's task budget); the same rocks */
  async placeSliced(specs: BoulderSpec[], registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    return this.take(specs, await placeSliced(shoreBoulder, Boulders.placements(specs), { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true } }, due));
  }

  private draw(specs: BoulderSpec[], registry: WorldRegistry | null): this {
    return this.take(specs, place(shoreBoulder, Boulders.placements(specs), { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true } }));
  }

  private take(specs: BoulderSpec[], placed: Placed): this {
    this.mesh = placed.object;
    this.placed = placed;
    this.hulls = [...placed.colliders];
    this.count = placed.copies;
    // the legacy box of every rock that collides (r > 0.9 m), on the ground under it
    for (const b of specs) if (b.r > 0.9) this.colliders.push({ x: b.x, z: b.z, hw: b.r * 0.8, hd: b.r * 0.8, rot: b.rot ?? 0, yTop: heightAt(b.x, b.z) + b.r * 1.2, yBottom: heightAt(b.x, b.z) - 2 });
    return this;
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — each rock that has a legacy box (r > 0.9 m; the
   * small ones stay walk-through, as today) as a convex hull of the vertices it draws. The boxes stay in `colliders`
   * for the melee sweep and foam. src/engine/physics/pieces.ts turns it into Rapier colliders. Rocks have no floors.
   */
  colliderDescs(): ColliderDesc[] { return this.hulls.slice(); }
}

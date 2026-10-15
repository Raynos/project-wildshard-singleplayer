/**
 * Boulders — where Driftwood Isle's shore boulders stand (E306 M0b: the rock itself is the model
 * src/shards/driftwood-isle/models/shoreBoulder.ts; this is the world side). `scatterShore()` reads the authored beach rule:
 * rocks along the water line and a few out in the surf, away from the pier corridor. `placements()` turns the specs
 * into the model's placements (yawed, leaned with the slope, half sunk), and `placeSliced()` draws them merged into one
 * mesh through src/engine/models/place.ts — one registry piece, `rocks`, with each big rock's hull.
 *
 *   const rocks = await new Boulders(sky).placeSliced(Boulders.scatterShore(seed), registry, due);
 *   scene.add(rocks.mesh);
 */
import type * as THREE from 'three';
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { normalAt } from '@wildshard/engine/world/Heightfield';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import SHORE from '../data/shoreBoulders.generated.json' with { type: 'json' };
import { shoreBoulder, type ShoreBoulderParams } from '../models/shoreBoulder';

export interface BoulderSpec { x: number; z: number; r: number; rot?: number; squash?: number }

export class Boulders {
  /** its placements (the named places' sets read them, src/shards/driftwood-isle/world/places.ts) */
  placed: Placed | null = null;
  /** every rock, merged into one mesh */
  mesh!: THREE.Object3D;
  /** the legacy boxes (r > 0.9 m): the melee sweep and the ocean's foam rings */
  colliders: Collider[] = [];

  constructor(private sky: Sky) {}

  /**
   * Beach rule: walk the shoreline (where the ground crosses the water line) and drop rocks in
   * clusters — most on the sand just above the line, some in the shallows — skipping the
   * entry-road corridors so the piers stay clear.
   */
  static scatterShore(seed: number, count = 110): BoulderSpec[] {
    if (seed !== SHORE.seed || count !== SHORE.count) throw new Error('Shore-boulder scatter changed; regenerate the authored shoreline facts');
    return structuredClone(SHORE.specs);
  }

  /** each spec as a placement of the shore boulder: yawed, leaned with the slope, sunk to a third of its height */
  static placements(specs: readonly BoulderSpec[]): Placement<ShoreBoulderParams>[] {
    return specs.map((b) => {
      const y = heightAt(b.x, b.z);
      const [nx, , nz] = normalAt(b.x, b.z, 1.5);
      return { x: b.x, y: y + b.r * (b.squash ?? 0.7) * 0.35, z: b.z, yaw: b.rot ?? 0, leanX: nz * 0.6, leanZ: -nx * 0.6, params: { r: b.r, squash: b.squash ?? 0.7 } };
    });
  }

  /** Merged copies built a slice at a time (SF67: `due` is the load's task budget); the same rocks */
  async placeSliced(specs: BoulderSpec[], registry: WorldRegistry, due: () => Promise<void> | null): Promise<this> {
    return this.take(specs, await placeSliced(shoreBoulder, Boulders.placements(specs), { ctx: modelContext(this.sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true } }, due));
  }

  private take(specs: BoulderSpec[], placed: Placed): this {
    this.mesh = placed.object;
    this.placed = placed;
    // the legacy box of every rock that collides (r > 0.9 m), on the ground under it
    for (const b of specs) if (b.r > 0.9) this.colliders.push({ x: b.x, z: b.z, hw: b.r * 0.8, hd: b.r * 0.8, rot: b.rot ?? 0, yTop: heightAt(b.x, b.z) + b.r * 1.2, yBottom: heightAt(b.x, b.z) - 2 });
    return this;
  }

}

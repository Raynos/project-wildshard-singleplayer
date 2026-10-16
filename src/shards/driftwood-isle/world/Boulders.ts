/**
 * Boulders — where Driftwood Isle's shore boulders stand (E306 M0b: the rock itself is the model
 * src/shards/driftwood-isle/runtime/models/shoreBoulder.ts; this is the world side). `scatterShoreBoulders()` reads the authored beach rule:
 * rocks along the water line and a few out in the surf, away from the pier corridor. `shoreBoulderPlacements()` turns the specs
 * into the model's placements (yawed, leaned with the slope, half sunk), and `placeShoreBoulders()` draws them merged into one
 * mesh through src/engine/models/place.ts — one registry piece, `rocks`, with each big rock's hull.
 *
 *   const rocks = await placeShoreBoulders(sky, scatterShoreBoulders(seed), registry, due);
 *   scene.add(rocks.placed.object);
 */
import { modelContext, type Placement } from '@wildshard/engine/models/model';
import { placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { normalAt } from '@wildshard/engine/world/Heightfield';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import SHORE from '../data/shoreBoulders.generated.json' with { type: 'json' };
import { shoreBoulder, type ShoreBoulderParams } from '../runtime/models/shoreBoulder';

export interface BoulderSpec { x: number; z: number; r: number; rot?: number; squash?: number }

/**
 * Beach rule: walk the shoreline (where the ground crosses the water line) and drop rocks in
 * clusters — most on the sand just above the line, some in the shallows — skipping the
 * entry-road corridors so the piers stay clear.
 */
export function scatterShoreBoulders(seed: number, count = 110): BoulderSpec[] {
  if (seed !== SHORE.seed || count !== SHORE.count) throw new Error('Shore-boulder scatter changed; regenerate the authored shoreline facts');
  return structuredClone(SHORE.specs);
}

/** each spec as a placement of the shore boulder: yawed, leaned with the slope, sunk to a third of its height */
export function shoreBoulderPlacements(specs: readonly BoulderSpec[]): Placement<ShoreBoulderParams>[] {
  return specs.map((b) => {
    const y = heightAt(b.x, b.z);
    const [nx, , nz] = normalAt(b.x, b.z, 1.5);
    return { x: b.x, y: y + b.r * (b.squash ?? 0.7) * 0.35, z: b.z, yaw: b.rot ?? 0, leanX: nz * 0.6, leanZ: -nx * 0.6, params: { r: b.r, squash: b.squash ?? 0.7 } };
  });
}

/** Merged copies built on the existing slice clock; placement owns the drawn mesh. */
export async function placeShoreBoulders(sky: Sky, specs: BoulderSpec[], registry: WorldRegistry, due: () => Promise<void> | null): Promise<{ placed: Placed; colliders: Collider[] }> {
  const placed = await placeSliced(shoreBoulder, shoreBoulderPlacements(specs), { ctx: modelContext(sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true } }, due);
  const colliders: Collider[] = [];
  // The legacy box of every colliding rock stays on the ground under its placement.
  for (const b of specs) if (b.r > 0.9) colliders.push({ x: b.x, z: b.z, hw: b.r * 0.8, hd: b.r * 0.8, rot: b.rot ?? 0, yTop: heightAt(b.x, b.z) + b.r * 1.2, yBottom: heightAt(b.x, b.z) - 2 });
  return { placed, colliders };
}

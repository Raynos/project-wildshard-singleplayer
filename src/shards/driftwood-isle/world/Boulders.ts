/**
 * Boulders — where Driftwood Isle's shore boulders stand (E306 M0b: the rock itself is the model
 * src/shards/driftwood-isle/runtime/models/shoreBoulder.ts; this is the world side). `scatterShoreBoulders()` reads the authored beach rule:
 * rocks along the water line and a few out in the surf, away from the pier corridor. Their placements (yawed, leaned with
 * the slope, half sunk), legacy boxes and gull perches are baked with the scatter (generators/shoreBoulders.ts), and
 * `placeShoreBoulders()` draws them merged into one mesh through src/engine/models/place.ts — one registry piece, `rocks`,
 * with each big rock's hull.
 *
 *   const rocks = await placeShoreBoulders(sky, registry, due);
 *   scene.add(rocks.placed.object);
 */
import { modelContext } from '@wildshard/engine/models/model';
import { placeSliced, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import SHORE from '../data/shoreBoulders.generated.json' with { type: 'json' };
import { shoreBoulder } from '../runtime/models/shoreBoulder';

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

/** The baked placements drawn merged on the existing slice clock, with the legacy box of every colliding rock. */
export async function placeShoreBoulders(sky: Sky, registry: WorldRegistry, due: () => Promise<void> | null): Promise<{ placed: Placed; colliders: Collider[] }> {
  const placed = await placeSliced(shoreBoulder, structuredClone(SHORE.placements), { ctx: modelContext(sky), draw: 'merged', registry, piece: { id: 'rocks', solidFloor: true } }, due);
  return { placed, colliders: structuredClone(SHORE.boxes) };
}

/** Where gulls perch on the big shore rocks' tops, [x, y, z]. */
export const SHORE_PERCHES: readonly (readonly number[])[] = SHORE.perches;

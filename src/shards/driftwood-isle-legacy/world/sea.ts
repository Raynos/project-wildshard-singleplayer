/**
 * Driftwood's level against the road (SHARD-PLATFORM SF46, Jake's G164: "lower the whole world 0.8m including island …
 * make the sea 0.8m deeper too you just fucking align it"; G172: shipped, the old level deleted). The island was authored
 * round a waterline at +0.8 m (`SHORE_LEVEL`: its landscape and its offline bake keep it). The whole world is lowered
 * `WORLD_DROP` together: the terrain (the manifest's field, and its bake through the field's `datum`), the seabed, the sea,
 * the pier, jetties and boat, every prop and collider placed on them, the Blender cove, the movers. The sea rests at road
 * height (y = 0) and nothing moves relative to anything else.
 *
 * `DRIFTWOOD_SEA` is the manifest's registered `sea` water body: the lowered sea, clipped out of the entry sockets and
 * (in a grid cell) at the shore revetment's inner face, so swimming, wading, the camera's water line and the minimap
 * all read road height.
 */
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { swellBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { waterExtent } from '@wildshard/engine/world/waves';
import { SHORE_REVETMENT_INNER_FACE } from '@wildshard/engine/sim/shore';
import type { ChunkTerrain } from '@wildshard/game/shard/manifest';

/** the waterline the island was authored round (its landscape and its offline bake) */
export const SHORE_LEVEL = 0.8;
/** G164: how far Driftwood's whole world is lowered, the sea with it */
export const WORLD_DROP = 0.8;
/** the lowered sea's rest level: road height */
export const LOWERED_SEA = SHORE_LEVEL - WORLD_DROP;
/** how far in from its edge midpoint the lowered world starts each pier and jetty: where the platform's entry socket ends
 *  (ENTRY_ASPHALT, 15 m of road asphalt at y = 0 into the shard; SF8c / G103), so the deck's sea-end ramp rises from the
 *  socket's edge; a whole number of 3 m piling bays, so every piling stays where it stands */
export const PIER_START = Math.floor(ENTRY_ASPHALT / 3) * 3;

/** G164: Driftwood's terrain field lowered `WORLD_DROP` as one (its heights and its waterline; the offline bake, made
 *  from the authored field, is installed shifted by the same `datum`). Normals and splat are unchanged by a vertical
 *  shift. */
export function droppedTerrain(field: ChunkTerrain): ChunkTerrain {
  return {
    ...field,
    heightAt: (x, z) => field.heightAt(x, z) - WORLD_DROP,
    waterLevel: () => field.waterLevel() - WORLD_DROP,
    datum: -WORLD_DROP,
  };
}

/** G149: how far in from the cell edge the platform's rip-rap shore revetment (crest +0.6 m, spanning ±0.8 m about the
 *  edge) puts its inner face (the platform's SHORE_REVETMENT_INNER_FACE); the lowered sea, confined to a grid cell, stops
 *  there (ocean and swim water), hidden under the crest even at the +0.4 m swell. Standalone (unbounded) nothing changes. */
export const SHORE_INNER_FACE = SHORE_REVETMENT_INNER_FACE;
/** whether the lowered sea's rest surface reaches (x, z): inside the confining square less the revetment's inset, out of
 *  the entry sockets */
function loweredReaches(x: number, z: number): boolean {
  return Math.max(Math.abs(x), Math.abs(z)) <= waterExtent.uWaterHalf.value - SHORE_INNER_FACE && !inEntryFootprint(x, z);
}

/** a level-space rectangle (metres) */
export interface DryRect { readonly minX: number; readonly minZ: number; readonly maxX: number; readonly maxZ: number }

/** a shardfile `dryEntries` edge (the engine's `DryEntryEdge`, water/declared.ts; spelled here so the manifest's static closure
 *  stays inside its budget) */
export type DryEntryEdge = 'north' | 'east' | 'south' | 'west';
/** G164 (SHARDFILE.md `socketOverWater`): each of Driftwood's four entries meets the road over the lowered sea, so the
 *  shardfile's `sea` row declares all four `dryEntries` and the platform's 8 × 15 m socket floor is the approach */
export const DRY_ENTRIES: readonly DryEntryEdge[] = ['north', 'east', 'south', 'west'];
/** the declared `sea` water row (shard.config.ts): road height, the swell, the four dry sockets. The runtime consumes the
 *  same row: the lowered swim / wade body and the ocean's clip both read its `dryEntries` */
export const DECLARED_SEA = { id: 'sea', kind: 'sea', level: LOWERED_SEA, waves: true, dryEntries: DRY_ENTRIES } as const;

/** how far in from its socket's shard-side edge an entry landing runs (metres) */
export const LANDING_RUN = 1.5;
const LANDING_HALF = 0.1;
/** one declared entry landing: an axis-aligned slab at road height (top y = 0 exactly), the full 8 m across the socket's
 *  shard-side edge, `LANDING_RUN` deep (G170: the inner end of the asphalt road deck, world/entryDeck.ts); the pier /
 *  jetty's sea-end ramp rises from it */
export interface EntryLanding {
  readonly edge: DryEntryEdge;
  readonly box: { readonly kind: 'box'; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number; readonly surface: 'stone' };
}
function landing(edge: DryEntryEdge): EntryLanding {
  const centre = CHUNK_HALF - ENTRY_ASPHALT - LANDING_RUN / 2, across = ENTRY_WIDTH / 2, along = LANDING_RUN / 2;
  const at = { north: [0, centre, across, along], south: [0, -centre, across, along], east: [centre, 0, along, across], west: [-centre, 0, along, across] } as const;
  const [x, z, hx, hz] = at[edge];
  return { edge, box: { kind: 'box', x, y: -LANDING_HALF, z, hx, hy: LANDING_HALF, hz, surface: 'stone' } };
}
/** G164: the four landings, declared by the shardfile as active static colliders (its socket-landing proof) and installed
 *  exactly as declared by the lowered world build (world/build.ts); G170: the road deck draws each as its inner end */
export const ENTRY_LANDINGS: readonly EntryLanding[] = DRY_ENTRIES.map(landing);

/** the canonical 8 × 15 m socket of a dry entry as a rectangle for the ocean shader's clip (inclusive, the same region as
 *  the engine's `dryEntryContains`) */
export function dryEntryRect(edge: DryEntryEdge): DryRect {
  switch (edge) {
    case 'north': return { minX: -ENTRY_WIDTH / 2, minZ: CHUNK_HALF - ENTRY_ASPHALT, maxX: ENTRY_WIDTH / 2, maxZ: CHUNK_HALF };
    case 'east': return { minX: CHUNK_HALF - ENTRY_ASPHALT, minZ: -ENTRY_WIDTH / 2, maxX: CHUNK_HALF, maxZ: ENTRY_WIDTH / 2 };
    case 'south': return { minX: -ENTRY_WIDTH / 2, minZ: -CHUNK_HALF, maxX: ENTRY_WIDTH / 2, maxZ: -CHUNK_HALF + ENTRY_ASPHALT };
    case 'west': return { minX: -CHUNK_HALF, minZ: -ENTRY_WIDTH / 2, maxX: -CHUNK_HALF + ENTRY_ASPHALT, maxZ: ENTRY_WIDTH / 2 };
    default: throw new Error('Invalid dry entryway');
  }
}
/** the ocean's dry rectangles: the declared sea row's `dryEntries` (G134 (a), kept by G164; SHARDFILE.md's clip) */
export const ENTRY_FOOTPRINTS: readonly DryRect[] = DECLARED_SEA.dryEntries.map(dryEntryRect);
/** whether (x, z) is in one of the declared sea row's dry sockets (inclusive, the region the platform's `dryEntryContains`
 *  clips: test/shards/driftwood-isle/sea-lowered.test.ts holds them equal) */
export function inEntryFootprint(x: number, z: number): boolean {
  return ENTRY_FOOTPRINTS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

const swell = swellBody('sea', LOWERED_SEA);
/** the registered open sea: the lowered sea at road height, clipped out of the entry sockets and at the revetment */
export const DRIFTWOOD_SEA: WaterBody = {
  id: 'sea', level: LOWERED_SEA, surfaceAt: swell.surfaceAt,
  inside: (x, z, y) => loweredReaches(x, z) && swell.inside(x, z, y),
  restAt: (x, z) => (loweredReaches(x, z) ? swell.restAt(x, z) : null),
};

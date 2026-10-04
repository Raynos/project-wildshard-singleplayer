/**
 * Driftwood's sea level (SHARD-PLATFORM SF46, Jake's G134: "just lower everything 0.8m"). The terrain was shaped round a
 * waterline at +0.8 m (`SHORE_LEVEL`: the beach, the wet sand, the lagoon floor, every land prop's "above water" test
 * keep it, so nothing on the island moves). The hybrid (grid) world lowers the sea itself and what floats or stands in it
 * (the pier, the jetties, the boat) by `SEA_DROP`, so the four entry sandbars at y = 0 meet the road dry.
 *
 * `DRIFTWOOD_SEA` is the manifest's registered `sea` water body: it reads the current level on every call, so swimming,
 * wading, the camera's water line and the minimap follow a lowering without a second registration. The ordinary entry
 * never lowers it and reads exactly the old body (`swellBody('sea', 0.8)`).
 */
import type { Scope } from '@wildshard/engine/app/scope';
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { swellBody, type WaterBody } from '@wildshard/engine/world/water/body';
import { waterExtent } from '@wildshard/engine/world/waves';
import { jsonSlot } from '@wildshard/engine/saves/slots';

/** the waterline the island's terrain was built round (the manifest's OCEAN.level) */
export const SHORE_LEVEL = 0.8;
/** G134: how far the hybrid world lowers the sea and its water-tied props */
export const SEA_DROP = 0.8;
/** the lowered sea's rest level: road height */
export const LOWERED_SEA = SHORE_LEVEL - SEA_DROP;
/** how far in from its edge midpoint the lowered world starts each pier and jetty: past the platform's entry socket
 *  (ENTRY_ASPHALT, 15 m of road asphalt into the shard; SF8c / G103), on the next whole 3 m piling bay so every piling
 *  stays where it stands */
export const PIER_START = (Math.floor(ENTRY_ASPHALT / 3) + 1) * 3;

/** G134 (the coordinator's pick A): the lowered sea is ~0 m deep everywhere along the pier (the engine's entry sandbar),
 *  so the moored boat rides at anchor off the sandbar's edge, ~0.9 m of water under it, on one anchor line ahead of its
 *  bow; reached by wading or swimming */
export const ANCHORED_BOAT = { x: -24, z: -240, anchorAhead: 7 };

/** whether the "Driftwood hybrid boot" Debug row (plugin.ts, `driftwoodHybrid`) is saved ON: the lowered world. The row
 *  reloads the page on change, so its saved pick holds for the page's whole life */
export function hybridRowOn(): boolean {
  return jsonSlot('debug.plugin.driftwood-isle.driftwoodHybrid', 'device').read() === 'on';
}

/** the open sea's level as Driftwood declares it to the map and the platform's grid edge reader (`minimap.openWater`):
 *  road height with the hybrid row ON (G134 / G147: every mode; the grid then builds G149's shore, not G91's dike), the
 *  shore level with it OFF (the legacy value) */
export function declaredSeaLevel(): number { return hybridRowOn() ? LOWERED_SEA : SHORE_LEVEL; }

/** how far under the lowered sea a coral's top must stay (SF46: the corals were scattered ≥ 1.5 m under the +0.8 m sea;
 *  the lowered world leaves out the ones that would break its surface, Seabed.build's `below`) */
export const CORAL_CLEARANCE = 0.1;

/** G149: how far in from the cell edge the platform's rip-rap shore revetment (crest +0.6 m, spanning ±0.8 m about the
 *  edge) puts its inner face; the lowered sea, confined to a grid cell, stops there (ocean and swim water), hidden under
 *  the crest even at the +0.4 m swell. Standalone (unbounded) nothing changes.
 *  TODO(G149): import SHORE_REVETMENT_INNER_FACE (the same 0.8, d63506d19) from '@wildshard/engine/sim/seamGeometry' once
 *  the engine package exports that module. */
export const SHORE_INNER_FACE = 0.8;
/** whether the lowered sea's rest surface reaches (x, z): inside the confining square less the revetment's inset, out of
 *  the entry sockets */
function loweredReaches(x: number, z: number): boolean {
  return Math.max(Math.abs(x), Math.abs(z)) <= waterExtent.uWaterHalf.value - SHORE_INNER_FACE && !inEntryFootprint(x, z);
}

/** a level-space rectangle (metres) */
export interface DryRect { readonly minX: number; readonly minZ: number; readonly maxX: number; readonly maxZ: number }
/** the four 8 × 15 m entry sockets (ENTRY_WIDTH across, ENTRY_ASPHALT in from each edge midpoint): the lowered sea is
 *  clipped out of them, so the platform's asphalt is dry (G134 (a)) */
export const ENTRY_FOOTPRINTS: readonly DryRect[] = [
  { minX: -ENTRY_WIDTH / 2, minZ: CHUNK_HALF - ENTRY_ASPHALT, maxX: ENTRY_WIDTH / 2, maxZ: CHUNK_HALF },
  { minX: CHUNK_HALF - ENTRY_ASPHALT, minZ: -ENTRY_WIDTH / 2, maxX: CHUNK_HALF, maxZ: ENTRY_WIDTH / 2 },
  { minX: -ENTRY_WIDTH / 2, minZ: -CHUNK_HALF, maxX: ENTRY_WIDTH / 2, maxZ: -CHUNK_HALF + ENTRY_ASPHALT },
  { minX: -CHUNK_HALF, minZ: -ENTRY_WIDTH / 2, maxX: -CHUNK_HALF + ENTRY_ASPHALT, maxZ: ENTRY_WIDTH / 2 },
];
/** whether (x, z) is in one of the dry entry sockets */
export function inEntryFootprint(x: number, z: number): boolean {
  return ENTRY_FOOTPRINTS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

const shore = swellBody('sea', SHORE_LEVEL), swell = swellBody('sea', LOWERED_SEA);
/** the lowered sea, clipped out of the entry sockets */
const lowered: WaterBody = {
  id: 'sea', level: LOWERED_SEA, surfaceAt: swell.surfaceAt,
  inside: (x, z, y) => loweredReaches(x, z) && swell.inside(x, z, y),
  restAt: (x, z) => (loweredReaches(x, z) ? swell.restAt(x, z) : null),
};
let current: WaterBody = shore;

/** the sea's rest level now */
export function seaLevel(): number { return current.level; }

/** Lower the sea for as long as `owner` (the hybrid resident whose world is built at this level) lives. */
export function lowerSea(owner: Scope): void {
  current = lowered;
  owner.onDispose(() => { if (current === lowered) current = shore; });
}

/** the registered open sea: the shore body until a hybrid resident lowers it */
export const DRIFTWOOD_SEA: WaterBody = {
  id: 'sea',
  get level() { return current.level; },
  surfaceAt: (x, z) => current.surfaceAt(x, z),
  inside: (x, z, y) => current.inside(x, z, y),
  restAt: (x, z) => current.restAt(x, z),
};

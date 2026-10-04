// Chunk spec from sources/wildshard/FUNDAMENTALS.md — fixed for every shard.
export const CHUNK_SIZE = 500;        // metres, square
export const CHUNK_HALF = CHUNK_SIZE / 2;
export const CHUNK_DEPTH = 100;       // metres of rock under the surface (the floating slab)
export const ROAD_WIDTH = 15;         // entry road at each edge midpoint
export const ROAD_LENGTH = 60;        // must be >= 50m into the chunk
// The cell every level fits in (Jake, 2026-10-03, MMO-REQUIREMENTS W1 / O1): 500 × 500 × 500 m, split evenly around
// the highway level y = 0. Validation reads these (SHARD-PLATFORM SP4); CHUNK_DEPTH above is only the drawn rock slab.
export const CELL_HEIGHT = 500;       // metres, bottom to top
export const CELL_BELOW = 250;        // metres below the highway level
export const CELL_ABOVE = CELL_HEIGHT - CELL_BELOW;

export const TERRAIN_RES = 256;       // vertices per side

// ── per-shard values ──
// Live bindings mirrored from the active ShardManifest (src/game/shard/registry.ts). They are set when the
// registry module initialises (from ?chunk=) and again on setActiveChunk(); read them at build time,
// not at module top level, unless your module imports the registry / Heightfield first.
// The defaults are the default level's (the registry's DEFAULT_CHUNK), so a read before the registry has run sees the
// level a bare URL boots.
export let CHUNK_COORDS = '(−1, +6)';
export let TREE_COUNT = 0;
export let SEED = 0x5ea1;

/** the level this page booted: the registry's first apply (from ?chunk= at its import, before standalone mode strips the
 *  query for crash-safe recovery); '' until the registry runs. Travel never changes it. */
export let PAGE_LEVEL = '';

/** @internal — called by the chunk registry; do not call from features. */
export function _applyChunkConstants(c: { slug: string; label: string; seed: number; treeCount: number }): void {
  if (PAGE_LEVEL === '') PAGE_LEVEL = c.slug;
  CHUNK_COORDS = c.label;
  SEED = c.seed;
  TREE_COUNT = c.treeCount;
}

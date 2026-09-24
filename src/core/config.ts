// Chunk spec from sources/wildshard/FUNDAMENTALS.md — fixed for every shard.
export const CHUNK_SIZE = 500;        // metres, square
export const CHUNK_HALF = CHUNK_SIZE / 2;
export const CHUNK_DEPTH = 100;       // metres of rock under the surface (the floating slab)
export const ROAD_WIDTH = 15;         // entry road at each edge midpoint
export const ROAD_LENGTH = 60;        // must be >= 50m into the chunk

export const TERRAIN_RES = 256;       // vertices per side
export const GRASS_RADIUS = 60;

// ── per-shard values ──
// Live bindings mirrored from the active ChunkDef (src/chunks/registry.ts). They are set when the
// registry module initialises (from ?chunk=) and again on setActiveChunk(); read them at build time,
// not at module top level, unless your module imports the registry / Heightfield first.
// The defaults are the default shard's (registry DEFAULT_CHUNK = Driftwood Isle), so a read before the registry has run
// sees the shard a bare URL boots, not Pine Hollow.
export let CHUNK_ID = 'chunk://local/driftwood-isle';
export let CHUNK_COORDS = '(−1, +6)';
export let TREE_COUNT = 0;
export let SEED = 0x5ea1;

/** @internal — called by the chunk registry; do not call from features. */
export function _applyChunkConstants(c: { id: string; gridCoords: string; seed: number; treeCount: number }): void {
  CHUNK_ID = c.id;
  CHUNK_COORDS = c.gridCoords;
  SEED = c.seed;
  TREE_COUNT = c.treeCount;
}

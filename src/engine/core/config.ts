// Chunk spec from sources/wildshard/FUNDAMENTALS.md — fixed for every shard.
export const CHUNK_SIZE = 500;        // metres, square
export const CHUNK_HALF = CHUNK_SIZE / 2;
export const CHUNK_DEPTH = 100;       // metres of rock under the surface (the floating slab)
export const ROAD_WIDTH = 15;         // entry road at each edge midpoint
export const ROAD_LENGTH = 60;        // must be >= 50m into the chunk
/** Legal midpoint entry opening, independent from the boulevard's width (metres). */
export const ENTRY_WIDTH = 8;
/** Neutral platform asphalt reserved inside each legal midpoint entry (metres). */
export const ENTRY_ASPHALT = 15;
// The cell every level fits in (Jake, 2026-10-03, MMO-REQUIREMENTS W1 / O1): 500 × 500 × 500 m, split evenly around
// the highway level y = 0. Validation reads these (SHARD-PLATFORM SP4); CHUNK_DEPTH above is only the drawn rock slab.
export const CELL_HEIGHT = 500;       // metres, bottom to top
export const CELL_BELOW = 250;        // metres below the highway level
export const CELL_ABOVE = CELL_HEIGHT - CELL_BELOW;

/** Decimal bytes per MB in the streaming cost model. */
export const CONTENT_MB = 1_000_000;
/** Provisional phone caps v1 (SF22a); shadow draws count in each draw cap. */
export const CONTENT_CAPS = {
  l0: { size: 62.5, resident: 4 * CONTENT_MB, compressed: 0.3 * CONTENT_MB, triangles: 40_000, draws: 8 },
  l1: { size: 125, resident: 2 * CONTENT_MB, compressed: 0.2 * CONTENT_MB, triangles: 10_000, draws: 2 },
  far: { resident: 1.6 * CONTENT_MB, compressed: CONTENT_MB, triangles: 8_000, draws: 1 },
  library: { resident: 25 * CONTENT_MB, compressed: 8 * CONTENT_MB },
  sim: { resident: 25 * CONTENT_MB, compressed: 2 * CONTENT_MB },
  engineBase: 300 * CONTENT_MB, playing: 1000 * CONTENT_MB, loading: 1800 * CONTENT_MB,
  l0Count: 40, l1Count: 32, farCount: 9, simCount: 4, libraryCount: 4,
  overlap: 80 * CONTENT_MB, residentFactor: 1.11, nearRadius: 150, shadowRadius: 80, pitch: 555,
} as const;

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

interface ChunkConstants { slug: string; label: string; seed: number; treeCount: number }
let homeConstants: ChunkConstants | null = null;
const frames: { constants: ChunkConstants }[] = [];
function publishConstants(c: ChunkConstants): void {
  CHUNK_COORDS = c.label; SEED = c.seed; TREE_COUNT = c.treeCount;
}

/** Retained frame constants; PAGE_LEVEL always remains the document's original level. */
export function bindChunkConstants(c: ChunkConstants): () => void {
  if (frames.length === 0) homeConstants = { slug: PAGE_LEVEL, label: CHUNK_COORDS, seed: SEED, treeCount: TREE_COUNT };
  const entry = { constants: c }; frames.push(entry); publishConstants(c);
  return () => {
    const index = frames.indexOf(entry); if (index === -1) return;
    frames.splice(index, 1);
    const next = frames.at(-1)?.constants ?? homeConstants;
    if (next !== null) publishConstants(next);
  };
}

/** @internal — called by the chunk registry; do not call from features. */
export function _applyChunkConstants(c: { slug: string; label: string; seed: number; treeCount: number }): void {
  if (PAGE_LEVEL === '') PAGE_LEVEL = c.slug;
  homeConstants = c;
  if (frames.length === 0) publishConstants(c);
}

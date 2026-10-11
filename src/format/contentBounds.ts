/** Immutable cell and content bounds shared by author admission and the host. */
/** Square cell width in metres. */
export const CHUNK_SIZE = 500;        // metres, square
/** Half a cell width in metres. */
export const CHUNK_HALF = CHUNK_SIZE / 2;
/** Legal midpoint entry opening in metres. */
export const ENTRY_WIDTH = 8;
/** Asphalt reserved inside each midpoint entry in metres. */
export const ENTRY_ASPHALT = 15;
/** Total cell height in metres. */
export const CELL_HEIGHT = 500;       // metres, bottom to top
/** Cell depth below the highway in metres. */
export const CELL_BELOW = 250;        // metres below the highway level
/** Cell height above the highway in metres. */
export const CELL_ABOVE = CELL_HEIGHT - CELL_BELOW;
/** Decimal bytes per MB in the streaming cost model. */
export const CONTENT_MB = 1_000_000;
/** Provisional phone content caps; shadow draws count in each draw cap. */
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

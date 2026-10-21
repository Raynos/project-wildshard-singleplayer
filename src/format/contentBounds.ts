import memoryGates from './memoryGates.json' with { type: 'json' };

/** Immutable cell and content bounds shared by author admission and the host. */
/** Square cell width in metres. */
export const CHUNK_SIZE = 500;        // metres, square
/** Half a cell width in metres. */
export const CHUNK_HALF = CHUNK_SIZE / 2;
/** Signed placement radius of the finite platform catalogue (SF88); residency budgets stay independent. */
export const GRID_RADIUS = 2;
/** Number of placements, including open plots, in the finite square platform. */
export const GRID_CELL_COUNT = (2 * GRID_RADIUS + 1) ** 2;
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
/** Painted horizon radius in metres, shared by the renderer and authored water fades. */
export const HORIZON_RADIUS = 2300;
/** Decimal bytes per MB in the streaming cost model. */
export const CONTENT_MB = 1_000_000;
/** The one memory switch (src/format/memoryGates.json, G433): the Explorer / loading caps and whether memory checks refuse
 * (`enforce`) or only report (`report-only`, until SHARD-PLATFORM closes). Runtime admission always refuses over the caps. */
export const MEMORY_GATES = Object.freeze({
  reportOnly: memoryGates.mode === 'report-only', explorerMB: memoryGates.explorerMB, loadingMB: memoryGates.loadingMB,
});
/** Provisional phone content caps; shadow draws count in each draw cap. */
export const CONTENT_CAPS = {
  l0: { size: 62.5, resident: 4 * CONTENT_MB, compressed: 0.3 * CONTENT_MB, triangles: 40_000, draws: 8 },
  l1: { size: 125, resident: 2 * CONTENT_MB, compressed: 0.2 * CONTENT_MB, triangles: 10_000, draws: 2 },
  far: { resident: 1.6 * CONTENT_MB, compressed: CONTENT_MB, triangles: 8_000, draws: 1 },
  library: { resident: 25 * CONTENT_MB, compressed: 8 * CONTENT_MB },
  sim: { resident: 25 * CONTENT_MB, compressed: 2 * CONTENT_MB },
  engineBase: 300 * CONTENT_MB, playing: MEMORY_GATES.explorerMB * CONTENT_MB, loading: MEMORY_GATES.loadingMB * CONTENT_MB,
  l0Count: 40, l1Count: 32, farCount: 9, simCount: 4, libraryCount: 4,
  overlap: 80 * CONTENT_MB, residentFactor: 1.11, nearRadius: 150, shadowRadius: 80, pitch: 555,
} as const;

/** Trusted GPU/transcoder capabilities, never authored shard data. */
export interface TextureTranscodeSupport { readonly astc: boolean; readonly bc7: boolean }
/** Exact LDR mip residency, including padded 4x4 ASTC/BC7 blocks at the smallest mip levels. */
export function textureMipBytes(width: number, height: number, levels: number, blocks: boolean): number {
  if (![width, height, levels].every(Number.isSafeInteger) || width < 1 || height < 1 || width > 4096 || height > 4096 || levels < 1 || levels > 13) throw new Error('Texture footprint dimensions or mip cap');
  let bytes = 0;
  for (let mip = 0; mip < levels; mip++) {
    const x = Math.max(1, width >> mip), y = Math.max(1, height >> mip);
    bytes += blocks ? Math.ceil(x / 4) * Math.ceil(y / 4) * 16 : x * y * 4;
  }
  return bytes;
}

const CROSSROADS_CONFIG = {
  n0: 29, // Four-library worst disc: 21 resident tiles plus 8 heading lookahead (SF22a).
  n1: CONTENT_CAPS.l1Count, nf: CONTENT_CAPS.farCount,
  libs: CONTENT_CAPS.libraryCount, sims: CONTENT_CAPS.simCount,
  churn: 2, cpu: 'drop', empty: 8, secs: 20, shadow: 1, shadowRadius: CONTENT_CAPS.shadowRadius, dpr: 2,
  l0SplatSize: 256, l1AtlasSize: 512, farSegments: 62,
  capsMB: { l0: CONTENT_CAPS.l0.resident / CONTENT_MB, l1: CONTENT_CAPS.l1.resident / CONTENT_MB,
    far: CONTENT_CAPS.far.resident / CONTENT_MB, lib: CONTENT_CAPS.library.resident / CONTENT_MB, sim: CONTENT_CAPS.sim.resident / CONTENT_MB },
  trisCap: { l0: CONTENT_CAPS.l0.triangles, l1: CONTENT_CAPS.l1.triangles, far: CONTENT_CAPS.far.triangles },
} as const;

/** Fixed synthetic residency experiment shared by the rig and its API validator, derived from the current content caps. */
export function crossroadsConfig(): typeof CROSSROADS_CONFIG { return CROSSROADS_CONFIG; }

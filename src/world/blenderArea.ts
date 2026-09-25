/**
 * The part of each shard the Blender-built terrain covers (DRIFTWOOD-REMASTER X2, E52; per shard since
 * PINE-HOLLOW-REMASTER PH-0.3). Shared by the Blender pipeline (`scripts/blender/export-scene.mjs --chunk <slug>`) and
 * the game (src/world/BlenderIsland.ts), so both clip at exactly the same lines.
 *
 * - Driftwood Isle (`area`, the one BlenderIsland.ts builds): the spawn cove, the crescent beach, the plank stair and the
 *   hut plateau.
 * - Pine Hollow: provisional — the Hollow around the crossroads and the Hollow cabin, until board B1 fixes Map D and wave 2
 *   bakes it. No `pine-hollow-blender` build exists yet, and the game loads none.
 *
 * The edges sit on the procedural terrain's own grid lines (TERRAIN_RES² over CHUNK_SIZE), so the procedural mesh loses
 * whole cells and the Blender terrain — sampled from the same heights along those lines — meets it without a seam.
 * The Blender grid is twice as fine (STEP = half a procedural cell).
 */
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '../core/config';

/** one procedural terrain cell, metres */
export const CELL = CHUNK_SIZE / (TERRAIN_RES - 1);
/** the Blender terrain's grid step, metres */
export const STEP = CELL / 2;

/** a shard's Blender area: world bounds in metres (or, in `CELLS`, procedural cell indices) */
export interface BlenderArea { x0: number; x1: number; z0: number; z1: number }

/** Driftwood Isle: x cells 71…184, z cells 18…117 → x −110.8 … 110.8, z −214.7 … −20.6 */
const DRIFTWOOD: BlenderArea = { x0: 71, x1: 184, z0: 18, z1: 117 };

/** each shard's area as procedural cell-index bounds */
const CELLS: Readonly<Partial<Record<string, BlenderArea>>> = {
  'driftwood-isle': DRIFTWOOD,
  /** provisional (PH-0.3, until B1 / wave 2): x cells 87…168, z cells 66…148 → x −79.4 … 79.4, z −120.6 … 40.2 */
  'pine-hollow': { x0: 87, x1: 168, z0: 66, z1: 148 },
};

const toWorld = (I: BlenderArea): BlenderArea => ({
  x0: -CHUNK_HALF + I.x0 * CELL, x1: -CHUNK_HALF + I.x1 * CELL,
  z0: -CHUNK_HALF + I.z0 * CELL, z1: -CHUNK_HALF + I.z1 * CELL,
});

/** a shard's Blender area in world metres; null when the shard has none */
export function blenderAreaFor(slug: string): BlenderArea | null {
  const I = CELLS[slug];
  return I ? toWorld(I) : null;
}

/** a shard's build folder name when it is not `<slug>-blender` (Driftwood's predates the per-shard pipeline) */
const MODEL_DIRS: Readonly<Partial<Record<string, string>>> = { 'driftwood-isle': 'driftwood-blender' };

/** where `pnpm blender:island --chunk <slug>` puts a shard's build (a public URL, trailing slash; scripts/blender/run.sh) */
export function blenderModelsBase(slug: string): string { return `/assets/models/${MODEL_DIRS[slug] ?? `${slug}-blender`}/`; }

/** Driftwood Isle's area (x −110.8 … 110.8, z −214.7 … −20.6) — the one BlenderIsland.ts builds */
export const area: BlenderArea = toWorld(DRIFTWOOD);

export function inArea(x: number, z: number, margin = 0): boolean {
  return x > area.x0 + margin && x < area.x1 - margin && z > area.z0 + margin && z < area.z1 - margin;
}

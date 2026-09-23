/**
 * The part of Driftwood Isle the Blender-built island covers (DRIFTWOOD-REMASTER X2, E52): the spawn cove, the crescent
 * beach, the plank stair and the hut plateau. Shared by the Blender pipeline (scripts/blender/export-scene.mjs) and the
 * game (src/world/BlenderIsland.ts), so both clip at exactly the same lines.
 *
 * The edges sit on the procedural terrain's own grid lines (TERRAIN_RES² over CHUNK_SIZE), so the procedural mesh loses
 * whole cells and the Blender terrain — sampled from the same heights along those lines — meets it without a seam.
 * The Blender grid is twice as fine (STEP = half a procedural cell).
 */
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '../core/config';
import { saveSetting, setting, type OptionValue } from '../ui/Settings';

/** one procedural terrain cell, metres */
export const CELL = CHUNK_SIZE / (TERRAIN_RES - 1);
/** the Blender terrain's grid step, metres */
export const STEP = CELL / 2;
/** the cell-index bounds: x cells 71…184, z cells 18…117 */
const I = { x0: 71, x1: 184, z0: 18, z1: 117 };
/** world bounds (x −110.8 … 110.8, z −214.7 … −20.6) */
export const area = {
  x0: -CHUNK_HALF + I.x0 * CELL, x1: -CHUNK_HALF + I.x1 * CELL,
  z0: -CHUNK_HALF + I.z0 * CELL, z1: -CHUNK_HALF + I.z1 * CELL,
};

export function inArea(x: number, z: number, margin = 0): boolean {
  return x > area.x0 + margin && x < area.x1 - margin && z > area.z0 + margin && z < area.z1 - margin;
}

// ── which island: `?island=blender|procedural` for the page's life, else main menu ▸ Settings ▸ Island (E55, `setting('island')`) ──
export type IslandMode = OptionValue<'island'>;

/** the island the page builds (read once at boot; a change needs a reload) */
export function islandMode(): IslandMode { return setting('island'); }

/** the menu's pick: saved; main menu ▸ Settings' APPLY & RELOAD builds it */
export function setIslandMode(m: IslandMode): void { saveSetting('island', m); }

import ISLAND_GRID from '../data/islandClipRows.json' with { type: 'json' };
import geometryPolicy from '../data/groundGeometryPolicy.json' with { type: 'json' };

const CHUNK_HALF = geometryPolicy.size / 2, CELL = geometryPolicy.size / (geometryPolicy.resolution - 1);
interface BlenderArea { x0: number; x1: number; z0: number; z1: number }

/**
 * Driftwood Isle's Blender area (DRIFTWOOD-REMASTER X2, E52): the spawn cove, the crescent beach, the plank stair and the
 * hut plateau, which scripts/blender/driftwood-isle/ bakes and the baked tiles host draws (generators/bakedCove.ts). Procedural cells x 71…184,
 * z 18…117 → x −110.8 … 110.8, z −214.7 … −20.6. The manifest declares it as `blender.area` (E405: the engine keeps
 * no per-shard table), so the export (scripts/blender/lib/export-scene.mjs) and the game clip at the same lines.
 */
export const area: BlenderArea = {
  x0: -CHUNK_HALF + ISLAND_GRID.x0 * CELL, x1: -CHUNK_HALF + ISLAND_GRID.x1 * CELL,
  z0: -CHUNK_HALF + ISLAND_GRID.z0 * CELL, z1: -CHUNK_HALF + ISLAND_GRID.z1 * CELL,
};

export function inArea(x: number, z: number, margin = 0): boolean {
  return x > area.x0 + margin && x < area.x1 - margin && z > area.z0 + margin && z < area.z1 - margin;
}

/** the island build's folder: Driftwood's predates the per-shard `<slug>-blender` folders */
export const BLENDER_MODELS = '/assets/models/driftwood-blender/';

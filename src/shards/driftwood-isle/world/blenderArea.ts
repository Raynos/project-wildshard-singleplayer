import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { CELL, type BlenderArea } from '@wildshard/engine/world/blenderArea';

/**
 * Driftwood Isle's Blender area (DRIFTWOOD-REMASTER X2, E52): the spawn cove, the crescent beach, the plank stair and the
 * hut plateau, which scripts/blender/driftwood-isle/ bakes and BlenderIsland.ts builds. Procedural cells x 71…184,
 * z 18…117 → x −110.8 … 110.8, z −214.7 … −20.6. The manifest declares it as `blender.area` (E405: the engine keeps
 * no per-shard table), so the export (scripts/blender/lib/export-scene.mjs) and the game clip at the same lines.
 */
export const area: BlenderArea = {
  x0: -CHUNK_HALF + 71 * CELL, x1: -CHUNK_HALF + 184 * CELL,
  z0: -CHUNK_HALF + 18 * CELL, z1: -CHUNK_HALF + 117 * CELL,
};

export function inArea(x: number, z: number, margin = 0): boolean {
  return x > area.x0 + margin && x < area.x1 - margin && z > area.z0 + margin && z < area.z1 - margin;
}

/** the island build's folder: Driftwood's predates the per-shard `<slug>-blender` folders */
export const BLENDER_MODELS = '/assets/models/driftwood-blender/';

/**
 * The look loop's layers (PINE-HOLLOW PH-L1 / L4 / L8, the user's picks PH-U34; the before-the-loop grade and ground
 * went in E162): a shard's look-loop grade over its own, and its boreal ground.
 *
 *   const { grade, look } = activeGrade(def);   // Game.buildComposer, Sky (the clock's multipliers)
 *   const g = groundSet(def);                   // Terrain.build, the boot manifest
 */
import type { ChunkDef, ChunkGrade, ChunkLook, RGB } from '../chunks/ChunkDef';

/** the grade the composer builds: the chunk's own, with its look-loop layer when it has one */
export function activeGrade(def: ChunkDef): { grade: ChunkGrade; look: ChunkLook | null } {
  const look = def.look ?? null;
  return { grade: look ? { ...def.grade, ...look.grade } : def.grade, look };
}

/** the ground layers the terrain loads, with the boreal set (canopy litter, moss, tiling breakup) when the shard has one */
export function groundSet(def: ChunkDef): { layers: readonly string[]; tints: readonly RGB[]; boreal: { normalK: readonly number[]; trailDust: readonly number[]; grassTint: readonly number[] } | null } {
  const b = def.assets.boreal;
  return { layers: def.assets.groundLayers, tints: def.assets.groundTints, boreal: b ? { normalK: b.normalK, trailDust: b.trailDust, grassTint: b.grassTint } : null };
}

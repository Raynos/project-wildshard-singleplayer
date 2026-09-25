/**
 * The look loop's switchable variants (PINE-HOLLOW PH-L1 / L4 / L8; the taste rule: a look change ships beside the look
 * it replaces, the user picks):
 *
 *   ?grade=v1    the grade before the loop: the chunk's `grade` alone, no S-curve / vibrance, the clock's haze as it was
 *   ?ground=v1   the ground before the loop: the chunk's `assets.boreal.v1` layers + tints on the plain splat shader
 *   ?nolut       no learned LUT (src/world/lut.ts; the fit's own captures)
 *
 *   const { grade, look } = activeGrade(def);   // Game.buildComposer, Sky (the clock's multipliers)
 *   const g = groundSet(def);                   // Terrain.build, the boot manifest
 */
import type { ChunkDef, ChunkGrade, ChunkLook, RGB } from '../chunks/ChunkDef';

/** `?<key>=v1` in the page's URL (false outside a browser: the bake scripts see the default look) */
export function lookV1(key: 'grade' | 'ground'): boolean {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get(key) === 'v1';
}

/** the grade the composer builds: the chunk's own, with its look-loop layer unless `?grade=v1` */
export function activeGrade(def: ChunkDef): { grade: ChunkGrade; look: ChunkLook | null } {
  const look = def.look && !lookV1('grade') ? def.look : null;
  return { grade: look ? { ...def.grade, ...look.grade } : def.grade, look };
}

/** the ground layers the terrain loads: the boreal set (canopy litter, moss, tiling breakup) unless `?ground=v1` */
export function groundSet(def: ChunkDef): { layers: readonly string[]; tints: readonly RGB[]; boreal: { normalK: readonly number[]; trailDust: readonly number[]; grassTint: readonly number[] } | null } {
  const b = def.assets.boreal;
  if (b && lookV1('ground')) return { layers: b.v1.groundLayers, tints: b.v1.groundTints, boreal: null };
  return { layers: def.assets.groundLayers, tints: def.assets.groundTints, boreal: b ? { normalK: b.normalK, trailDust: b.trailDust, grassTint: b.grassTint } : null };
}

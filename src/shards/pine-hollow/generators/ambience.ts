import { pineCabins } from './bake-pine-cabins.mjs';
import type { PineSources } from './pineSources';

/** Audio surfaces and fire emitters follow the original cabin-then-hamlet build order (D65: over the cabin bake of the
 *  program's sources). */
export function cabinAmbienceRows(sources: PineSources): { floors: { x: number; z: number; rot: number; hw: number; hd: number; y: number }[]; firePits: { x: number; y: number; z: number }[] } {
  const cabins = pineCabins(sources).rows;
  const buildings = [...cabins.buildings.filter(row => !row.hamlet), ...cabins.buildings.filter(row => row.hamlet)];
  return { floors: buildings.flatMap(row => row.floors), firePits: buildings.flatMap(row => {
    const at = row.firePit;
    if (at === null) return [];
    const [x, y, z] = at;
    return [{ x, y, z }];
  }) };
}

import { decodeFloatBlock } from '../runtime/looks/bakedIsland';
import { ISLAND_LOOK } from '../data/islandRows';

/** Required boot content: a bad header, placement count or grid refuses the world stage. */
export function requiredIslandCover(bytes: ArrayBuffer | null, used: number, floats: number | undefined): Float32Array {
  if (bytes === null || floats === undefined) throw new Error('Required island cover is missing');
  const block = decodeFloatBlock(bytes, used, floats, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);
  if (block === null || !block.every(Number.isFinite)) throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
  return block;
}

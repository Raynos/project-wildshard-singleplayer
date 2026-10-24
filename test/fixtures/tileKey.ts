import { TILES_PER_SIDE, type CellTile } from '../../src/game/shardfile/tileOrder';
const TILES = TILES_PER_SIDE * TILES_PER_SIDE;

// Historical contract oracle; production consumers use the data-driven owners.
/** The tile of a key. */
export function keyTile(key: number): CellTile {
  if (!Number.isInteger(key) || key < 0 || key >= TILES) throw new RangeError('Not a tile key');
  return { i: key % TILES_PER_SIDE, j: Math.floor(key / TILES_PER_SIDE) };
}

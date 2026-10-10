import {
  tileFieldGeometry as platformTileFieldGeometry, tileOrigin as platformTileOrigin,
  type TileCardRow as PlatformTileCardRow, type TileFieldRow as PlatformTileFieldRow,
} from '@wildshard/game/systems/looks/tileField';

/** A tile field card's outline as data: vertices `[across, up]` and triangles (SHARD-PLATFORM M3). */
export type TileCardRow = PlatformTileCardRow;
/** A camera-tiled card field's lattice as data: tiles across, inner layers, seed and card outline. */
export type TileFieldRow = PlatformTileFieldRow;
/** The instanced geometry of a camera-tiled card field (a near meadow, moss, flowers): seeded cards in one tile, the tile lattice as instances. */
export const tileFieldGeometry: typeof platformTileFieldGeometry = platformTileFieldGeometry;
/** The tile corner under the camera, snapped to the field's lattice. */
export const tileOrigin: typeof platformTileOrigin = platformTileOrigin;

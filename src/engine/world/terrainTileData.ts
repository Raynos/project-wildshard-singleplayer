import * as terrainBytes from '@wildshard/format/terrainTileBytes';

/** Frozen runtime terrain payload type; defined by the pure format reader. */
export type TerrainTileData = terrainBytes.TerrainTileData;
/** Existing runtime binding to the defining format isTerrainTileData function. */
export const isTerrainTileData = terrainBytes.isTerrainTileData;
/** Existing runtime binding to the defining format encodeTerrainTile function. */
export const encodeTerrainTile = terrainBytes.encodeTerrainTile;
/** Existing runtime binding to the defining format decodeTerrainTile function. */
export const decodeTerrainTile = terrainBytes.decodeTerrainTile;
/** Existing runtime binding to the defining format terrainTileHeight function. */
export const terrainTileHeight = terrainBytes.terrainTileHeight;
/** Existing runtime binding to the defining format terrainTileCost function. */
export const terrainTileCost = terrainBytes.terrainTileCost;

import * as terrainBytes from '@wildshard/format/terrainTileBytes';

/** Frozen runtime terrain payload type; defined by the pure format reader. */
export type TerrainTileData = terrainBytes.TerrainTileData;
/** Existing runtime binding to the defining format isTerrainTileData function. */
export const isTerrainTileData: (bytes: Uint8Array) => boolean = terrainBytes.isTerrainTileData;
/** Existing runtime binding to the defining format encodeTerrainTile function. */
export const encodeTerrainTile: (data: terrainBytes.TerrainTileData) => Uint8Array = terrainBytes.encodeTerrainTile;
/** Existing runtime binding to the defining format decodeTerrainTile function. */
export const decodeTerrainTile: typeof terrainBytes.decodeTerrainTile = terrainBytes.decodeTerrainTile;
/** Existing runtime binding to the defining format terrainTileHeight function. */
export const terrainTileHeight: (data: terrainBytes.TerrainTileData, x: number, z: number, policy?: { layout?: "column-major"; boundary?: "clamp"; }) => number = terrainBytes.terrainTileHeight;
/** Existing runtime binding to the defining format terrainTileCost function. */
export const terrainTileCost: (data: terrainBytes.TerrainTileData) => { decoded: number; gpu: number; triangles: number; draws: number; } = terrainBytes.terrainTileCost;

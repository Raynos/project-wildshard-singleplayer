import { expect, it } from 'vitest';
import * as format from '@wildshard/format/terrainTileBytes';
import * as engine from '@wildshard/engine/world/terrainTileData';

it('keeps frozen terrain runtime imports bound to the defining format functions', () => {
  expect(engine.isTerrainTileData).toBe(format.isTerrainTileData);
  expect(engine.encodeTerrainTile).toBe(format.encodeTerrainTile);
  expect(engine.decodeTerrainTile).toBe(format.decodeTerrainTile);
  expect(engine.terrainTileHeight).toBe(format.terrainTileHeight);
  expect(engine.terrainTileCost).toBe(format.terrainTileCost);
});

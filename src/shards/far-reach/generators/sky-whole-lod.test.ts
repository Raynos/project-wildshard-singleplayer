import { expect, test } from 'vitest';
import { SKY_ISLE_TILES, skyIsleTileLibrary } from './islandScenes';
import { SKY_WORLD_TILE_ROWS } from './worldTileRows';

test('every exact island library uses only the ordered fine payloads', () => {
  const fine = SKY_WORLD_TILE_ROWS.props.tiles.filter(tile => tile.lod === 0);
  const library = skyIsleTileLibrary([
    ...fine.map(({ x, z }) => ({ lod: 0, x, z, file: 'a'.repeat(64) })),
    ...fine.map(({ x, z }) => ({ lod: 1, x, z, file: 'b'.repeat(64) })),
    ...fine.map(({ x, z }) => ({ lod: 0, x, z, file: 'c'.repeat(64) })),
  ]);
  expect(library.models).toHaveLength(12);
  for (const model of library.models) {
    const shipped = SKY_ISLE_TILES.models.find(row => row.id === model.id);
    if (shipped === undefined) throw new Error('Missing original island model');
    expect(shipped.files.length).toBeGreaterThan(0);
    expect(model.files).toEqual([...shipped.files.map(() => 'a'.repeat(64)), ...shipped.files.map(() => 'c'.repeat(64))]);
    expect(model.part).toBe(`isle_${model.id.replace('.', '-')}`);
    expect(model.matrix.slice(0, 12)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(model.matrix).toEqual(shipped.matrix);
  }
});

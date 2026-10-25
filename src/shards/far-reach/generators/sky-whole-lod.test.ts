import { expect, test } from 'vitest';
import { SKY_ISLE_TILES, skyIsleTileLibrary } from './islandScenes';

test('every exact island library uses only the ordered fine payloads', () => {
  const library = skyIsleTileLibrary([{ lod: 0, file: 'a'.repeat(64) },
    { lod: 1, file: 'b'.repeat(64) }, { lod: 0, file: 'c'.repeat(64) }]);
  expect(library.models).toHaveLength(12);
  for (const model of library.models) {
    expect(model.files).toEqual(['a'.repeat(64), 'c'.repeat(64)]);
    expect(model.part).toBe(`isle_${model.id.replace('.', '-')}`);
    expect(model.matrix.slice(0, 12)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    const shipped = SKY_ISLE_TILES.models.find(row => row.id === model.id);
    expect(model.matrix).toEqual(shipped?.matrix);
  }
});

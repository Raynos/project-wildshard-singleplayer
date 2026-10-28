import { expect, test } from 'vitest';
import { CHUNK_HALF, ROAD_LENGTH } from '../src/engine/core/config';
import { PIER, JETTIES, OCEAN } from '../src/shards/driftwood-isle/generators/worldSites';
import { SHORE_LEVEL, WORLD_DROP } from '../src/shards/driftwood-isle/generators/sea';

test('authored pier rows retain the complete original entry coordinates, order and sea facts', () => {
  expect(PIER).toEqual({ x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckAbove: 1.2 });
  expect(JETTIES).toEqual([
    { x: 0, z: CHUNK_HALF, rot: Math.PI, length: ROAD_LENGTH, landing: true },
    { x: -CHUNK_HALF, z: 0, rot: Math.PI / 2, length: 95 },
    { x: CHUNK_HALF, z: 0, rot: -Math.PI / 2, length: 72, landing: 'end' },
  ]);
  expect(OCEAN).toEqual({ level: SHORE_LEVEL - WORLD_DROP, shallowColor: [0, 0.8, 0.88], deepColor: [0.008, 0.15, 0.52], deepDepth: 6 });
  expect(Object.keys(PIER)).toEqual(['x', 'z', 'length', 'width', 'deckAbove']);
  expect(JETTIES.map(row => Object.keys(row))).toEqual([
    ['x', 'z', 'rot', 'length', 'landing'], ['x', 'z', 'rot', 'length'], ['x', 'z', 'rot', 'length', 'landing'],
  ]);
});

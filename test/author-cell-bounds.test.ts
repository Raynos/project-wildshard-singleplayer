import { expect, test } from 'vitest';
import { authorCellBounds, completeL0Tiles } from '../src/sdk/bake/tileGrid';
import { CHUNK_HALF } from '../src/format/contentBounds';
import { ELITE_FEATURE_ROWS } from '../src/shards/pine-hollow/generators/eliteFeatureRows';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('author cell footprint agrees with every complete native L0 tile', () => {
  const bounds = authorCellBounds(), tiles = completeL0Tiles([]);
  expect(bounds).toEqual([-CHUNK_HALF, CHUNK_HALF, -CHUNK_HALF, CHUNK_HALF]);
  expect(authorCellBounds()).not.toBe(bounds);
  expect(Math.min(...tiles.map(row => row.bounds.min[0]))).toBe(bounds[0]);
  expect(Math.max(...tiles.map(row => row.bounds.max[0]))).toBe(bounds[1]);
  expect(Math.min(...tiles.map(row => row.bounds.min[2]))).toBe(bounds[2]);
  expect(Math.max(...tiles.map(row => row.bounds.max[2]))).toBe(bounds[3]);
});

test('all original elite coordinates, script bounds and RNG continuation metadata stay exact', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(ELITE_FEATURE_ROWS));
  expect(bytes.byteLength).toBe(25692);
  expect(hashImmutableBytes(bytes)).toBe('d6bd4f4c5eac206c57a2a59e1aef73ed5b63fc60dce291f29d96167036de8a23');
});

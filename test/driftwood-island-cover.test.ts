import { expect, it } from 'vitest';
import { DataUtils } from 'three';
import { AuthorCoverGrid } from '../src/shards/driftwood-isle/generators/coverGrid';
import { coverTexture, terrainCoverBytes } from '../src/shards/driftwood-isle/generators/islandCover';

it('bakes the cover map with an empty ring and each vertex its cover bytes', () => {
  const grid = new AuthorCoverGrid(); grid.data.set([0.2, 0.4, 0.6, 0.7, 0.1], (60 * grid.n + 60) * 5);
  const crop = grid.crop(), map = coverTexture(crop.data, crop.rect, grid.step), half = new Uint16Array(map.bytes.buffer);
  expect([map.width, map.height]).toEqual([3, 3]);
  expect(DataUtils.fromHalfFloat(half[4 * 4 + 3] ?? 0)).toBeCloseTo(0.8, 3); expect(DataUtils.fromHalfFloat(half[4 * 4] ?? 0)).toBeCloseTo(0.16, 3);
  expect(Array.from(half.subarray(0, 16))).toEqual(Array.from({ length: 16 }, () => 0));
  const [u0, v0, su, sv] = map.uv, at = -250 + 60 * 4;
  expect([(at * su + u0) * map.width, (at * sv + v0) * map.height]).toEqual([1.5, 1.5]);
  const bytes = terrainCoverBytes(grid, 2, (i, p) => p.set(i === 0 ? at : -250, 0, i === 0 ? at : -250));
  expect(bytes.length).toBe(10); expect(bytes[3]).toBe(Math.round(Math.fround(0.7) * 255)); expect(bytes[8]).toBe(Math.round(Math.fround(0.1) * 255));
  expect(Array.from(bytes.subarray(4, 8))).toEqual([0, 0, 0, 0]); expect(bytes[9]).toBe(0);
});

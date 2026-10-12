import { expect, it } from 'vitest';
import { bakedSamplers, type BakedTerrainSamplers } from '@wildshard/format/bakedTerrainSampling';
import { parseBakedTerrain, type BakedGrid } from '@wildshard/format/bakedTerrainBytes';
import { bakedSamplers as runtimeSamplers } from '@wildshard/engine/world/BakedTerrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { originalBakedSamplers } from './fixtures/baked-terrain-samplers';

function compare(actual: BakedTerrainSamplers, original: BakedTerrainSamplers, x: number, z: number): void {
  expect(actual.heightAt(x, z)).toBe(original.heightAt(x, z));
  expect(actual.normalAt(x, z)).toEqual(original.normalAt(x, z));
  expect(actual.normalAt(x, z, 1.25)).toEqual(original.normalAt(x, z, 1.25));
  expect(actual.splatAt(x, z)).toEqual(original.splatAt(x, z));
}

it('keeps the runtime binding identical to the author-only defining function', () => {
  expect(runtimeSamplers).toBe(bakedSamplers);
});

it('preserves the frozen native law on 10k cold authored terrain queries', () => {
  const grid = parseBakedTerrain(new Uint8Array(driftwoodGroundBytes()).buffer);
  if (grid === null) throw new Error('Missing cold authored lattice');
  const actual = bakedSamplers(grid), original = originalBakedSamplers(grid);
  for (let index = 0; index < 10_000; index++) {
    compare(actual, original, ((index * 137.031) % 620) - 310, ((index * 71.917) % 620) - 310);
  }
  for (const x of [-Infinity, -250, 0, 250, Infinity, Number.NaN]) {
    for (const z of [-Infinity, -250, 0, 250, Infinity, Number.NaN]) compare(actual, original, x, z);
  }
});

it('preserves missing lattice reads and positive-only splat normalization', () => {
  const grid: BakedGrid = { res: 2, size: 2, seed: 1337, landscapeHash: 0,
    heights: new Float32Array([0, 2, 4, 6]), splat: new Uint8Array(16), undergrowth: null };
  expect(bakedSamplers(grid).heightAt(0, 0)).toBe(3);
  expect(bakedSamplers(grid).splatAt(0, 0)).toEqual([0, 0, 0, 0]);
  grid.splat.set([1, 2, 3, 4]);
  expect(bakedSamplers(grid).splatAt(-1, -1)).toEqual([0.1, 0.2, 0.3, 0.4]);
  grid.heights = new Float32Array([3]);
  compare(bakedSamplers(grid), originalBakedSamplers(grid), 0, 0);
});

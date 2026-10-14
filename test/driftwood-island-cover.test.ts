import { expect, it } from 'vitest';
import { requiredIslandCover } from '../src/shards/driftwood-isle/world/islandCover';
import { encodeFloatBlock } from '../src/shards/driftwood-isle/generators/islandCover';
import { ISLAND_LOOK } from '../src/shards/driftwood-isle/data/islandRows';

it('admits baked cover and refuses missing, mismatched and corrupt content', () => {
  const block = new Float32Array([0.2, 0.4, 0.8]);
  const file = new Uint8Array(encodeFloatBlock(block, 5, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version));
  expect(requiredIslandCover(file.buffer, 5, block.length)).toEqual(block);
  expect(() => requiredIslandCover(null, 5, block.length)).toThrow('missing');
  expect(() => requiredIslandCover(file.buffer, 6, block.length)).toThrow('mismatched');
  expect(() => requiredIslandCover(file.buffer, 5, block.length + 1)).toThrow('mismatched');
  new DataView(file.buffer).setFloat32(16, Number.NaN, true);
  expect(() => requiredIslandCover(file.buffer, 5, block.length)).toThrow('corrupt');
});

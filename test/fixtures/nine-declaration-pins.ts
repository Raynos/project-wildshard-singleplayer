import { expect } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import type { Shardfile } from '../../src/sdk/shardfile';
import worldFiles from './nine-world-files.json' with { type: 'json' };

const signature = (value: unknown): { bytes: number; hash: string } => {
  const source = new TextEncoder().encode(encodeCanonicalJson(value));
  return { bytes: source.byteLength, hash: hashImmutableBytes(source) };
};

/** Nine's complete declaration, attributed. The declaration pinned at 734805 B / c80c8026 (ba4dab6764) moved twice.
 *  T8 (82ac81812d, e389eb998e, b1f6916531) added the 16 L1 rows and the 12 coarse files only they draw, none in the
 *  library: without them it is 735799 B. The rest is I3's regridded world (978526b2f7): every file row but 17 is a world
 *  file the independently regenerated world fixture pins (f1af1023d3), and those 17 are pinned here by hash. */
export function expectNineDeclaration(product: Shardfile): void {
  const fine = new Set(product.tiles.filter(tile => tile.lod === 0).flatMap(tile => tile.files));
  const coarse = new Set(product.tiles.filter(tile => tile.lod === 1).flatMap(tile => tile.files).filter(file => !fine.has(file)));
  expect(coarse.size).toBe(12); expect(product.library.filter(file => coarse.has(file))).toEqual([]);
  expect(product.tiles.filter(tile => tile.lod !== 0 && tile.lod !== 1)).toEqual([]);
  expect(signature({ ...product, tiles: product.tiles.filter(tile => tile.lod === 0), files: product.files.filter(file => !coarse.has(file.hash)) }))
    .toEqual({ bytes: 735799, hash: '94903d85d60a7469ce118b23f7ae9d28d7a0b0e76d2094c6a209eba11a5985f2' });
  const world = new Set(worldFiles.map(row => row.hash));
  expect(signature(product.files.filter(file => !world.has(file.hash)).map(file => file.hash).sort()))
    .toEqual({ bytes: 1141, hash: '1ab081469b9ba1a809ea889eadf95e01f6dc9c617e66a71e5c70c6605aa52e6d' });
  expect(signature(product)).toEqual({ bytes: 741684, hash: '62ed0264485e75570c798d7b6cc85c137ffa092c8161a5838a6e8081e1f3731c' });
}

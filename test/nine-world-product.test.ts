import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareAssetDecoders } from '../src/format/product';
import { nineWorldProduct, nineLayoutWord } from '../src/shards/nine-dragon-stack/generators/worldProduct';
import { nativeSignAtlas } from './fixtures/nine-native-atlas';
import worldFiles from './fixtures/nine-world-files.json' with { type: 'json' };

// Build the genuinely cold world during collection. Its complete byte oracle
// retains the ordinary 30 s assertion budget, without timing production setup.
await prepareAssetDecoders();
const product = nineWorldProduct(nativeSignAtlas.atlas);

// The 10-24 receipt captured before extracting the in-memory producer (world 152270 B 3bdbd28e, layout 6827623 B 7c8d8e34,
// 397 assets) cannot be projected back: I3 re-encoded every library piece on purpose (210f87d040, 19f9dce77a, 978526b2f7,
// 39de31c1ec; none of the 397 hashes survive). The cold world's complete bytes are pinned in nine-world-files.json
// (f1af1023d3, two identical cold builds); T8's coarse L1 city (82ac81812d, b1f6916531) is proved to be only added rows.
test('the owned world preserves the complete pinned layout, metadata and asset bytes', () => {
  const encode = (value: unknown, suffix = '') => new TextEncoder().encode(JSON.stringify(value, nineLayoutWord) + suffix);
  const signature = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) });
  const pinned = new Map(worldFiles.map(row => [row.path, { bytes: row.bytes, hash: row.hash }]));
  expect(signature(encode(product.metadata, '\n'))).toEqual(pinned.get('data/world.generated.json'));
  expect(signature(encode(product.layout))).toEqual(pinned.get('data/layout.generated.json'));
  expect(product.assets.size).toBe(409);
  for (const [hash, bytes] of product.assets) {
    expect(signature(bytes)).toEqual(pinned.get(`assets/${hash}`));
    expect(product.metadata.shardfile.files.some(file => file.hash === hash && file.compressed === bytes.byteLength)).toBe(true);
  }
  // T8: 16 L1 parents (four proven empty) and 12 coarse props tiles, whose 12 files sit outside the 397-file library.
  const { shardfile, props, report } = product.metadata, coarse = new Set(shardfile.tiles.filter(tile => tile.lod === 1).flatMap(tile => tile.files));
  expect(shardfile.tiles.filter(tile => tile.lod === 1)).toHaveLength(16); expect(coarse.size).toBe(12);
  expect(shardfile.library).toHaveLength(397); expect(shardfile.library.some(hash => coarse.has(hash))).toBe(false);
  const fine = { ...product.metadata, shardfile: { ...shardfile, tiles: shardfile.tiles.filter(tile => tile.lod === 0), files: shardfile.files.filter(file => !coarse.has(file.hash)) },
    props: props === undefined ? undefined : { ...props, tiles: props.tiles.filter(tile => tile.lod === 0) }, report: report?.filter(row => row.lod === 0) };
  expect(signature(encode(fine, '\n'))).toEqual({ bytes: 151900, hash: '4f859d0d7b08ca4d1f2c9ea4fc79706ae0d8e051ae8f5f0c97e95baf663de1f3' });
});

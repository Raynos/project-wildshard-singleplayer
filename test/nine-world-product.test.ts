import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareAssetDecoders } from '../src/format/product';
import { nineWorldProduct, nineLayoutWord } from '../src/shards/nine-dragon-stack/generators/worldProduct';
import { nativeSignAtlas } from './fixtures/nine-native-atlas';

// Build the genuinely cold world during collection. Its complete byte oracle
// retains the ordinary 30 s assertion budget, without timing production setup.
await prepareAssetDecoders();
const product = nineWorldProduct(nativeSignAtlas.atlas);

// Original registered output bytes captured before extracting the in-memory producer.
test('the owned world preserves the complete original layout, metadata and asset bytes', () => {
  const encode = (value: unknown, suffix = '') => new TextEncoder().encode(JSON.stringify(value, nineLayoutWord) + suffix);
  const world = encode(product.metadata, '\n'), layout = encode(product.layout);
  expect(world.byteLength).toBe(152270);
  expect(hashImmutableBytes(world)).toBe('3bdbd28ef8e41cc1b429ea6838c3fe2861791016d5b36d9490d316adeeb780ec');
  expect(layout.byteLength).toBe(6827623);
  expect(hashImmutableBytes(layout)).toBe('7c8d8e34ff5ed915eaeaf73d838c2ea3dc65a36e5125e450544074ffecb3171b');
  expect(product.assets.size).toBe(397);
  for (const [hash, bytes] of product.assets) {
    expect(hashImmutableBytes(bytes)).toBe(hash);
    expect(product.metadata.shardfile.files.some(file => file.hash === hash && file.compressed === bytes.byteLength)).toBe(true);
  }
});

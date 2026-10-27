import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { stormRest } from '../src/shards/far-reach/generators/restScene';

// GR5: the storm pool is built in the product (restPoolProgram.ts); its original committed bytes stay pinned by hash.
test('the storm declaration and geometry keep the original merged-bolt bytes', () => {
  const { glb, scene } = stormRest(), hash = hashImmutableBytes(glb);
  expect(glb.byteLength).toBe(43_108);
  expect(hash).toBe('fc828ac38a91fd74abbe6fc63f823096e42744d9ed0d0fc057d74c73c3a5ec32');
  expect(scene.nodes.filter(row => row.kind === 'mesh')).toHaveLength(2);
});

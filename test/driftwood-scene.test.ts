import { expect, it } from 'vitest';
import { projectPlaceholders } from '../src/sdk/bake/placeholders';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareAssetDecoders } from '../src/format/product';
import { scriptAdmissionRows } from '../src/format/scriptContract';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { productClosureFile } from '../src/game/shardfile/shardProduct';
import { driftwoodEmittedProduct } from './fixtures/driftwood-emitted-product';

async function readEmittedWorld() {
  const product = await driftwoodEmittedProduct(), shard = product.shardfile;
  const output = outputDescriptor(shard);
  if (output === undefined) throw new Error('Missing emitted Driftwood output');
  const assets = new Map<string, Uint8Array>();
  const refs = [...new Set([...shard.files.map(file => file.hash), ...shard.requires.commons.map(hash => `commons:${hash}`)])];
  // Admit every declared byte, including commons, rather than only the entry
  // ring. The ordinary build owns production; this reader never regenerates.
  for (let offset = 0; offset < refs.length; offset += 16) {
    const batch = refs.slice(offset, offset + 16);
    const bytes = await Promise.all(batch.map(hash => productClosureFile(product, hash)));
    for (const [index, hash] of batch.entries()) {
      const value = bytes[index]; if (value === undefined) throw new Error('Missing emitted asset read'); assets.set(hash, value);
    }
  }
  await prepareAssetDecoders();
  return { shard, assets, scripts: scriptAdmissionRows(output.sections) };
}
let pendingWorld: ReturnType<typeof readEmittedWorld> | undefined;
function emittedWorld(): ReturnType<typeof readEmittedWorld> { pendingWorld ??= readEmittedWorld(); return pendingWorld; }

it('admits the real generated ground, tile and library assets for the trusted world', async () => {
  const loaded = await emittedWorld();
  expect(validateShardfileAssets(loaded.shard, loaded.assets, hashImmutableBytes, undefined, undefined, loaded.scripts)).toEqual(loaded.shard);
  expect(loaded.shard.runtime?.binds).toContain('props');
  expect(loaded.shard.runtime?.binds).toContain('terrain');
});

it('refuses the CLI far bake when its actual image envelope exceeds the cap', async () => {
  const loaded = await emittedWorld();
  await expect(projectPlaceholders(loaded.shard, new Map(loaded.assets))).rejects.toThrow('Far proxy exceeds content caps');
});

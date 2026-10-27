import { expect, it } from 'vitest';
import { projectPlaceholders } from '../src/sdk/bake/placeholders';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { contentHash, readProjectAssets } from '../src/sdk/project';
import { outputScriptAdmissionRows } from '../src/sdk/outputProduct';
import { DRIFTWOOD as source } from './fixtures/driftwood-program';

it('admits the real generated ground, tile and library assets for the trusted world', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle', undefined, { folder: 'driftwood-isle', imageRoots: [{ prefix: '/assets/', directory: 'public/assets' }] });
  expect(validateShardfileAssets(loaded.shard, loaded.assets, contentHash, undefined, undefined, outputScriptAdmissionRows(loaded.output.platform))).toEqual(loaded.shard);
  expect(source.runtime?.binds).toContain('props');
  expect(source.runtime?.binds).toContain('terrain');
});

it('refuses the CLI far bake when its actual image envelope exceeds the cap', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle', undefined, { folder: 'driftwood-isle', imageRoots: [{ prefix: '/assets/', directory: 'public/assets' }] });
  await expect(projectPlaceholders(loaded.shard, loaded.assets)).rejects.toThrow('Far proxy exceeds content caps');
});

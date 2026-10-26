// oxlint-disable-next-line import/no-nodejs-modules -- Read complete admitted product and frozen original geometry bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the current SDK-built product and its declared file.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete GLB without expanding a 10 MB assertion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { readBuiltShardfile } from '../scripts/built-product.mjs';
import { readProgramDiscovery } from '../scripts/program-discovery.mjs';
import { parseOutputIndex } from '../src/format/outputIndex';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyProductBoot } from '../src/shards/far-reach/generators/bootInventory';

test('the actual SDK-built product binds receipt-verified discovery to the admitted complete geometry', () => {
  const root = resolve('.'), folder = readBuiltShardfile(root, 'far-reach');
  const input: unknown = JSON.parse(readFileSync(resolve(folder, 'shard.json'), 'utf8'));
  const index = parseOutputIndex(input), file = index.files.find(row => row.name === 'world/geometry/prepared-models.glb');
  if (file === undefined) throw new Error('Missing owned prepared geometry');
  const hash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
  expect(file.hash).toBe(hash);
  expect(`/shardfiles/far-reach/${file.path}`).toBe(`/shardfiles/far-reach/blobs/glb/${hash}.glb`);
  expect(readProgramDiscovery(root, 'far-reach')).toEqual(skyProductBoot());
  const bytes = readFileSync(resolve(folder, file.path));
  expect(hashImmutableBytes(bytes)).toBe(hash);
  expect(Buffer.compare(bytes, readFileSync('public/assets/far-reach/baked/prepared-models.glb'))).toBe(0);
  expect(file).toMatchObject({ compressed: 10_134_100, decoded: 10_134_072, gpu: 10_096_780, triangles: 203_025, draws: 48 });
});

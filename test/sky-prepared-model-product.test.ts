// oxlint-disable-next-line import/no-nodejs-modules -- Read complete admitted product and frozen original geometry bytes.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the current SDK-built product and its declared file.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete GLB without expanding a 10 MB assertion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { readBuiltShardfile } from '../scripts/built-product.mjs';
import { readProgramDiscovery } from '../scripts/program-discovery.mjs';
import { parseOutputIndex } from '../src/format/outputIndex';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { projectAssets } from '../src/sdk/project';
import { prepareProjectOutput } from '../src/sdk/projectOutput';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { prepareOutput } from '../src/shards/far-reach/generators/sourceOutput';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { BAKED_PIECES } from '../src/shards/far-reach/generators/fileInventory';
import { nameBlob } from '../src/sdk/blobs';
import { MILL_REST_URL } from '../src/shards/far-reach/generators/restFiles';
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
  const bridge = index.files.find(row => row.name === 'world/geometry/bridge-rest.glb');
  if (bridge === undefined) throw new Error('Missing owned bridge geometry');
  expect(bridge).toEqual({ name: 'world/geometry/bridge-rest.glb', kind: 'glb',
    hash: '1a31cb2c7b426d9ffb14db4e39792aeb0bde86f6f01d0b1796130a3a0c7d8bf0',
    path: 'blobs/glb/1a31cb2c7b426d9ffb14db4e39792aeb0bde86f6f01d0b1796130a3a0c7d8bf0.glb',
    compressed: 2_109_968, decoded: 2_109_940, gpu: 2_031_804, triangles: 35_709, draws: 126, dependencies: [], critical: false });
  expect(hashImmutableBytes(readFileSync(resolve(folder, bridge.path)))).toBe(bridge.hash);

  const millOriginal = readFileSync(`public${MILL_REST_URL}`), mill = nameBlob('world/geometry/mill-rest.glb', 'glb', millOriginal);
  expect(mill.file.hash).toBe('3b12beff5b5ae8fbb51433b27890591e85bdc9049dd999e19cc4700400603b37');
  expect(index.files.find(row => row.name === mill.file.name)).toEqual(mill.file);
  expect(Buffer.compare(readFileSync(resolve(folder, mill.file.path)), millOriginal)).toBe(0);

  for (const piece of BAKED_PIECES) {
    const name = `world/geometry/pieces/${piece}.glb`, original = readFileSync(`public/assets/far-reach/baked/${piece}.glb`);
    const expected = nameBlob(name, 'glb', original), actual = index.files.find(row => row.name === name);
    expect(actual).toEqual(expected.file);
    expect(Buffer.compare(readFileSync(resolve(folder, expected.file.path)), original)).toBe(0);
  }
});


test('all original tiles admit from owned output with no project asset files', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-tile-publication-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'f'.repeat(64), new Map(), resolve(scratch, 'cache'),
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const owned = await prepareOutput(ctx), prepared = await prepareProjectOutput(resolve('src/shards/far-reach'), owned);
    const base = emptyShardfile({ slug: 'tile-publication', name: 'Tiles', author: 'Fixture', revision: 1, seed: 1 });
    const rows = SKY_WORLD_TILE_ROWS, shard = { ...base, files: rows.files, tiles: rows.tiles,
      library: rows.files.map(file => file.hash), budgets: { ...base.budgets, library: {
        compressed: rows.files.reduce((sum, file) => sum + file.compressed, 0),
        resident: rows.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0) } } };
    const empty = mkdtempSync(resolve(scratch, 'project-'));
    const admitted = projectAssets(empty, shard, 'project', prepared.assets);
    expect(readdirSync(empty)).toEqual([]);
    expect([...admitted.keys()]).toEqual(rows.files.map(file => file.hash));
    const folder = readBuiltShardfile(resolve('.'), 'far-reach');
    const input: unknown = JSON.parse(readFileSync(resolve(folder, 'shard.json'), 'utf8'));
    const index = parseOutputIndex(input);
    expect(rows.files).toHaveLength(22);
    for (const original of rows.files) {
      const file = index.files.find(row => row.hash === original.hash), bytes = admitted.get(original.hash);
      if (file === undefined || bytes === undefined) throw new Error('Missing admitted original tile');
      expect(file).toMatchObject(original);
      expect(hashImmutableBytes(bytes)).toBe(original.hash);
      expect(Buffer.compare(bytes, readFileSync(`src/shards/far-reach/assets/${original.hash}`))).toBe(0);
      expect(Buffer.compare(bytes, readFileSync(resolve(folder, file.path)))).toBe(0);
    }
    const first = rows.files[0];
    if (first === undefined) throw new Error('Missing original tile declaration');
    const missing = new Map(prepared.assets); missing.delete(first.hash);
    expect(() => projectAssets(empty, shard, 'project', missing)).toThrow();
    const short = new Map(prepared.assets); short.set(first.hash, new Uint8Array());
    expect(() => projectAssets(empty, shard, 'project', short)).toThrow('Project asset differs from its declared wire size');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { prepareSceneSources, sceneModelDefinition, sceneBakeSource } from '../src/game/shardfile/sceneSources';
import { parseWorldScenes } from '../src/format/worldScenes';

test('scene declarations read in bounded batches and publish models before dependent bakes', async () => {
  const models = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, kind: 'models', file: `m${i}.json` }));
  const baked = [{ id: 'b0', kind: 'baked', file: 'b0.json' }, { id: 'b1', kind: 'baked', file: 'b1.json' }];
  const section = parseWorldScenes({ version: 1, libraries: [...models, ...baked], materials: [], steps: [] });
  const started: string[] = [], pending = new Map<string, (bytes: Uint8Array) => void>();
  const library = { rows: { meshes: [], hd: [], meshUrls: {}, hdUrls: {}, hdLooks: {}, aoFloor: 1 } };
  const product = createShardProduct({ slug: 'source-read-order', revision: 1,
    shardfile: emptyShardfile({ slug: 'source-read-order', name: 'Reads', author: 'Fixture', revision: 1, seed: 1 }),
    sections: new Map([['world/scenes', section]]),
    files: new Map([...models, ...baked].map(row => [row.file, { hash: row.file, url: row.file }])),
    read: name => { started.push(name); return new Promise(resolve => { pending.set(name, resolve); }); } });
  const finish = (names: readonly string[], value: unknown): void => {
    for (const name of names) {
      const resolve = pending.get(name); if (resolve === undefined) throw new Error('Missing source read');
      resolve(new TextEncoder().encode(JSON.stringify(value)));
    }
  };
  const loading = prepareSceneSources(product);
  expect(started).toEqual(models.slice(0, 4).map(row => row.file));
  finish([...started].reverse(), library);
  await vi.waitFor(() => { expect(started).toHaveLength(6); });
  expect(started).toEqual(models.map(row => row.file));
  expect(() => sceneBakeSource(product, 'b0')).toThrow('not prepared');
  finish(models.slice(4).map(row => row.file), library);
  await vi.waitFor(() => { expect(started).toHaveLength(8); });
  for (const row of models) expect(sceneModelDefinition(product, row.id).rows).toEqual(library.rows);
  finish(baked.map(row => row.file), { rows: {}, urls: {} });
  await loading;
  expect(started).toEqual([...models, ...baked].map(row => row.file));
  expect(sceneBakeSource(product, 'b0')).toBeDefined();
});

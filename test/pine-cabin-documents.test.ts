import { expect, test } from 'vitest';
import { cabinScene } from '../src/shards/pine-hollow/generators/cabinSceneContribution';
import { PINE_SOURCES } from './fixtures/pine-sources';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseWorldSceneModels, worldSceneModelGraphs } from '@wildshard/format/worldSceneModels';

test('cabin documents stay deferred while building sites remain eager', async () => {
  const rows = await cabinScene(PINE_SOURCES);
  const documents = rows.CABIN_JSON_BLOBS.filter(blob => blob.file.name?.startsWith('world/scene-pages/cabins.') === true);
  const late = new Set(rows.CABIN_LATE.map(row => row.hash));
  for (const blob of documents) { expect(late).toContain(blob.file.hash); expect(hashImmutableBytes(blob.bytes)).toBe(blob.file.hash); }
  const sites = rows.CABIN_JSON_BLOBS.find(blob => blob.file.name === 'world/building-sites.json');
  if (sites === undefined) throw new Error('Missing original living sites');
  expect(late.has(sites.file.hash)).toBe(false);
});

test('a cold cabin choice fetches one family page independent of the shell page', async () => {
  const rows = await cabinScene(PINE_SOURCES);
  const catalogue = parseWorldSceneModels({ product: 'pine-hollow', models: rows.CABIN_MODEL_ROWS });
  for (const model of catalogue.models) for (const choice of model.choices) {
    const graphs = worldSceneModelGraphs(choice);
    const files = graphs.map(graph => {
      if (!('file' in graph)) throw new Error('Missing paged cabin specimen');
      expect(graph.member).toBeDefined();
      expect(graph.file).not.toContain('cabins.world.');
      return graph.file;
    });
    expect(new Set(files).size).toBe(1);
  }
});

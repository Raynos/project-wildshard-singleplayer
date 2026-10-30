import { expect, test } from 'vitest';
import { cabinScene } from '../src/shards/pine-hollow/generators/cabinSceneContribution';
import { PINE_SOURCES } from './fixtures/pine-sources';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('cabin documents stay deferred while building sites remain eager', async () => {
  const rows = await cabinScene(PINE_SOURCES);
  const documents = rows.CABIN_JSON_BLOBS.filter(blob => blob.file.name?.startsWith('scenes/cabins/') === true);
  const late = new Set(rows.CABIN_LATE.map(row => row.hash));
  for (const blob of documents) { expect(late).toContain(blob.file.hash); expect(hashImmutableBytes(blob.bytes)).toBe(blob.file.hash); }
  const sites = rows.CABIN_JSON_BLOBS.find(blob => blob.file.name === 'world/building-sites.json');
  if (sites === undefined) throw new Error('Missing original living sites');
  expect(late.has(sites.file.hash)).toBe(false);
});

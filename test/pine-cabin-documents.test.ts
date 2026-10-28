import { expect, test } from 'vitest';
import { cabinScene } from '../src/shards/pine-hollow/generators/cabinSceneContribution';
import { PINE_SOURCES } from './fixtures/pine-sources';
import { hashImmutableBytes } from '../src/sdk/immutable';

test('cabin document scheduling retains the complete inventory and original stable body pins', async () => {
  const rows = await cabinScene(PINE_SOURCES);
  const documents = rows.CABIN_JSON_BLOBS.filter(blob => blob.file.name?.startsWith('scenes/cabins/') === true);
  // Native Vite and the production bundle differ in the final low words of
  // one watermill Float64 transform (~3.9e-16). Do not re-pin that product
  // oracle from a different compiler context: the pinned build compares all
  // 64 rows. The other 52 have the same byte identities in both contexts.
  const held = documents.filter(blob => blob.file.name?.startsWith('scenes/cabins/specimens/') === true && !blob.file.name.includes('/watermill-'))
    .map(blob => [blob.file.name, blob.file.hash, blob.bytes.byteLength]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  expect(documents).toHaveLength(64);
  expect(documents.reduce((n, blob) => n + blob.bytes.byteLength, 0)).toBe(1572582);
  expect(held).toHaveLength(52);
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(held)))).toBe('9eb65a4f1806fb6725087d22ed86c278b357ec8f71dae88b70bd407b770d701c');
  const late = new Set(rows.CABIN_LATE.map(row => row.hash));
  for (const blob of documents) { expect(late).toContain(blob.file.hash); expect(hashImmutableBytes(blob.bytes)).toBe(blob.file.hash); }
  const sites = rows.CABIN_JSON_BLOBS.find(blob => blob.file.name === 'world/building-sites.json');
  if (sites === undefined) throw new Error('Missing original living sites');
  expect(late.has(sites.file.hash)).toBe(false);
});

import { expect, test } from 'vitest';
import * as v from 'valibot';
import { driftwoodQuestContinuation } from '../src/shards/driftwood-isle/generators/lootBag';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { builtProduct } from './fixtures/builtProduct';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import { QuestContinuationSchema, parseQuestContinuationDocument } from '../src/format/questContinuation';
import { QuestPageSchema } from '../src/format/questPageComposition';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const rows = driftwoodQuestContinuation();
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('the real product emits the admitted continuation with exact owner and cosmetic identities', async () => {
  const product = await loadHeadlessProduct(builtProduct('driftwood-isle')), output = outputDescriptor(product.shardfile);
  if (output === undefined) throw new Error('Missing emitted product descriptor');
  const files = output.index.files.filter(file => file.name === 'quests/page-composition.json');
  expect(files).toHaveLength(1);
  const file = files[0], bytes = file === undefined ? undefined : await product.file('quests/page-composition.json');
  if (file === undefined || bytes === undefined || file.jsonSchema === undefined) throw new Error('Missing defining continuation blob');
  expect(parseQuestContinuationDocument(validateNamedJsonSchema(file.jsonSchema, bytes))).toEqual(v.parse(QuestContinuationSchema, rows));
  expect(rows.cosmetics.models).toEqual({ hat: 'captainHat', cape: 'sailclothCape' });
  expect(rows.loot.before).toEqual(['body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world']);
  const names = new Set(output.index.files.map(row => row.name));
  expect(names.has(rows.cosmetics.file)).toBe(true); expect(names.has(rows.loot.shop)).toBe(true);
});

test('the defining named schema rejects reflected owners, wrong cosmetic ids and malformed loot flags', async () => {
  const product = await loadHeadlessProduct(builtProduct('driftwood-isle')), output = outputDescriptor(product.shardfile);
  if (output === undefined) throw new Error('Missing emitted product descriptor');
  const file = output.index.files.find(row => row.name === 'quests/page-composition.json');
  const bytes = file === undefined ? undefined : await product.file('quests/page-composition.json');
  if (bytes === undefined) throw new Error('Missing bundled continuation');
  const page = v.parse(QuestPageSchema, JSON.parse(new TextDecoder().decode(bytes)));
  for (const bad of [
    { ...rows, owner: 'runtime', path: ['call'] },
    { ...rows, cosmetics: { ...rows.cosmetics, models: { hat: 4 } } },
    { ...rows, loot: { ...rows.loot, minimap: 'yes' } },
    { ...rows, collections: '../not-a-section?' },
  ]) expect(() => driftwoodJsonBlob('quests/page-composition.json', 'json', encode({ ...page, entryResources: { ...page.entryResources, continuation: bad } }))).toThrow('refuses its schema');
});

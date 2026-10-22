import { expect, test } from 'vitest';
import * as v from 'valibot';
import rows from '../src/shards/driftwood-isle/data/questContinuation.json' with { type: 'json' };
import { output } from '../src/shards/driftwood-isle/generators/output';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import { QuestContinuationSchema, parseQuestContinuationDocument } from '../src/format/questContinuation';
import { QuestPageSchema } from '../src/format/questPageComposition';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('the real product emits the admitted continuation with exact owner and cosmetic identities', () => {
  const files = output.namedFiles.filter(file => file.name === 'quests/page-composition.json');
  expect(files).toHaveLength(1);
  const file = files[0], bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined || file.jsonSchema === undefined) throw new Error('Missing defining continuation blob');
  expect(parseQuestContinuationDocument(validateNamedJsonSchema(file.jsonSchema, bytes))).toEqual(v.parse(QuestContinuationSchema, rows));
  expect(rows.cosmetics.models).toEqual({ hat: 'captainHat', cape: 'sailclothCape' });
  expect(rows.loot.before).toEqual(['body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world']);
  const names = new Set(output.namedFiles.map(row => row.name));
  expect(names.has(rows.cosmetics.file)).toBe(true); expect(names.has(rows.loot.shop)).toBe(true);
});

test('the defining named schema rejects reflected owners, wrong cosmetic ids and malformed loot flags', () => {
  const file = output.namedFiles.find(row => row.name === 'quests/page-composition.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing bundled continuation');
  const page = v.parse(QuestPageSchema, JSON.parse(new TextDecoder().decode(bytes)));
  for (const bad of [
    { ...rows, owner: 'runtime', path: ['call'] },
    { ...rows, cosmetics: { ...rows.cosmetics, models: { hat: 4 } } },
    { ...rows, loot: { ...rows.loot, minimap: 'yes' } },
    { ...rows, collections: '../not-a-section?' },
  ]) expect(() => driftwoodJsonBlob('quests/page-composition.json', 'json', encode({ ...page, entryResources: { ...page.entryResources, continuation: bad } }))).toThrow('refuses its schema');
});

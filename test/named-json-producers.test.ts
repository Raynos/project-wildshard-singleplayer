import { expect, test } from 'vitest';
import * as v from 'valibot';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { QuestPageCompositionSchema } from '../src/format/questPageComposition';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json';

test('named schema conversion refuses unrecognised author predicates', () => {
  expect(() => namedJsonSchema(v.pipe(v.number(), v.check(n => n === 7)))).toThrow('cannot be converted');
});

test('Driftwood page talks emit bounded structural named JSON', () => {
  expect(namedJsonSchema(QuestPageCompositionSchema)).toMatchObject({
    type: 'object', properties: { talks: { type: 'object', additionalProperties: false,
      properties: { models: { type: 'array', maxItems: 64 } } } },
  });
  const bytes = new TextEncoder().encode(JSON.stringify({ ...page, frames: {}, events: [], deaths: [] }));
  const blob = driftwoodJsonBlob('quests/page-composition.json', 'json', bytes);
  expect(blob.file).toMatchObject({ name: 'quests/page-composition.json', kind: 'json' });
  expect(new TextDecoder().decode(blob.bytes)).toBe(new TextDecoder().decode(bytes));
});

import { expect, test } from 'vitest';
import * as v from 'valibot';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { QuestPageCompositionSchema } from '../src/format/questPageComposition';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json';
import director from '../src/shards/driftwood-isle/data/director.json';
import stages from '../src/shards/driftwood-isle/data/finaleStages.json';
import { driftwoodDirector } from './fixtures/director-modules';

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

test('Driftwood named director admits its bounded raw file without relaxing strict metadata', () => {
  const module = { module: driftwoodDirector.module, bytes: '', file: 'behaviour/director.wasm' };
  const emit = (value: unknown) => driftwoodJsonBlob('directors/main.json', 'json', new TextEncoder().encode(JSON.stringify({ declaration: director, module: value, stages, bindings: null, seed: 357 })));
  expect(emit(module).file.name).toBe('directors/main.json');
  const { file, ...legacy } = module;
  expect(emit(legacy).file.name).toBe('directors/main.json');
  expect(() => emit({ ...module, file: '' })).toThrow('refuses its schema');
  expect(() => emit({ ...module, file: file.repeat(241) })).toThrow('refuses its schema');
  expect(() => emit({ ...module, extra: true })).toThrow('refuses its schema');
});

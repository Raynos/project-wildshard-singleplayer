import { expect, test } from 'vitest';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { worldSceneModels } from './worldScenes';

const model = {
  key: 'marker', id: 'author-scene/marker', name: 'Marker', category: 'props',
  pipeline: 'code', file: 'models/marker.ts', defaults: {},
  choices: [{ id: 'only', params: {}, size: [1, 2, 3], draws: [], colliders: [] }],
};

test('author model catalogues preserve every admitted field and default', () => {
  const input = { product: 'author-scene', models: [model] };
  expect(worldSceneModels(input)).toEqual(parseWorldSceneModels(input));
});

test('author model catalogues retain identity, finite data and callback refusals', () => {
  expect(() => worldSceneModels({ product: 'author-scene', models: [model, model] })).toThrow();
  expect(() => worldSceneModels({ product: 'other', models: [model] })).toThrow();
  expect(() => worldSceneModels({ product: 'author-scene', models: [model], callback: () => undefined })).toThrow();
  expect(() => worldSceneModels({ product: 'author-scene', models: [{ ...model, choices: [{ ...model.choices[0], size: [1, Number.NaN, 3] }] }] })).toThrow();
});

import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { wellRest, oilRest, placeFrames, placeRecipes, placeBindings } from '../src/shards/sunscar-dunes/generators/restScene';

test('direct rest recipes preserve every byte of the original metadata handoff', () => {
  const value = { well: wellRest().scene, oil: oilRest().scene, frames: placeFrames(), places: placeRecipes(), bindings: placeBindings() };
  const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  expect(bytes.length).toBe(29610);
  expect(hashImmutableBytes(bytes)).toBe('419f89dc363cb1d8cb7db82bf776b08c1a737ac4106b4d8f47221f332af89de9');
});

test('each rest binding call owns its recipe hierarchy and ordered brazier list', () => {
  const first = placeBindings(), second = placeBindings();
  const before = hashImmutableBytes(new TextEncoder().encode(JSON.stringify(second)));
  first.tower.recipe.scene.nodes.pop(); first.braziers.pop(); first.well.recipe.imports.pop();
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(second)))).toBe(before);
  expect(second.braziers.length).toBe(first.braziers.length + 1);
});

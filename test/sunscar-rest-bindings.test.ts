import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { placeBindings } from '../src/shards/sunscar-dunes/generators/restScene';

test('each rest binding call owns its recipe hierarchy and ordered brazier list', () => {
  const first = placeBindings(), second = placeBindings();
  const before = hashImmutableBytes(new TextEncoder().encode(JSON.stringify(second)));
  first.tower.recipe.scene.nodes.pop(); first.braziers.pop(); first.well.recipe.imports.pop();
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(second)))).toBe(before);
  expect(second.braziers.length).toBe(first.braziers.length + 1);
});

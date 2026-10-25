import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalPhysicsPlacements } from '../src/shards/sunscar-dunes/generators/physicsPlacements';

test('source placements retain every original camp, well, horse and brazier contact byte', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(signalPhysicsPlacements())}\n`);
  expect(bytes.length).toBe(4519);
  expect(hashImmutableBytes(bytes)).toBe('dc53caf1683fea1aa8e0117b93485ef09e6956fbd55b29846f0783e5ee8bd92f');
});

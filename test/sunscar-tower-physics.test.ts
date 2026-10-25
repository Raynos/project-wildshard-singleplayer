import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { signalTowerPhysicsPlacements } from '../src/shards/sunscar-dunes/generators/towerColliders';

test('source tower physics retains every original stair, rail, deck and contact byte', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(signalTowerPhysicsPlacements())}\n`);
  expect(bytes.length).toBe(4798);
  expect(hashImmutableBytes(bytes)).toBe('fd9796b48b293c9408a637fc0bc863da71a0009f3a95c55c1c0db6573af9439c');
});

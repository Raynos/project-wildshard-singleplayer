import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { restPools } from './fixtures/sunscar-source-program';

test('actual cached pool parts retain the complete original metadata without a JSON handoff', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(restPools)}\n`);
  expect(bytes.length).toBe(352);
  expect(hashImmutableBytes(bytes)).toBe('fc036acd87e6f40f786690872396cfcddcea5c93552880a829ece08b234ac984');
});

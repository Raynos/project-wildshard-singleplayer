import { expect, test } from 'vitest';
import { PINE_QUEST_TRANSACTIONS } from './fixtures/pine-quest-transactions';
import { parseQuestPageInteractions } from '../src/format/questInteractions';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';

// Frozen from the published callbacks before the shared trader/board adoption.
// Keep this baseline independent of the current product and payout dispatcher.
test('retired page transaction fixtures retain their original published bytes', () => {
  const rows = parseQuestPageInteractions(PINE_QUEST_TRANSACTIONS);
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(rows))))
    .toBe('891ccf64742a1e21d5e75705d91c393e784215317a5dc522da779c37f48be04b');
});

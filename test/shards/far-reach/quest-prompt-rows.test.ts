import { expect, it } from 'vitest';
import { QUEST_STEP, ROOST_IDS, SKY_ACT, SKY_INTERACT, SKY_SPOTS } from '../../../src/shards/far-reach/data/questPrompts';
import { DECK, NOTES, WINCH } from '../../../src/shards/far-reach/data/layout';
import { KEEPER_AT } from '../../../src/shards/far-reach/data/quests';

it('persists shipping command identities, ordered roost and all native prompt points and radii', () => {
  expect({ QUEST_STEP, SKY_ACT, SKY_INTERACT, ROOST_IDS }).toStrictEqual({ QUEST_STEP: 'far.quest',
    SKY_ACT: { talk: 0, notes: 1, winch: 2 }, SKY_INTERACT: 'far.interact', ROOST_IDS: ['far.roost.0', 'far.roost.1', 'far.roost.2'] });
  expect(SKY_SPOTS).toStrictEqual([
    { id: 'keeper', x: KEEPER_AT.x, y: DECK + 1.8, z: KEEPER_AT.z, radius: 3.5 },
    { id: 'notes', x: NOTES.x, y: NOTES.y + 1.3, z: NOTES.z, radius: 2.6 },
    { id: 'winch', x: WINCH.x, y: WINCH.y + 1.2, z: WINCH.z, radius: 3 },
  ]);
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Persisted JSON is the authored row contract under test.
  expect(JSON.parse(JSON.stringify(SKY_SPOTS))).toStrictEqual(SKY_SPOTS);
});

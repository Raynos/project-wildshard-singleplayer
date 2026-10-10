// Shipping Wendell dialogue captured unchanged from 574a193f37d38a2f8d09f02d22db7264ca725f08; figure/rig stays with the page.
import type { NpcDef } from '../../../src/engine/quest/core';
import { SHARD_FLAGS } from '../../../src/shards/driftwood-isle/quest/interactables';
const QUEST_DONE = 'quest:driftwood-done';

export const SHIPPING_CASTAWAY: NpcDef = {
  id: 'castaway',
  name: 'Wendell, castaway',
  dialogue: [
    { when: { all: [QUEST_DONE] }, lines: [
      'Did you see it? The planet, right in the ring! Forty years at sea and I never saw a thing like it.',
      'Stay as long as you like, friend.', // E318: no "the boat's still at the pier" — the boat does not sail
    ] },
    { when: { all: ['dead:captain'] }, lines: [
      'You beat old Captain Brine? Then the ring is open. Go on — stand in it before the sun sets.',
    ] },
    { when: { all: ['used:altar'] }, lines: [
      'That roar — that was the Captain! He sank with the ring\'s secret. Hit him when he surfaces, not before.',
    ] },
    { when: { all: [...SHARD_FLAGS] }, lines: [
      'All three shards! I can feel them humming from here.',
      'The Ring Shrine is north-west, through the jungle. Set them in the altar — and have your sword ready. Good doors always have something guarding them.',
    ] },
    { when: { all: ['talked:castaway'] }, lines: [
      'The shards: one at the lookout on the headland, one in the wreck\'s hold, one in the sea cave by the waterfall.',
      'The flint for the beacon is in my sea chest. The drowned sailor keeps the hold key on him. And the cave\'s tide gate? Two plates — you\'ll want something heavy for the second one.',
    ] },
    { lines: [
      'A visitor! A real, walking, talking, not-a-crab visitor!',
      'Name\'s Wendell. Marooned here since the Gull\'s Lament broke up in the cove.',
      'See the great stone ring in the north-west jungle? It\'s a door, sealed with three glyph shards. I found the altar, but not the shards.',
      'One\'s up at the lookout, one\'s in the wreck\'s hold, one\'s in the sea cave under the waterfall. Bring them to the ring and we\'ll see what it opens.',
      'Take the flint and steel from my sea chest inside — the lookout beacon will want lighting. And mind the drowned sailor in the wreck.',
    ], sets: ['talked:castaway'] },
  ],
};

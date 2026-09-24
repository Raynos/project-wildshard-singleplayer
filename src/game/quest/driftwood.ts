/**
 * Driftwood Isle's quest and its castaway — pure data (D5: castaway + three glyph shards → Ring Shrine → the Drowned
 * Captain → the golden-hour reward view). The flags it reads are raised by the interactables table
 * (src/world/interact/driftwood.ts) and by Adventure.ts (`talked:castaway` when the dialogue ends, `dead:sailor` /
 * `dead:captain` on the kills, `seen:reward` after the reward view).
 */
import { SHARD_FLAGS } from '../../world/interact/driftwood';
import type { NpcDef, QuestDef } from './quest';

export const QUEST_DONE = 'quest:driftwood-done';

export const DRIFTWOOD_QUEST: QuestDef = {
  id: 'sealed-ring',
  title: 'The Sealed Ring',
  startWhen: { all: ['talked:castaway'] },
  intro: {
    objective: 'Find out who lit the fire on the plateau',
    chip: 'Who lit the fire?',
    hint: 'Follow the sand path up from the pier',
    markers: [{ id: 'castaway', label: 'CASTAWAY', short: 'CASTAWAY', at: { poi: 'hut', x: 2.4, z: -8.2 } }],
  },
  steps: [
    {
      id: 'shards',
      objective: 'Recover the glyph shards · {n} / {of}',
      chip: 'Glyph shards',
      hint: 'The lookout · the wreck\'s hold · the sea cave',
      count: [...SHARD_FLAGS],
      done: { all: [...SHARD_FLAGS] },
      markers: [
        { id: 'lookout', label: 'LOOKOUT SHARD', short: 'LOOKOUT', at: { poi: 'lookout', x: 0, z: 0 }, hideWhen: { all: ['shard:lookout'] } },
        { id: 'wreck', label: 'WRECK SHARD', short: 'WRECK', at: { poi: 'wreck', x: 0, z: 2 }, hideWhen: { all: ['shard:wreck'] } },
        { id: 'cave', label: 'SEA CAVE SHARD', short: 'SEA CAVE', at: { poi: 'cave', x: 0, z: -3 }, hideWhen: { all: ['shard:cave'] } },
      ],
    },
    {
      id: 'shrine',
      objective: 'Set the shards in the Ring Shrine',
      chip: 'Set the shards',
      hint: 'North-west, through the jungle',
      done: { all: ['used:altar'] },
      markers: [{ id: 'shrine', label: 'RING SHRINE', short: 'RING SHRINE', at: { poi: 'shrine', anchor: 'shrine.altar', x: 0, z: 2.4 } }],
    },
    {
      id: 'captain',
      objective: 'Defeat the Drowned Captain',
      chip: 'Defeat the captain',
      hint: 'Strike when he surfaces',
      done: { all: ['dead:captain'] },
      markers: [{ id: 'captain', label: 'THE DROWNED CAPTAIN', short: 'CAPTAIN', at: { poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 9 } }],
    },
    {
      id: 'reward',
      objective: 'Stand in the ring',
      chip: 'Stand in the ring',
      hint: 'The sun is going down',
      done: { all: ['seen:reward'] },
      markers: [{ id: 'ring', label: 'THE RING', short: 'THE RING', at: { poi: 'shrine', anchor: 'shrine.reward', x: 0, z: 6 } }],
    },
  ],
  completeFlag: QUEST_DONE,
};

/** the flags the quest reads that come from Adventure.ts, not the table */
export const QUEST_EXTERNAL = ['talked:castaway', 'dead:sailor', 'dead:captain', 'seen:reward'];

export const CASTAWAY: NpcDef = {
  id: 'castaway',
  name: 'Wendell, castaway',
  dialogue: [
    { when: { all: [QUEST_DONE] }, lines: [
      'Did you see it? The planet, right in the ring! Forty years at sea and I never saw a thing like it.',
      'Stay as long as you like, friend. The boat\'s still at the pier when you want it.',
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

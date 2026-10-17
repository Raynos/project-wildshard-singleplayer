import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { ANTLER_KING_FIGHT } from '../data/kingFight';
import { KING_FX_LOOKS } from './kingFxLook';
import { KINGS_CLEARING, BEAR_CAVE } from '../data/layout';
import { WILDLIFE_LOOK } from './wildlifeLook';

import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import { SPRAY_LOOK } from './streamLook';
import people from '../data/questNpcs.generated.json' with { type: 'json' };

import { FINISH_CARDS } from './finishCards';

import SPRAY_PUFFS from '../data/sprayPuffs.json' with { type: 'json' };


/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
  defineMirror('SPRAY_PUFFS', SPRAY_PUFFS),
  defineMirror('FINISH_CARDS', FINISH_CARDS),
  defineMirror('BEAR_CAVE', BEAR_CAVE),
  defineMirror('NPC_NAMES', Object.fromEntries(people.rows.map(row => [row.npc.id, row.npc.name]))),
  defineMirror('CRAG_LOOK', CRAG_LOOK),
  defineMirror('CAVE_LOOK', CAVE_LOOK),
  defineMirror('SPRAY_LOOK', SPRAY_LOOK),
  defineMirror('KINGS_CLEARING', KINGS_CLEARING),
  defineMirror('KING_ARENA_FOG', ANTLER_KING_FIGHT.arena.fog),
  defineMirror('KING_FX_LOOKS', KING_FX_LOOKS),
  defineMirror('WILDLIFE_LOOK', WILDLIFE_LOOK),
];

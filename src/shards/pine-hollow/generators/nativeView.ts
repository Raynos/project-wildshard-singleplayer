import { ANTLER_KING_FIGHT } from './kingFight';
import { KING_FX_LOOKS } from './kingFxLook';
import { KINGS_CLEARING, BEAR_CAVE } from '../data/layout';
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import { SPRAY_LOOK } from './streamLook';
import SPRAY_PUFFS from '../data/sprayPuffs.json' with { type: 'json' };

/** World-only view data, read from the admitted product before its builders run. */
export const NATIVE_VIEW = { KINGS_CLEARING, BEAR_CAVE, KING_ARENA_FOG: ANTLER_KING_FIGHT.arena.fog,
  KING_FX_LOOKS, CRAG_LOOK, CAVE_LOOK, SPRAY_LOOK, SPRAY_PUFFS };

import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { ANTLER_KING_FIGHT } from './kingFight';
import { KING_FX_LOOKS } from './kingFxLook';
import { KINGS_CLEARING, BEAR_CAVE } from './layout';
import { WILDLIFE_LOOK } from './wildlifeLook';
import { LEVER_WEAPON_PROFILE } from './leverProfile';
import { BUCKSKIN, COAT_MATERIAL, HANDS_MATERIAL, HUNTER_HANDS } from './handsLook';

import { NPC_FIGURE } from './peopleLook';
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import { SPRAY_LOOK } from './streamLook';
import HOLLOW_LOG_SHAPE from './hollowLog.json' with { type: 'json' };
import { RANGER_DIALOGUE, MILLER_DIALOGUE, TRADER_DIALOGUE } from './wardensHollow';

import { ARROW_MATERIAL, LONGBOW_ARROW, LONGBOW_MATERIAL, LONGBOW_POSES } from './longbowLook';
import { BOW_PROFILE } from './bowProfile';
import { FINISH_CARDS } from './finishCards';

import { KNIFE_LOOK } from './skinningKnifeLook';
import CROSSBOW_DISPLAY_REST from './crossbowDisplay.json' with { type: 'json' };
import SPRAY_PUFFS from './sprayPuffs.json' with { type: 'json' };


/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
  defineMirror('KNIFE_LOOK', KNIFE_LOOK),
  defineMirror('CROSSBOW_DISPLAY_REST', CROSSBOW_DISPLAY_REST),
  defineMirror('SPRAY_PUFFS', SPRAY_PUFFS),
  defineMirror('ARROW_MATERIAL', ARROW_MATERIAL),
  defineMirror('LONGBOW_ARROW', LONGBOW_ARROW),
  defineMirror('LONGBOW_MATERIAL', LONGBOW_MATERIAL),
  defineMirror('LONGBOW_POSES', LONGBOW_POSES),
  defineMirror('ARROW_FLIGHT', BOW_PROFILE.flight),
  defineMirror('ARROW_MAX_FLYING', BOW_PROFILE.pool),
  defineMirror('FINISH_CARDS', FINISH_CARDS),
  defineMirror('BEAR_CAVE', BEAR_CAVE),
  defineMirror('HOLLOW_LOG_SHAPE', HOLLOW_LOG_SHAPE),
  defineMirror('NPC_FIGURE', NPC_FIGURE),
  defineMirror('NPC_NAMES', { ranger: RANGER_DIALOGUE.name, miller: MILLER_DIALOGUE.name, trader: TRADER_DIALOGUE.name }),
  defineMirror('CRAG_LOOK', CRAG_LOOK),
  defineMirror('CAVE_LOOK', CAVE_LOOK),
  defineMirror('SPRAY_LOOK', SPRAY_LOOK),
  defineMirror('KINGS_CLEARING', KINGS_CLEARING),
  defineMirror('KING_ARENA_FOG', ANTLER_KING_FIGHT.arena.fog),
  defineMirror('KING_FX_LOOKS', KING_FX_LOOKS),
  defineMirror('WILDLIFE_LOOK', WILDLIFE_LOOK),
  defineMirror('LEVER_AUTO_RELOAD_CLOSE', LEVER_WEAPON_PROFILE.lever.autoReloadClose),
  defineMirror('BUCKSKIN', BUCKSKIN),
  defineMirror('HUNTER_HANDS', HUNTER_HANDS),
  defineMirror('HANDS_MATERIAL', HANDS_MATERIAL),
  defineMirror('COAT_MATERIAL', COAT_MATERIAL),
];

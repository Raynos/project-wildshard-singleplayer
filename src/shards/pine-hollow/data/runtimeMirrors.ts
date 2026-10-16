import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { ANTLER_KING_FIGHT } from './kingFight';
import { KING_FX_LOOKS } from './kingFxLook';
import { KINGS_CLEARING, BEAR_CAVE } from './layout';
import lookMaterials from './lookMaterials.generated.json' with { type: 'json' };
import { WILDLIFE_LOOK } from './wildlifeLook';
import { LEVER_WEAPON_PROFILE } from './leverProfile';
import { BUCKSKIN, COAT_MATERIAL, HANDS_MATERIAL, HUNTER_HANDS } from './handsLook';

import { NPC_FIGURE } from './peopleLook';
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import { SPRAY_LOOK } from './streamLook';
import HOLLOW_LOG_SHAPE from './hollowLog.json' with { type: 'json' };
import { RANGER_DIALOGUE, MILLER_DIALOGUE, TRADER_DIALOGUE } from './wardensHollow';

/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
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
  defineMirror('PINE_RUNTIME_GRAPHS', lookMaterials.runtime),
  defineMirror('WILDLIFE_LOOK', WILDLIFE_LOOK),
  defineMirror('LEVER_AUTO_RELOAD_CLOSE', LEVER_WEAPON_PROFILE.lever.autoReloadClose),
  defineMirror('BUCKSKIN', BUCKSKIN),
  defineMirror('HUNTER_HANDS', HUNTER_HANDS),
  defineMirror('HANDS_MATERIAL', HANDS_MATERIAL),
  defineMirror('COAT_MATERIAL', COAT_MATERIAL),
];

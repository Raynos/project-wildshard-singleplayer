import { KING_RIG, KING_BONES } from './kingRig';
import rigBlend from '../data/kingBlend.json' with { type: 'json' };
import rigClips from '../data/kingClips.generated.json' with { type: 'json' };
import bossCollision from '../data/kingCollision.generated.json' with { type: 'json' };
import { ANTLER_KING_FIGHT, ANTLER_KING_BOSS_PROFILE } from './kingFight';
import bossRows from '../data/bossEncounter.json' with { type: 'json' };
import bossPresentation from '../data/bossPresentation.json' with { type: 'json' };
import { parseRoamingEncounter } from '@wildshard/format/bossEncounter';
import { KING_FX_LOOKS } from './kingFxLook';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import { SPRAY_LOOK } from './streamLook';
import SPRAY_PUFFS from '../data/sprayPuffs.json' with { type: 'json' };
import KING_CUES from '../data/kingCues.json' with { type: 'json' };

/** World-only view data, read from the admitted product before its builders run. */
export const NATIVE_VIEW = { QUADRUPED: { spec: KING_RIG, bones: KING_BONES, blend: rigBlend, clips: rigClips, collision: bossCollision }, KINGS_CLEARING: LAYOUT.KINGS_CLEARING, BEAR_CAVE: LAYOUT.BEAR_CAVE, KING_ARENA_FOG: ANTLER_KING_FIGHT.arena.fog,
  BOSS_RIBS: bossCollision.volumes.ribs, BOSS_ENCOUNTER: parseRoamingEncounter(bossRows, ANTLER_KING_BOSS_PROFILE), BOSS_PRESENTATION: bossPresentation,
  KING_FX_LOOKS, KING_CUES, CRAG_LOOK, CAVE_LOOK, SPRAY_LOOK, SPRAY_PUFFS };

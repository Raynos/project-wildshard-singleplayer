import { AUDIO } from './audio';
import { SKY_DIRECTORS } from './rocFight';
import { QUEST_HOST } from './questHost';
import { QUEST_NPC } from './questNpc';
import { SKY_MODES } from './modes';
import { SKY_QUESTS } from './quests';
import { SKY_LEDGER } from './ledger';
import { SKY_STATE } from './state';
import { SKY_ITEMS } from './items';

/** Complete authored behaviour sections, consumed directly by the project compiler. */
export const SKY_SECTIONS = { audio: AUDIO, directors: SKY_DIRECTORS, modes: SKY_MODES, quests: SKY_QUESTS,
  questNpcs: [QUEST_NPC], questHost: QUEST_HOST, ledger: SKY_LEDGER, state: SKY_STATE, items: SKY_ITEMS } as const;

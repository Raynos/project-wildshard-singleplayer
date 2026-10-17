import { AUDIO } from '../data/audio';
import { SKY_DIRECTORS } from '../data/rocFight';
import { QUEST_HOST } from './questHost';
import { QUEST_NPC } from './questNpc';
import { SKY_MODES } from '../data/modes';
import { SKY_QUESTS } from './quests';
import { SKY_LEDGER } from '../data/ledger';
import { SKY_STATE } from '../data/state';
import { SKY_ITEMS } from '../data/items';

/** Complete authored behaviour sections, consumed directly by the project compiler. */
export const SKY_SECTIONS = { audio: AUDIO, directors: SKY_DIRECTORS, modes: SKY_MODES, quests: SKY_QUESTS,
  questNpcs: [QUEST_NPC], questHost: QUEST_HOST, ledger: SKY_LEDGER, state: SKY_STATE, items: SKY_ITEMS } as const;

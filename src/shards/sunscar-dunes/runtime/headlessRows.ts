import { SIGNAL_OWNER_ROWS } from '../data/hostOwners';
import { MATRIARCH_BOSS_PROFILE } from '../data/matriarchBoss';
import type { RowsHeadlessManifest } from './rowsHeadless';
import { SIGNAL_SPAWNS } from '../data/spawns';
import { MATRIARCH_DEFINITION, MATRIARCH_RECORD, MATRIARCH_REWARD } from '../data/matriarchEncounter';
import { MATRIARCH_PRESENTATION } from './quest/matriarchFight';
import { FACT, MATRIARCH_FLAG } from '../data/signalQuest';
import { SIGNAL_INTERACTIONS } from '../data/signalInteractions';
import { SCOUT_NPC } from '../quests/scout';
import { SIGNAL_GRAPH } from '../data/signalGraph';

const matriarch = SIGNAL_SPAWNS.bosses[0];
if (matriarch === undefined) throw new Error('Signal Dunes declares the Matriarch\'s boss row');
/**
 * Signal Dunes' renderer-free host as rows (SF27, `@wildshard/sdk/rowsHeadless`), beside the baked metadata and the
 * species catalogue the runtime adds: the 13 declared homes at the browser's 'legacy' decision band (10 Hz decisions,
 * bodies every frame), the ray (home 0) circling without striking until the player has met Sefa (R1B-13); the Dune
 * Matriarch's marked fight, her body in the basin, a death returning the player to the south rim, her fall raising the
 * quest's last flag and her fact; the whip's lash (it leaves from the player's eye, 1.68 m, with the browser Bullwhip's
 * timing and moves); "The signal"'s quest graph; and the entry walk, 23 lanes 50 m in from 249.55 m within 600 steps.
 */
export const SIGNAL_HEADLESS: Omit<RowsHeadlessManifest, 'baked' | 'homes'> & { readonly homes: Omit<RowsHeadlessManifest['homes'], 'species' | 'strikes' | 'modules'> } = {
  ...SIGNAL_OWNER_ROWS,
  boss: { row: matriarch, definition: MATRIARCH_DEFINITION, profile: MATRIARCH_BOSS_PROFILE, record: MATRIARCH_RECORD, reward: MATRIARCH_REWARD,
    floor: MATRIARCH_PRESENTATION.floor, respawn: MATRIARCH_PRESENTATION.respawn, victory: { flag: MATRIARCH_FLAG, fact: FACT.matriarch } },
  quest: { interactions: SIGNAL_INTERACTIONS, npcs: [SCOUT_NPC], graph: SIGNAL_GRAPH },
};

import type { RowsHeadlessManifest } from '@wildshard/sdk/rowsHeadless';
import { SEED } from './layout';
import { SIGNAL_SPAWNS } from './spawns';
import { WHIP_MOVES, WHIP_TIMING } from './items';
import { SCOUT_FLAG } from './flags';
import { MATRIARCH_DEFINITION, MATRIARCH_FIGHT, MATRIARCH_PRESENTATION, MATRIARCH_RECORD, MATRIARCH_REWARD } from './matriarchFight';
import { FACT, MATRIARCH_FLAG } from '../quests/signal';
import { SIGNAL_INTERACTIONS } from '../quests/interactions';
import { SCOUT_NPC } from '../quests/scout';
import { SIGNAL_GRAPH } from '../quests/graph';

/** The declared whip row's id (data/items.ts). */
export const WHIP_ID = 'weapon.sunscar-whip';
/** The whip's fixed-step id (its lash and aim continuation). */
export const WHIP_STEP = `item.${WHIP_ID}`;
/** `fight.attackers` in manifest.ts (E297); the headless test holds the two equal (the manifest itself imports views). */
export const SIGNAL_ATTACKERS = 2;
/** The homes keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const HOMES_STEP = 'sunscar.homes';

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
  homes: { step: HOMES_STEP, seed: SEED, rows: SIGNAL_SPAWNS.homes, attackers: SIGNAL_ATTACKERS, think: { every: 6, dt: 0.1 },
    contact: { prefix: 'sunscar.', suffix: '.contact' }, holds: [{ home: 0, field: 'held', until: SCOUT_FLAG }] },
  boss: { row: matriarch, definition: MATRIARCH_DEFINITION, fight: MATRIARCH_FIGHT, record: MATRIARCH_RECORD, reward: MATRIARCH_REWARD,
    floor: MATRIARCH_PRESENTATION.floor, respawn: MATRIARCH_PRESENTATION.respawn, victory: { flag: MATRIARCH_FLAG, fact: FACT.matriarch } },
  lash: { id: WHIP_ID, step: WHIP_STEP, timing: WHIP_TIMING, moves: WHIP_MOVES, eye: 1.68 },
  quest: { interactions: SIGNAL_INTERACTIONS, npcs: [SCOUT_NPC], graph: SIGNAL_GRAPH },
  entries: { lanes: 23, walk: 50, start: 249.55, maxTicks: 600 },
};

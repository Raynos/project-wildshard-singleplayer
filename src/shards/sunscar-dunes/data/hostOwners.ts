import { SEED } from './layout';
import { SIGNAL_SPAWNS } from './spawns';
import { WHIP_ITEM, WHIP_PROFILE } from './items';
import { SCOUT_FLAG } from './flags';

/** The admitted item owns its stable player-contact identity. */
export const WHIP_ID = WHIP_ITEM.id;
/** The lash and aim continuation's fixed-step identity. */
export const WHIP_STEP = `item.${WHIP_ID}`;
/** The shipping home's simultaneous contact budget, matching manifest.fight.attackers. */
export const SIGNAL_ATTACKERS = 2;
/** The home's roster and clock continuation identity. */
export const HOMES_STEP = 'sunscar.homes';
/** Native owner parameters: homes in authored order, decision band, contact names, held ray, lash and entry walks. */
export const SIGNAL_OWNER_ROWS = {
  homes: { step: HOMES_STEP, seed: SEED, rows: SIGNAL_SPAWNS.homes, attackers: SIGNAL_ATTACKERS, think: { every: 6, dt: 0.1 },
    contact: { prefix: 'sunscar.', suffix: '.contact' }, holds: [{ home: 0, field: 'held', until: SCOUT_FLAG }] },
  lash: { id: WHIP_ID, step: WHIP_STEP, profile: WHIP_PROFILE, eye: 1.68 },
  entries: { lanes: 23, walk: 50, start: 249.55, maxTicks: 600 },
};

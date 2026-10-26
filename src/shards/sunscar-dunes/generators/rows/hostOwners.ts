import * as LAYOUT from '../layout';
import { SIGNAL_SPAWNS } from './spawns';
import { WHIP_ITEM, WHIP_PROFILE } from './items';
import { SCOUT_FLAG } from './flags';

type StepIdentity = string;

/** The admitted item owns its stable player-contact identity. */
export const WHIP_ID: "weapon.sunscar-whip" = WHIP_ITEM.id;
/** The lash and aim continuation's fixed-step identity. */
export const WHIP_STEP: StepIdentity = `item.${WHIP_ID}`;
/** The shipping home's simultaneous contact budget, matching manifest.fight.attackers. */
export const SIGNAL_ATTACKERS = 2;
/** The home's roster and clock continuation identity. */
export const HOMES_STEP = 'sunscar.homes';
/** Native owner parameters: homes in authored order, decision band, contact names, held ray, lash and entry walks. */
export const SIGNAL_OWNER_ROWS: { homes: { step: string; seed: number; rows: typeof SIGNAL_SPAWNS.homes; attackers: number; think: { every: number; dt: number; }; contact: { prefix: string; suffix: string; }; holds: { home: number; field: string; until: string; }[]; }; lash: { id: "weapon.sunscar-whip"; step: string; profile: { readonly family: "lash"; readonly contact: { readonly chestHeight: 0.9; readonly bodyAllowance: 0.7; }; readonly timing: { readonly unroll: 0.12; readonly second: 0.32; readonly show: 0.42; readonly stagger: 0.8; readonly pull: 16; readonly pullMaxHp: 40; }; readonly moves: { readonly light: "sunscar.whip.crack"; readonly first: "sunscar.whip.double.1"; readonly second: "sunscar.whip.double.2"; }; }; eye: number; }; entries: { lanes: number; walk: number; start: number; maxTicks: number; }; } = {
  homes: { step: HOMES_STEP, seed: LAYOUT.SEED, rows: SIGNAL_SPAWNS.homes, attackers: SIGNAL_ATTACKERS, think: { every: 6, dt: 0.1 },
    contact: { prefix: 'sunscar.', suffix: '.contact' }, holds: [{ home: 0, field: 'held', until: SCOUT_FLAG }] },
  lash: { id: WHIP_ID, step: WHIP_STEP, profile: WHIP_PROFILE, eye: 1.68 },
  entries: { lanes: 23, walk: 50, start: 249.55, maxTicks: 600 },
};

/** The page uses the same held-ray memory row at its original update phase. */
export const SIGNAL_PAGE_HOLDS: { system: string; rows: { home: number; field: string; until: string; }[]; } = { system: 'sunscar.ray', rows: SIGNAL_OWNER_ROWS.homes.holds };

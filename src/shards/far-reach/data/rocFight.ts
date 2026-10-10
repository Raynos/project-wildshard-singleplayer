import { CROWN, DAIS, FALLEN_BRIDGE } from './layout';
import { STRINGS } from './strings';

/** The Storm Roc's encounter id (its boss row, its ledger fact's actor, its saved body). */
export const ROC_ID = 'far.roc';
/** The Roc's health share at each checkpoint, so where phases 2 and 3 begin. */
export const PHASES = [1, 0.66, 0.33] as const;
/** The Roc's purse: coins paid on its first fall (the quest's reward is separate). */
export const BOSS_REWARD = 25;

/** The encounter's card, phases and retry title; the browser's StormRocBoss and the headless runtime build the same one. */
export const ROC_DEFINITION = { id: ROC_ID, name: STRINGS.roc, title: STRINGS.rocTitle, retryTitle: STRINGS.rocRetry, intro: 1.5, introShort: 0.3,
  phases: [{ at: PHASES[0], caption: STRINGS.rocP1, name: STRINGS.rocP1 }, { at: PHASES[1], caption: STRINGS.rocP2, name: STRINGS.rocP2 }, { at: PHASES[2], caption: STRINGS.rocP3, name: STRINGS.rocP3 }],
  reward: {} };

/**
 * The Storm Roc's fight as a held boss fight (SF27): its arena is the crown (inside 90 % of its radius, above 2 m under
 * its top); the intro looks at, and the victory pays out over, the dais; a player who dies in the fight comes back at the
 * fallen bridge's crown landing, 2 m back, facing in.
 */
export const ROC_FIGHT = { arena: { x: CROWN.x, z: CROWN.z, r: CROWN.r * 0.9, floor: CROWN.y - 2 }, hpShares: PHASES,
  rewardPoint: { x: DAIS.x, y: CROWN.y + DAIS.h, z: DAIS.z }, respawn: { x: FALLEN_BRIDGE.x1, y: CROWN.y + 0.2, z: FALLEN_BRIDGE.z1 - 2, yaw: 0 } };

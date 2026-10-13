import { parseBossOwnerRow, type BossOwnerRow } from '@wildshard/format/bossProfiles';
import bossStages from './bossStages.json' with { type: 'json' };
import { SIGNAL_OWNER_ROWS } from './hostOwners';
import { MATRIARCH_BOSS_PROFILE } from './matriarchBoss';
import { SIGNAL_SPAWNS } from './spawns';
import { MATRIARCH_DEFINITION, MATRIARCH_RECORD, MATRIARCH_REWARD, MATRIARCH_ARENA } from './matriarchEncounter';
import { FACT, MATRIARCH_FLAG } from './signalQuest';

const matriarch = SIGNAL_SPAWNS.bosses[0];
if (matriarch === undefined) throw new Error('Signal Dunes declares the Matriarch\'s boss row');
/**
 * Signal Dunes' renderer-free host declarations, beside the baked metadata and the
 * species catalogue the runtime adds: the 13 declared homes at the browser's 'legacy' decision band (10 Hz decisions,
 * bodies every frame), the ray (home 0) circling without striking until the player has met Sefa (R1B-13); the Dune
 * Matriarch's marked fight, her body in the basin, a death returning the player to the south rim, her fall raising the
 * quest's last flag and her fact; the whip's lash (it leaves from the player's eye, 1.68 m, with the browser Bullwhip's
 * timing and moves); "The signal"'s quest graph; and the entry walk, 23 lanes 50 m in from 249.55 m within 600 steps.
 */
export const SIGNAL_HEADLESS = {
  ...SIGNAL_OWNER_ROWS,
  boss: { row: matriarch, definition: MATRIARCH_DEFINITION, profile: MATRIARCH_BOSS_PROFILE, record: MATRIARCH_RECORD, reward: MATRIARCH_REWARD,
    ...MATRIARCH_ARENA, victory: { flag: MATRIARCH_FLAG, fact: FACT.matriarch } },
};

/** Native Matriarch stage/record/effect binding; the keeper lends its actual body. */
export const SIGNAL_BOSS_OWNER: BossOwnerRow = parseBossOwnerRow({
  step: matriarch.id, actor: matriarch.id, profile: MATRIARCH_BOSS_PROFILE,
  definition: MATRIARCH_DEFINITION, stages: bossStages, armed: false,
  record: MATRIARCH_RECORD, victory: { flag: MATRIARCH_FLAG, fact: FACT.matriarch, once: false },
  reward: { when: 'claim', amount: MATRIARCH_REWARD },
  placement: { rewardPoint: { x: matriarch.at[0], y: MATRIARCH_ARENA.floor, z: matriarch.at[1] },
    respawn: MATRIARCH_ARENA.respawn },
});

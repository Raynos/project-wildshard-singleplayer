import stages from './bossStages.json' with { type: 'json' };
import { ROC_DEFINITION, ROC_BOSS_PROFILE, ROC_ID, BOSS_REWARD } from './rocFight';
import { FLAGS } from '../quest/flags';
import { STRINGS } from './strings';
import { SKY_RIG_LIBRARY } from './rigLibrary';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES, SKY_PAGE_ROWS, SKY_PAGE_HOMES } from './brains';
import { SKY_FLOCK_ROWS, SKY_FLOCK_PLACEMENT, SKY_KILL_Y, FLOCK_STEP, SKY_FLOCK_GROUPS, SKY_PAGE_HELD, SKY_PAGE_BODY_HOMES } from './spawns';

/** The same authored catalogue enters page and native hosts; each keeps its original phase and lifetime. */
const program = { species: SKY_CREATURE_ROWS, strikes: SKY_CREATURE_STRIKES };
export const SKY_PAGE_PROGRAM = { species: { program, page: SKY_PAGE_ROWS, homes: SKY_PAGE_HOMES, shove: true, library: SKY_RIG_LIBRARY },
  population: { system: 'far.creatures', held: SKY_PAGE_HELD, bodyHomes: SKY_PAGE_BODY_HOMES, groups: SKY_FLOCK_GROUPS,
    witness: { groups: ['rays', 'roost', 'goats', 'wisps'] } },
  inspect: { actors: { roc: { held: ROC_ID } }, roster: 'kept', boss: 'boss' },
  fight: { id: ROC_ID, definition: ROC_DEFINITION, stages, profile: ROC_BOSS_PROFILE, reward: BOSS_REWARD,
    victory: { flag: FLAGS.roc, fact: 'far-reach.roc', once: true, again: STRINGS.rocDown, rewardLabel: STRINGS.bossReward } },
} as const;
export const SKY_NATIVE_POPULATION = { program, step: FLOCK_STEP, seed: 6417, admission: 'install',
  homes: SKY_FLOCK_ROWS.map(row => ({ id: row.id, kind: row.kind, at: row.at, yaw: row.yaw, respawn: 0, late: 'ground' as const })),
  attackers: null, think: 'legacy', killY: SKY_KILL_Y, placement: SKY_FLOCK_PLACEMENT } as const;

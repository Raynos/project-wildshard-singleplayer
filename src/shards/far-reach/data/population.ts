import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES, SKY_PAGE_ROWS, SKY_PAGE_HOMES } from './brains';
import { SKY_FLOCK_ROWS, SKY_FLOCK_PLACEMENT, SKY_KILL_Y, FLOCK_STEP } from './spawns';

/** The same authored catalogue enters page and native hosts; each keeps its original phase and lifetime. */
const program = { species: SKY_CREATURE_ROWS, strikes: SKY_CREATURE_STRIKES };
export const SKY_PAGE_PROGRAM = { program, page: SKY_PAGE_ROWS, homes: SKY_PAGE_HOMES, shove: true } as const;
export const SKY_NATIVE_POPULATION = { program, step: FLOCK_STEP, seed: 6417, admission: 'install',
  homes: SKY_FLOCK_ROWS.map(row => ({ id: row.id, kind: row.kind, at: row.at, yaw: row.yaw, respawn: 0, late: 'ground' as const })),
  attackers: null, think: 'legacy', killY: SKY_KILL_Y, placement: SKY_FLOCK_PLACEMENT } as const;

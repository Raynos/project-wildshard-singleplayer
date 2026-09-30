/**
 * Driftwood Isle's live models (E306 / E315 M5, `ChunkDef.roster`): every creature the island can spawn — its fauna's
 * deer, boars and bears, the reef crabs, the coconut monkeys, the Drowned Sailor, the Drowned Captain (before he rises
 * too), the gulls — its people and the gear its player holds. Listed in the Model Explorer at boot (src/models/roster.ts);
 * the island keeps spawning and drawing every copy as before.
 */
import { live, type RosterEntry } from '../../models/live';
import { bear, boar, deer } from '../../models/creatures';
import { coconutMonkey, drownedCaptain, drownedSailor, gull, reefCrab } from './models/creatures';
import { castaway } from './models/people';
import { GEAR } from './models/gear';

export const ROSTER: readonly RosterEntry[] = [
  // the fauna (driftwood-isle.ts `fauna`), faceted low-poly in code here
  live(boar, { pipeline: 'code' }), live(bear, { pipeline: 'code' }), live(deer, { pipeline: 'code' }),
  // the enemies (src/entities/Enemies.ts) and the boss (src/game/quest/Finale.ts)
  live(reefCrab), live(coconutMonkey), live(drownedSailor), live(drownedCaptain),
  // the gulls (src/world/Gulls.ts: ≤ 36, one instanced draw)
  live(gull, { copies: 36, drawnAs: 'instanced' }),
  // people
  live(castaway, { copies: 1, drawnAs: 'single' }),
  // the gear its player holds (the kit: the wooden sword, the iron sword found on the wreck, the AR-15 lent in the arena)
  ...GEAR,
];

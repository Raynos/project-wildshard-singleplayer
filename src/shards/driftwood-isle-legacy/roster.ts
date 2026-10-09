/**
 * Driftwood Isle's live models (E306 / E315 M5, `ShardManifest.roster`): every creature the island can spawn — its fauna's
 * boars and bears, the reef crabs, the coconut monkeys, the Drowned Sailor, the Drowned Captain (before he rises
 * too), the gulls — its people and the gear its player holds. Listed in the Model Explorer at boot (src/engine/models/roster.ts);
 * the island keeps spawning and drawing every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { bear, boar } from '@wildshard/game/models/creatures'; // the creature rows build from registered species: the roster's own entry
import { coconutMonkey, drownedCaptain, drownedSailor, gull, reefCrab } from './models/creatures';
import { castaway } from './models/people';
import { GEAR } from './models/gear';
import { seaGlassChime } from './models/seaGlassChime';
import { trophyPlaques } from './models/trophyPlaques';
import { captainHat } from './models/captainHat';
import { sailclothCape } from './models/sailclothCape';

export const ROSTER: readonly RosterEntry[] = [
  // the fauna (driftwood-isle.ts `fauna`), faceted low-poly in code here
  live(boar, { pipeline: 'code' }), live(bear, { pipeline: 'code' }), // no deer since E318
  // the enemies (src/shards/driftwood-isle/creatures/Enemies.ts) and the boss (src/shards/driftwood-isle/quest/Finale.ts)
  live(reefCrab), live(coconutMonkey), live(drownedSailor), live(drownedCaptain),
  // the gulls (src/shards/driftwood-isle/world/Gulls.ts: ≤ 36, one instanced draw)
  live(gull, { copies: 36, drawnAs: 'instanced' }),
  // people
  live(castaway, { copies: 1, drawnAs: 'single' }),
  // the gear its player holds (the kit: the wooden sword, the iron sword found on the wreck)
  ...GEAR,
  // the loot (E314, DRIFTWOOD-LOOT): the hut's chime and trophy plaques, the captain's hat and the sailcloth cape — built
  // for review, not placed or worn yet (stage 2 / 3 wires them)
  live(seaGlassChime, { copies: 0, drawnAs: 'single' }), live(trophyPlaques, { copies: 0, drawnAs: 'single' }),
  live(captainHat, { copies: 0, drawnAs: 'single' }), live(sailclothCape, { copies: 0, drawnAs: 'single' }),
];

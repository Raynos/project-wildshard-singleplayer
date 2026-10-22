/**
 * Driftwood Isle's live models (E306 / E315 M5, `ShardManifest.roster`): every creature the island can spawn — its fauna's
 * boars and bears, the reef crabs, the coconut monkeys, the Drowned Sailor, the Drowned Captain (before he rises
 * too) — its people and the gear its player holds. Listed in the Model Explorer at boot (src/engine/models/roster.ts);
 * the island keeps spawning and drawing every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { COLLECTIONS } from './runtime/boot/blobAssets';
import { captainHat, sailclothCape } from './models/catalogue';

export async function roster(): Promise<readonly RosterEntry[]> {
  await COLLECTIONS.prepare();
  const seaGlassChime = COLLECTIONS.model('chime'), trophyPlaques = COLLECTIONS.model('plaques');
  return [
  // the loot (E314, DRIFTWOOD-LOOT): the hut's chime and trophy plaques, the captain's hat and the sailcloth cape — built
  // for review, not placed or worn yet (stage 2 / 3 wires them)
  live(seaGlassChime, { copies: 0, drawnAs: 'single' }), live(trophyPlaques, { copies: 0, drawnAs: 'single' }),
  live(captainHat, { copies: 0, drawnAs: 'single' }), live(sailclothCape, { copies: 0, drawnAs: 'single' }),
];
}

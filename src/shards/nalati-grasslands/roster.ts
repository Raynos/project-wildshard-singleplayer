/**
 * Nalati Grasslands' live models (E306 / E315 M5, `ShardManifest.roster`): every creature the steppe can spawn — its wildlife,
 * the named elites, the night's and the dusk's enemies, the two bosses (before they come too) — and its people. Listed in
 * the Model Explorer at boot (src/engine/models/roster.ts) in the shard's painterly creature style; the steppe keeps spawning,
 * drawing and animating every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import gear from './boot/gear.generated.json' with { type: 'json' };
import { weaponCatalogue } from './weapons/loadout';

// The flock's sheep, the Storm Titan, the dressing's ambient life (butterflies, raptors), the mounted shepherd, the camp's
// five, the gloved hands in the river and the reins card are Explorer catalogue rows (generators/explorerCatalogue.ts).
// the gear its player holds (bow and its arrows · sabre · spear and its javelins, the Golden Bow and the Naizagai once won,
// the AR-15)
export const ROSTER: readonly RosterEntry[] = gear.catalogue.map(row => live(weaponCatalogue.model(row.key),
  { copies: row.copies, ...(row.drawnAs === 'instanced' ? { drawnAs: 'instanced' as const } : {}) }));

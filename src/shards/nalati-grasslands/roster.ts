/**
 * Nalati Grasslands' live models (E306 / E315 M5, `ShardManifest.roster`): every creature the steppe can spawn — its wildlife,
 * the named elites, the night's and the dusk's enemies, the two bosses (before they come too) — and its people. Listed in
 * the Model Explorer at boot (src/engine/models/roster.ts) in the shard's painterly creature style; the steppe keeps spawning,
 * drawing and animating every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { swimHands } from '@wildshard/engine/models/swimHands';
import { shepherd } from './models/people';
import gear from './boot/gear.generated.json' with { type: 'json' };
import { weaponCatalogue } from './weapons/loadout';

export const ROSTER: readonly RosterEntry[] = [
  // the flock's sheep and the Storm Titan are Explorer catalogue rows (generators/explorerCatalogue.ts: a cover-book
  // specimen and a cloud-body card)
  // the dressing's ambient life (src/shards/nalati-grasslands/world/dressing/life.ts, E348): the butterflies over the drifts, the raptors
  // circling the valley — one instanced draw each
  // people: the mounted shepherd (src/shards/nalati-grasslands/sheepRaid.ts); the camp's five are a kit card (explorerCatalogue)
  live(shepherd, { copies: 1, drawnAs: 'skinned' }),
  // the gear its player holds (bow and its arrows · sabre · spear and its javelins, the Golden Bow and the Naizagai once
  // won, the AR-15) and the gloved hands in the river (E348); the reins card is a baked Explorer specimen (models/reins.json)
  ...gear.catalogue.map(row => live(weaponCatalogue.model(row.key), { copies: row.copies, ...(row.drawnAs === 'instanced' ? { drawnAs: 'instanced' as const } : {}) })),
  live(swimHands, { copies: 1 }),
];

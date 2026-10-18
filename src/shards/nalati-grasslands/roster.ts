/**
 * Nalati Grasslands' live models (E306 / E315 M5, `ShardManifest.roster`): every creature the steppe can spawn — its wildlife,
 * the named elites, the night's and the dusk's enemies, the two bosses (before they come too) — and its people. Listed in
 * the Model Explorer at boot (src/engine/models/roster.ts) in the shard's painterly creature style; the steppe keeps spawning,
 * drawing and animating every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { swimHands } from '@wildshard/engine/models/swimHands';
import { NALATI_WILDLIFE } from './data/fauna';
import content from './data/questContent.json' with { type: 'json' };
import { marmot, sheep, stormTitan } from './models/creatures';
import { campPeople, shepherd } from './models/people';
import { GEAR } from './models/gear';
import { BUTTERFLIES, butterfly, RAPTORS, raptor } from './models/ambientLife';
import { reins } from './models/reins';

/** the camp's flock (Wildlife NALATI_WILDLIFE: 40 sheep, one instanced draw) */
const FLOCK = NALATI_WILDLIFE.flocks.reduce((n, f) => n + f.count, 0);
/** the marmot colonies: 3–5 round each burrow (Marmots.build), ~4 each */
const MARMOTS = (NALATI_WILDLIFE.marmots?.sites ?? 0) * 4;

export const ROSTER: readonly RosterEntry[] = [
  // the flock (Flock.ts: legs and head in the vertex shader) and the marmots (Marmots.ts): one instanced draw each
  live(sheep, { copies: FLOCK, drawnAs: 'instanced' }), live(marmot, { copies: MARMOTS, drawnAs: 'instanced' }),
  live(stormTitan, { copies: 1, drawnAs: 'instanced' }),
  // the dressing's ambient life (src/shards/nalati-grasslands/world/dressing/life.ts, E348): the butterflies over the drifts, the raptors
  // circling the valley — one instanced draw each
  live(butterfly, { copies: BUTTERFLIES, drawnAs: 'instanced' }), live(raptor, { copies: RAPTORS, drawnAs: 'instanced' }),
  // people: the camp's five (one skinned mesh) and the mounted shepherd (src/shards/nalati-grasslands/sheepRaid.ts)
  live(campPeople, { copies: Object.keys(content.people).length, drawnAs: 'skinned' }), live(shepherd, { copies: 1, drawnAs: 'skinned' }),
  // the gear its player holds (bow and its arrows · sabre · spear and its javelins, the Golden Bow and the Naizagai once
  // won, the AR-15), the reins in the saddle (src/shards/nalati-grasslands/ride/ride.ts) and the gloved hands in the river (E348)
  ...GEAR,
  live(reins, { copies: 1 }), live(swimHands, { copies: 1 }),
];

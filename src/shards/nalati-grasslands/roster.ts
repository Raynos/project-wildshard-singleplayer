/**
 * Nalati Grasslands' live models (E306 / E315 M5, `ShardManifest.roster`): every creature the steppe can spawn — its wildlife,
 * the named elites, the night's and the dusk's enemies, the two bosses (before they come too) — and its people. Listed in
 * the Model Explorer at boot (src/engine/models/roster.ts) in the shard's painterly creature style; the steppe keeps spawning,
 * drawing and animating every copy as before.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { swimHands } from '@wildshard/engine/models/swimHands';
import { NALATI_WILDLIFE } from './creatures/wildPlacement';
import { CAMP_PEOPLE } from './quest';
import { aqbars, argymaq, balbalWarrior, ghostRider, goldenKing, horse, kokbori, marmot, qyran, sheep, sheepdog, stormTitan, wolf } from './models/creatures';
import { campPeople, shepherd } from './models/people';
import { GEAR } from './models/gear';
import { BUTTERFLIES, butterfly, RAPTORS, raptor } from './models/ambientLife';
import { reins } from './models/reins';

/** the camp's flock (Wildlife NALATI_WILDLIFE: 40 sheep, one instanced draw) */
const FLOCK = NALATI_WILDLIFE.flocks.reduce((n, f) => n + f.count, 0);
/** the marmot colonies: 3–5 round each burrow (Marmots.build), ~4 each */
const MARMOTS = (NALATI_WILDLIFE.marmots?.sites ?? 0) * 4;

export const ROSTER: readonly RosterEntry[] = [
  // the wildlife (src/engine/entities/Wildlife.ts): the plains herd + the camp horses (+ the shepherd's, and Tulpar once tamed),
  // the wolf pack (Kokbori's and the flock's raiders later), the collie
  live(horse), live(wolf), live(sheepdog),
  // the flock (Flock.ts: legs and head in the vertex shader) and the marmots (Marmots.ts): one instanced draw each
  live(sheep, { copies: FLOCK, drawnAs: 'instanced' }), live(marmot, { copies: MARMOTS, drawnAs: 'instanced' }),
  // the named elites (src/shards/nalati-grasslands/elites.ts), one each, when their rule brings them
  live(aqbars), live(kokbori), live(qyran), live(argymaq),
  // the night's ghost riders (a line of three; Qara Batyr at the head of his own) and the dusk's balbal warriors (four of
  // the ring + a crown balbal each dusk; the Golden King's adds)
  live(ghostRider, { planned: 3 }), live(balbalWarrior, { planned: 5 }),
  // the bosses: the Golden King (src/shards/nalati-grasslands/kurganBoss.ts) and Jel Ata, the Storm Titan (src/shards/nalati-grasslands/stormTitan.ts)
  live(goldenKing), live(stormTitan, { copies: 1, drawnAs: 'instanced' }),
  // the dressing's ambient life (src/shards/nalati-grasslands/world/dressing/life.ts, E348): the butterflies over the drifts, the raptors
  // circling the valley — one instanced draw each
  live(butterfly, { copies: BUTTERFLIES, drawnAs: 'instanced' }), live(raptor, { copies: RAPTORS, drawnAs: 'instanced' }),
  // people: the camp's five (one skinned mesh) and the mounted shepherd (src/shards/nalati-grasslands/sheepRaid.ts)
  live(campPeople, { copies: Object.keys(CAMP_PEOPLE).length, drawnAs: 'skinned' }), live(shepherd, { copies: 1, drawnAs: 'skinned' }),
  // the gear its player holds (bow and its arrows · sabre · spear and its javelins, the Golden Bow and the Naizagai once
  // won, the AR-15), the reins in the saddle (src/shards/nalati-grasslands/ride/ride.ts) and the gloved hands in the river (E348)
  ...GEAR,
  live(reins, { copies: 1 }), live(swimHands, { copies: 1 }),
];

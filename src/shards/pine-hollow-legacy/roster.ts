/**
 * Pine Hollow's live models (E306 / E315 M5, `ShardManifest.roster`): every creature the Hollow can spawn — its fauna's deer,
 * boars, elk and bears on the species rigs wearing the generated hulls, the Antler King (before he comes out at night too),
 * the ravens, the owl, the woodpecker and the hares — the hamlet's people and the gear its player holds. Listed in the
 * Model Explorer at boot (src/engine/models/roster.ts); the Hollow keeps spawning, drawing and animating every copy as before.
 *
 * `pipeline`: a generated mesh on a code rig lists its generator(s) first, then 'code'; a GLB posed in a shader (the
 * birds) is its generator alone.
 */
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { swimHands } from '@wildshard/engine/models/swimHands';
import { bear, boar, deer } from '@wildshard/game/models/creatures'; // the creature rows build from registered species: the roster's own entry
import { elk } from './models/creatures';
import { antlerKing } from './models/antlerKing';
import { owl, raven, woodpecker } from './models/birds';
import { snowshoeHare } from './models/wildlife';
import { millerBrandt, rangerHale, traderMott } from './models/people';
import { GEAR } from './models/gear';

/** the small wildlife's copies (src/shards/pine-hollow/life/index.ts, one instanced draw): N_RAVEN 4 at the kills + N_GUIDE 3
 *  breadcrumb ravens, the owl, the woodpecker, N_HARE 5 hares */
const RAVENS = 4 + 3, OWLS = 1, WOODPECKERS = 1, HARES = 5;

export const ROSTER: readonly RosterEntry[] = [
  // the fauna (pine-hollow.ts `fauna`): the shared rigs in Pine Hollow's hulls (scripts/creature-rig-bake.mjs) — the hind
  // TRELLIS.2, the stag, the boar and the bears Hunyuan3D-2 — and the boar's and elk's thralls (the King's fight)
  live(deer, { pipeline: ['trellis', 'hunyuan', 'code'] }), live(boar, { pipeline: ['hunyuan', 'code'] }), live(bear, { pipeline: ['hunyuan', 'code'] }),
  live(elk),
  // the boss (src/shards/pine-hollow/combat/antlerKing.ts): at night in the King's clearing; parked out of the herd list by day
  live(antlerKing, { planned: 1 }),
  // the birds and the hares (src/shards/pine-hollow/life/index.ts)
  live(raven, { copies: RAVENS, drawnAs: 'instanced' }), live(owl, { copies: OWLS, drawnAs: 'instanced' }),
  live(woodpecker, { copies: WOODPECKERS, drawnAs: 'instanced' }), live(snowshoeHare, { copies: HARES, drawnAs: 'instanced' }),
  // the people (src/shards/pine-hollow/quest/index.ts): one each, the generated person skinned on its code rig
  live(rangerHale, { copies: 1 }), live(millerBrandt, { copies: 1 }), live(traderMott, { copies: 1 }),
  // the gear its player holds (the crossbow and its bolts, the lever-action, the Warden's longbow and its arrows, the
  // skinning knife) and the gloved hands in the pond and the creek (E348)
  ...GEAR,
  live(swimHands, { copies: 1 }),
];

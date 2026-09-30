/**
 * Pine Hollow's live models (E306 / E315 M5, `ChunkDef.roster`): every creature the Hollow can spawn — its fauna's deer,
 * boars, elk and bears on the species rigs wearing the generated hulls, the Antler King (before he comes out at night too),
 * the ravens, the owl, the woodpecker and the hares — and the hamlet's people. Listed in the Model Explorer at boot
 * (src/models/roster.ts); the Hollow keeps spawning, drawing and animating every copy as before. (Its gear is listed with
 * the gear models.)
 *
 * `pipeline`: a generated mesh on a code rig lists its generator(s) first, then 'code'; a GLB posed in a shader (the
 * birds) is its generator alone.
 */
import { live, type RosterEntry } from '../../models/live';
import { bear, boar, deer } from '../../models/creatures';
import { elk } from './models/creatures';
import { antlerKing } from './models/antlerKing';
import { owl, raven, woodpecker } from './models/birds';
import { snowshoeHare } from './models/wildlife';
import { millerBrandt, rangerHale, traderMott } from './models/people';

/** the small wildlife's copies (src/pinehollow/life/index.ts, one instanced draw): N_RAVEN 4 at the kills + N_GUIDE 3
 *  breadcrumb ravens, the owl, the woodpecker, N_HARE 5 hares */
const RAVENS = 4 + 3, OWLS = 1, WOODPECKERS = 1, HARES = 5;

export const ROSTER: readonly RosterEntry[] = [
  // the fauna (pine-hollow.ts `fauna`): the shared rigs in Pine Hollow's hulls (scripts/creature-rig-bake.mjs) — the hind
  // TRELLIS.2, the stag, the boar and the bears Hunyuan3D-2 — and the boar's and elk's thralls (the King's fight)
  live(deer, { pipeline: ['trellis', 'hunyuan', 'code'] }), live(boar, { pipeline: ['hunyuan', 'code'] }), live(bear, { pipeline: ['hunyuan', 'code'] }),
  live(elk),
  // the boss (src/pinehollow/antlerKing.ts): at night in the King's clearing; parked out of the herd list by day
  live(antlerKing, { planned: 1 }),
  // the birds and the hares (src/pinehollow/life/index.ts)
  live(raven, { copies: RAVENS, drawnAs: 'instanced' }), live(owl, { copies: OWLS, drawnAs: 'instanced' }),
  live(woodpecker, { copies: WOODPECKERS, drawnAs: 'instanced' }), live(snowshoeHare, { copies: HARES, drawnAs: 'instanced' }),
  // the people (src/pinehollow/quest/index.ts): one each, the generated person skinned on its code rig
  live(rangerHale, { copies: 1 }), live(millerBrandt, { copies: 1 }), live(traderMott, { copies: 1 }),
];

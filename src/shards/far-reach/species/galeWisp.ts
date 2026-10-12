import { clipAnimate } from '@wildshard/sdk/species/clips';
import { GALE_WISP_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { GALE_WISP_DATA } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const GALE_WISP: SpeciesRow = GALE_WISP_DATA;

export const GALE_WISP_LOOK: SpeciesLook = { id: 'far.look.galeWisp', species: GALE_WISP.id, kind: 'galeWisp', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.galeWisp', sockets: ['body', 'head', 'swirl'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  // the baked body (generators/creatures.ts `wispBody`), else its undrawn stand-in (data/standIns.ts)
  build: () => skyBodyOrStandIn('gale-wisp'),
  animate: clipAnimate(GALE_WISP_CLIPS),
};

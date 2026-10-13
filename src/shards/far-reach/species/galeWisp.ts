import { bakedLook } from '@wildshard/sdk/species/clips';
import { GALE_WISP_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { GALE_WISP_DATA, GALE_WISP_LOOK_ROW } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const GALE_WISP: SpeciesRow = GALE_WISP_DATA;

/** The baked body (generators/creatures.ts `wispBody`), else its undrawn stand-in (data/standIns.ts). */
export const GALE_WISP_LOOK = bakedLook(GALE_WISP_LOOK_ROW, () => skyBodyOrStandIn('gale-wisp'), GALE_WISP_CLIPS);

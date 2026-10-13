import { bakedLook } from '@wildshard/sdk/species/clips';
import { DRIFT_RAY_CLIPS } from '../data/creatureClips';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { DRIFT_RAY_DATA, DRIFT_RAY_LOOK_ROW } from '../data/species';
import { skyBodyOrStandIn } from './bodies';

export const DRIFT_RAY: SpeciesRow = DRIFT_RAY_DATA;

/**
 * The body: the generated manta (C6, Hunyuan3D-2) in the mockup's pale blues, its fins and whip rigged, baked offline by
 * `generators/creatures.ts`; undrawn on its stand-in skeleton when the bake is not loaded.
 */
export const rayBody = (): AnimalSpecies => skyBodyOrStandIn('drift-ray');
export const DRIFT_RAY_LOOK = bakedLook(DRIFT_RAY_LOOK_ROW, rayBody, DRIFT_RAY_CLIPS);

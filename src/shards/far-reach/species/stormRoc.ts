import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { skyBodyOrStandIn, skyLook } from './bodies';
import { STORM_ROC_DATA, STORM_ROC_LOOK_ROW } from '../data/species';
import { ROC_CLIPS } from '../data/rocClips';

/** The catalogue supplies this held body's admitted raptor brain. */
export const STORM_ROC: SpeciesRow = STORM_ROC_DATA;
/** The unchanged baked eagle, or its undrawn stand-in before the look is loaded. */
export const rocBody = (): AnimalSpecies => skyBodyOrStandIn('storm-roc');
export const STORM_ROC_LOOK = skyLook(STORM_ROC_LOOK_ROW, 'storm-roc', ROC_CLIPS);

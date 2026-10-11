import { admitSpeciesBrains, type SpeciesBrains } from '@wildshard/game/plugin/brain';
import { strike } from '@wildshard/sdk/species';
import { SKY_SPECIES_BRAINS } from '../data/brains';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../data/strikes';

/** Admit Sky's shared gameplay rows before either browser or native body constructs its shipping policy. */
export function skyBrainCatalogue(): SpeciesBrains {
  return admitSpeciesBrains(SKY_SPECIES_BRAINS, [strike(RAM_DATA), strike(DIVE_DATA), strike(BURST_DATA)]);
}

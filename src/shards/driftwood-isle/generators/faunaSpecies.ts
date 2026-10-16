import { DRIFTWOOD_FAUNA_TUNING } from '../data/fauna';
import { deriveSpecies } from '@wildshard/engine/ai/species';
import { BEAR } from '@wildshard/game/systems/species/bear';
import { BOAR, BOAR_TUNING } from '@wildshard/game/systems/species/boar';

export const ISLAND_BOAR = deriveSpecies(BOAR, {
  id: 'driftwood.creature.boar',
  tuning: { ...BOAR_TUNING, ...DRIFTWOOD_FAUNA_TUNING.boar },
});
export const ISLAND_BEAR = deriveSpecies(BEAR, { id: 'driftwood.creature.bear' });

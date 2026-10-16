import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES, DRIFTWOOD_ENEMY_STRIKES } from '../data/enemySpecies';

/** One admitted data catalogue supplies the browser and renderer-free native body adapters. */
export const driftwoodSpeciesBrains = speciesBrains(DRIFTWOOD_ENEMY_SPECIES, DRIFTWOOD_ENEMY_STRIKES);

import { DRIFTWOOD_FAUNA_TUNING } from './fauna';
import { commonSpeciesRows, deriveSpeciesRows } from '@wildshard/sdk/bake/species';

const BOAR = commonSpeciesRows('boar', 'kit.creature.boar');
const BEAR = commonSpeciesRows('bear', 'kit.creature.bear');
const boarTuning = BOAR.tuning;
if (boarTuning === undefined) throw new Error('Shared boar gameplay has no hunt tuning');

export const ISLAND_BOAR: ReturnType<typeof deriveSpeciesRows> = deriveSpeciesRows(BOAR, {
  id: 'driftwood.creature.boar',
  tuning: { ...boarTuning, ...DRIFTWOOD_FAUNA_TUNING.boar },
});
export const ISLAND_BEAR: ReturnType<typeof deriveSpeciesRows> = deriveSpeciesRows(BEAR, { id: 'driftwood.creature.bear' });

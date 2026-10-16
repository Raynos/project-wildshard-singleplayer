import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { monkeyCallbacks } from '../species/monkey';
import { captainCallbacks } from '../species/captain';

/** Bind admitted metadata at kit, preserving the existing monkey and captain body adapters. */
export function driftwoodSpeciesRows(program: SpeciesProgramData): SpeciesRow[] {
  const brains = speciesBrains(program.species, program.strikes, program.modules);
  return program.species.map(row => ({ ...row, ...(row.kind === 'captain' ? captainCallbacks
    : row.kind === 'monkey' ? monkeyCallbacks(brains) : brains.bind(row.kind)) }));
}

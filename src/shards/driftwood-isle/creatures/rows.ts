import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { MonkeyBinding } from '../species/monkeyBinding';
import { monkeyCallbacks } from '../species/monkey';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';

/** Bind admitted metadata at kit, preserving the existing monkey and captain body adapters. */
export function driftwoodSpeciesRows(program: SpeciesProgramData, monkey: MonkeyBinding, decisions?: SpeciesDecisionAuthority): SpeciesRow[] {
  const brains = speciesBrains(program.species, program.strikes, program.modules);
  const bite = program.strikes.find(row => row.id === 'strike.monkey.bite');
  if (bite === undefined) throw new Error('Driftwood requires its admitted monkey bite');
  return program.species.map(row => ({ ...row, ...(row.kind === 'monkey' ? monkeyCallbacks(brains, strikeFromData(bite), monkey) : brains.bind(row.kind,undefined,undefined,undefined,decisions)) }));
}

import { app, registerSpecies, speciesWithLook, type Scope } from '#engine';
import { CRAB, CRAB_LOOK } from './crab';
import { MONKEY, MONKEY_LOOK } from './monkey';
import { SAILOR, SAILOR_LOOK } from './sailor';
import { CAPTAIN, CAPTAIN_LOOK } from './captain';

export const DRIFTWOOD_SPECIES = [CRAB, MONKEY, SAILOR, CAPTAIN];
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
/** The composition root's legacy boot bridge also supports standalone model fixtures. */
export function installDriftwoodSpecies(scope?: Scope): void {
  for (let i = 0; i < DRIFTWOOD_SPECIES.length; i++) {
    const row = DRIFTWOOD_SPECIES[i], look = DRIFTWOOD_LOOKS[i];
    if (row === undefined || look === undefined) continue;
    if (scope === undefined) registerSpecies(speciesWithLook(row, look));
    else { app.species.registerRow(row, scope); app.species.registerLook(look, scope); }
  }
}

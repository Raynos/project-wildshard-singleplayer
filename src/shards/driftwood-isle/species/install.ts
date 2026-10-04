import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { speciesWithLook } from '@wildshard/engine/entities/species/look';
import { registerSpecies } from '@wildshard/engine/entities/species/registry';
import { installDriftwoodLootTables } from '../loot/tables';
import { DRIFTWOOD_FAUNA, DRIFTWOOD_ENEMIES, DRIFTWOOD_PRACTICE } from '../creatures/tables';
import { CRAB, CRAB_LOOK } from './crab';
import { MONKEY, MONKEY_LOOK } from './monkey';
import { SAILOR, SAILOR_LOOK } from './sailor';
import { CAPTAIN, CAPTAIN_LOOK } from './captain';
import { registerDriftwoodToonPaints } from './toonPaints';

export const DRIFTWOOD_SPECIES = [CRAB, MONKEY, SAILOR, CAPTAIN];
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
/** The composition root's legacy boot bridge also supports standalone model fixtures. */
export function installDriftwoodSpecies(scope?: Scope): void {
  installDriftwoodLootTables(scope);
  registerDriftwoodToonPaints(scope);
  if (scope !== undefined) { app.encounters.registerSpawn(DRIFTWOOD_FAUNA, scope); app.encounters.registerSpawn(DRIFTWOOD_ENEMIES, scope); app.encounters.registerSpawn(DRIFTWOOD_PRACTICE, scope); }
  for (let i = 0; i < DRIFTWOOD_SPECIES.length; i++) {
    const row = DRIFTWOOD_SPECIES[i], look = DRIFTWOOD_LOOKS[i];
    if (row === undefined || look === undefined) continue;
    if (scope === undefined) registerSpecies(speciesWithLook(row, look));
    else { app.species.registerRow(row, scope); app.species.registerLook(look, scope); }
  }
}

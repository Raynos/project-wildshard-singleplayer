import { readSpeciesProgram } from '@wildshard/format/speciesPrograms';
import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES, DRIFTWOOD_ENEMY_STRIKES, ENEMY_SPECIES_METADATA } from './enemySpecies';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { ISLAND_BOAR, ISLAND_BEAR } from './faunaSpecies';

const rows = [ISLAND_BOAR, ISLAND_BEAR].map(row => bakeSpecies(row, row.id));
/** Both owners read the identical gameplay rows; the separate fauna look retains its rig and coat. */
const authored: readonly BrainedSpecies[] = [...DRIFTWOOD_ENEMY_SPECIES, ENEMY_SPECIES_METADATA.captain];
export const DRIFTWOOD_ENEMY_PROGRAM = readSpeciesProgram({ species: authored.map(row => Object.assign(bakeSpecies(row, row.id),
  row.brain === undefined ? {} : { brain: row.brain }, row.body === undefined ? {} : { body: row.body })), strikes: DRIFTWOOD_ENEMY_STRIKES });
export const DRIFTWOOD_SPECIES_PROGRAMS = { page: rows, native: rows, program: DRIFTWOOD_ENEMY_PROGRAM };

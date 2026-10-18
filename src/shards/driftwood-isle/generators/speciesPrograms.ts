import { DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';
import { TIDAL_GIANTS_SPECIES, TIDAL_GIANTS_STRIKES } from './tidalGiantsCombat';
import { CAPTAIN_BRAIN, CAPTAIN_BODY } from './captainDecision';
import { DRIFTWOOD_SPAWNS } from './spawnTables';
import { DRIFTWOOD_NATIVE_HUNT } from './nativeHunt';
import { readSpeciesProgram } from '@wildshard/format/speciesPrograms';
import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES, DRIFTWOOD_ENEMY_STRIKES, ENEMY_SPECIES_METADATA } from './enemySpecies';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { ISLAND_BOAR, ISLAND_BEAR } from './faunaSpecies';

const rows = [ISLAND_BOAR, ISLAND_BEAR].map(row => bakeSpecies(row, row.id));
/** Both owners read the identical gameplay rows; the separate fauna look retains its rig and coat. */
const authored: readonly BrainedSpecies[] = [...DRIFTWOOD_REGULAR_SPECIES, ...TIDAL_GIANTS_SPECIES, ...DRIFTWOOD_ENEMY_SPECIES, { ...ENEMY_SPECIES_METADATA.captain, brain:CAPTAIN_BRAIN, body:CAPTAIN_BODY }];
export const DRIFTWOOD_ENEMY_PROGRAM = readSpeciesProgram({ species: authored.map(row => Object.assign(bakeSpecies(row, row.id),
  row.brain === undefined ? {} : { brain: row.brain }, row.body === undefined ? {} : { body: row.body })), strikes: [...DRIFTWOOD_ENEMY_STRIKES, ...DRIFTWOOD_REGULAR_STRIKES, ...TIDAL_GIANTS_STRIKES] });
export const DRIFTWOOD_SPECIES_PROGRAMS = { spawns: DRIFTWOOD_SPAWNS, hunt: DRIFTWOOD_NATIVE_HUNT, page: rows, native: rows, program: DRIFTWOOD_ENEMY_PROGRAM };

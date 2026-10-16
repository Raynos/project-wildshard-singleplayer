import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { ISLAND_BOAR, ISLAND_BEAR } from './faunaSpecies';

const rows = [ISLAND_BOAR, ISLAND_BEAR].map(row => bakeSpecies(row, row.id));
/** Both owners read the identical gameplay rows; the separate fauna look retains its rig and coat. */
export const DRIFTWOOD_SPECIES_PROGRAMS = { page: rows, native: rows };

import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_PAGE_ROWS } from './brains';
import { SIGNAL_HEADLESS } from './headlessOwners';

/** Authored population policy, retaining preparation-time module admission and home order. */
const program = { species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES };
export const SIGNAL_PAGE_PROGRAM = { program, page: SIGNAL_PAGE_ROWS };
export const SIGNAL_NATIVE_POPULATION = { program, ...SIGNAL_HEADLESS.homes, admission: 'prepare',
  homes: SIGNAL_HEADLESS.homes.rows, boss: SIGNAL_HEADLESS.boss.row } as const;

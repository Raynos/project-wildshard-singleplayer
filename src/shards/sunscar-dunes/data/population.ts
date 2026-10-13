import stages from './bossStages.json' with { type: 'json' };
import { SIGNAL_PAGE_HOLDS } from './hostOwners';
import { MATRIARCH_PRESENTATION } from './matriarchPresentation';
import { SIGNAL_RIG_LIBRARY } from './rigLibrary';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_PAGE_ROWS } from './brains';
import { SIGNAL_HEADLESS } from './headlessOwners';

/** Authored population policy, retaining preparation-time module admission and home order. */
const program = { species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES };
export const SIGNAL_PAGE_PROGRAM = { species: { program, page: SIGNAL_PAGE_ROWS, library: SIGNAL_RIG_LIBRARY },
  population: { system: 'sunscar.creatures', holds: SIGNAL_PAGE_HOLDS, witness: { kinds: ['duneRay', 'duneStrider'] } },
  inspect: { actors: { ray: { home: 0 } }, roster: 'creatures', boss: 'matriarch' },
  fight: { id: SIGNAL_HEADLESS.boss.row.id, definition: SIGNAL_HEADLESS.boss.definition, stages, profile: SIGNAL_HEADLESS.boss.profile,
    presentation: MATRIARCH_PRESENTATION, reward: SIGNAL_HEADLESS.boss.reward,
    record: { kind: 'flags', actor: SIGNAL_HEADLESS.boss.row.id, names: SIGNAL_HEADLESS.boss.record },
    victory: { ...SIGNAL_HEADLESS.boss.victory, once: false } },
} as const;
export const SIGNAL_NATIVE_POPULATION = { program, ...SIGNAL_HEADLESS.homes, admission: 'prepare',
  homes: SIGNAL_HEADLESS.homes.rows, boss: SIGNAL_HEADLESS.boss.row } as const;

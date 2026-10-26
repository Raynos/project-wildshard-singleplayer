import stages from '../../data/bossStages.json' with { type: 'json' };
import { SIGNAL_PAGE_HOLDS } from './hostOwners';
import { MATRIARCH_PRESENTATION } from './matriarchPresentation';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_PAGE_ROWS } from './brains';
import { SIGNAL_HEADLESS } from './headlessOwners';

/** Authored population policy, retaining preparation-time module admission and home order. */
const program: { species: typeof SIGNAL_SPECIES; strikes: typeof SIGNAL_STRIKES; modules: typeof SIGNAL_MODULES } = { species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES };
export const SIGNAL_PAGE_PROGRAM: { readonly species: { readonly program: typeof program; readonly page: typeof SIGNAL_PAGE_ROWS }; readonly population: { readonly system: 'sunscar.creatures'; readonly holds: typeof SIGNAL_PAGE_HOLDS; readonly witness: { readonly kinds: readonly ['duneRay', 'duneStrider'] } }; readonly inspect: { readonly actors: { readonly ray: { readonly home: 0 } }; readonly roster: 'creatures'; readonly boss: 'matriarch' }; readonly fight: { readonly id: typeof SIGNAL_HEADLESS.boss.row.id; readonly definition: typeof SIGNAL_HEADLESS.boss.definition; readonly stages: typeof stages; readonly profile: typeof SIGNAL_HEADLESS.boss.profile; readonly presentation: typeof MATRIARCH_PRESENTATION; readonly reward: typeof SIGNAL_HEADLESS.boss.reward; readonly record: { readonly kind: 'flags'; readonly actor: typeof SIGNAL_HEADLESS.boss.row.id; readonly names: typeof SIGNAL_HEADLESS.boss.record }; readonly victory: Readonly<Omit<typeof SIGNAL_HEADLESS.boss.victory, 'once'>> & { readonly once: false } } } = { species: { program, page: SIGNAL_PAGE_ROWS },
  population: { system: 'sunscar.creatures', holds: SIGNAL_PAGE_HOLDS, witness: { kinds: ['duneRay', 'duneStrider'] } },
  inspect: { actors: { ray: { home: 0 } }, roster: 'creatures', boss: 'matriarch' },
  fight: { id: SIGNAL_HEADLESS.boss.row.id, definition: SIGNAL_HEADLESS.boss.definition, stages, profile: SIGNAL_HEADLESS.boss.profile,
    presentation: MATRIARCH_PRESENTATION, reward: SIGNAL_HEADLESS.boss.reward,
    record: { kind: 'flags', actor: SIGNAL_HEADLESS.boss.row.id, names: SIGNAL_HEADLESS.boss.record },
    victory: { ...SIGNAL_HEADLESS.boss.victory, once: false } },
} as const;
export const SIGNAL_NATIVE_POPULATION: Readonly<typeof SIGNAL_HEADLESS.homes> & { readonly program: typeof program; readonly admission: 'prepare'; readonly homes: typeof SIGNAL_HEADLESS.homes.rows; readonly boss: typeof SIGNAL_HEADLESS.boss.row } = { program, ...SIGNAL_HEADLESS.homes, admission: 'prepare',
  homes: SIGNAL_HEADLESS.homes.rows, boss: SIGNAL_HEADLESS.boss.row } as const;

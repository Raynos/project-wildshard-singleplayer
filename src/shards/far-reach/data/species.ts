import type { SpeciesData } from '@wildshard/sdk/species';
import { STRINGS } from './strings';
import { DECK } from './layout';
import { SKY_GOAT_VARIANTS, DRIFT_RAY_VARIANTS, GALE_WISP_VARIANTS } from './variants';

/** The shipping gameplay declaration; native appearance and body remain independently owned. */
export const SKY_GOAT_DATA: SpeciesData = { id: 'far.creature.skyGoat', kind: 'skyGoat', label: STRINGS.goat, aggressive: true, blood: false, lockable: true,
  variants: SKY_GOAT_VARIANTS };

/** The shipping gameplay declaration; native appearance and body remain independently owned. */
export const DRIFT_RAY_DATA: SpeciesData = { id: 'far.creature.driftRay', kind: 'driftRay', label: STRINGS.ray, aggressive: true, blood: false,
  flight: { altitude: DECK + 14, above: 'world', climbRate: 6, diveRate: 20, lockRange: 32 },
  variants: DRIFT_RAY_VARIANTS };

/** The shipping gameplay declaration; native appearance and body remain independently owned. */
export const GALE_WISP_DATA: SpeciesData = { id: 'far.creature.galeWisp', kind: 'galeWisp', label: STRINGS.wisp, aggressive: true, blood: false,
  flight: { altitude: 33, above: 'world', climbRate: 8, diveRate: 10, lockRange: 20 },
  variants: GALE_WISP_VARIANTS };


import type { SpeciesData } from '@wildshard/sdk/species';
import { STRINGS } from './strings';
import { DECK, ROC } from './layout';
import { SKY_GOAT_VARIANTS, DRIFT_RAY_VARIANTS, GALE_WISP_VARIANTS, STORM_ROC_VARIANTS } from './variants';

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


/** The Storm Roc's gameplay declaration; its body brain (runtime/stormRocBrain.ts) binds think / act. The bank (engine
 * 8252e3978): it rolls into its turns, so the lap round the dais banks (round 7: 'a frontal level bird'). */
export const STORM_ROC_DATA: SpeciesData = { id: 'far.creature.stormRoc', kind: 'stormRoc', label: STRINGS.roc, aggressive: true, blood: false,
  flight: { altitude: ROC.y, above: 'world', climbRate: 9, diveRate: 24, lockRange: 40, bank: 0.35 },
  variants: STORM_ROC_VARIANTS };

/** The creatures' look rows (species/*.ts): each one's rig contract on its baked body (generators/creatures.ts). */
export const DRIFT_RAY_LOOK_ROW = { id: 'far.look.driftRay', species: DRIFT_RAY_DATA.id, kind: 'driftRay', skeleton: 'far.driftRay',
  sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clipNames: ['idle', 'fly', 'attack', 'hit', 'die'] } as const;
export const SKY_GOAT_LOOK_ROW = { id: 'far.look.skyGoat', species: SKY_GOAT_DATA.id, kind: 'skyGoat', skeleton: 'far.skyGoat',
  sockets: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'], clipNames: ['idle', 'walk', 'attack', 'hit', 'die'] } as const;
export const GALE_WISP_LOOK_ROW = { id: 'far.look.galeWisp', species: GALE_WISP_DATA.id, kind: 'galeWisp', skeleton: 'far.galeWisp',
  sockets: ['body', 'head', 'swirl'], clipNames: ['idle', 'fly', 'attack', 'hit', 'die'] } as const;
export const STORM_ROC_LOOK_ROW = { id: 'far.look.stormRoc', species: STORM_ROC_DATA.id, kind: 'stormRoc', skeleton: 'far.stormRoc',
  sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clipNames: ['idle', 'fly', 'attack', 'hit', 'die'] } as const;

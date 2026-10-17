import { RAY_LOOK, RAY_CLIPS } from './species/duneRay';
import { SKITTERER_LOOK, SKITTERER_CLIPS } from './species/skitterer';
import { STRIDER_LOOK, STRIDER_CLIPS } from './species/strider';
import { MATRIARCH_LOOK, MATRIARCH_CLIPS } from './species/matriarch';

/** The page's original look installation order, bodies and clip rows. */
export const SIGNAL_CREATURE_LOOK_ROWS = [
  { body: 'ray', look: RAY_LOOK, clips: RAY_CLIPS },
  { body: 'skitterer', look: SKITTERER_LOOK, clips: SKITTERER_CLIPS },
  { body: 'strider', look: STRIDER_LOOK, clips: STRIDER_CLIPS },
  { body: 'matriarch', look: MATRIARCH_LOOK, clips: MATRIARCH_CLIPS },
] as const;

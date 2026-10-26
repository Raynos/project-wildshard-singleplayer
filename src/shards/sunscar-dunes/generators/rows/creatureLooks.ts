import { RAY_LOOK, RAY_CLIPS } from './species/duneRay';
import { SKITTERER_LOOK, SKITTERER_CLIPS } from './species/skitterer';
import { STRIDER_LOOK, STRIDER_CLIPS } from './species/strider';
import { MATRIARCH_LOOK, MATRIARCH_CLIPS } from './species/matriarch';

/** The page's original look installation order, bodies and clip rows. */
export const SIGNAL_CREATURE_LOOK_ROWS: readonly [{ readonly body: 'ray'; readonly look: typeof RAY_LOOK; readonly clips: typeof RAY_CLIPS }, { readonly body: 'skitterer'; readonly look: typeof SKITTERER_LOOK; readonly clips: typeof SKITTERER_CLIPS }, { readonly body: 'strider'; readonly look: typeof STRIDER_LOOK; readonly clips: typeof STRIDER_CLIPS }, { readonly body: 'matriarch'; readonly look: typeof MATRIARCH_LOOK; readonly clips: typeof MATRIARCH_CLIPS }] = [
  { body: 'ray', look: RAY_LOOK, clips: RAY_CLIPS },
  { body: 'skitterer', look: SKITTERER_LOOK, clips: SKITTERER_CLIPS },
  { body: 'strider', look: STRIDER_LOOK, clips: STRIDER_CLIPS },
  { body: 'matriarch', look: MATRIARCH_LOOK, clips: MATRIARCH_CLIPS },
] as const;

import type { SpeciesData } from '@wildshard/sdk/species';
import { STRINGS } from '../data/strings';

// The one variant of the ray, the goat and the Storm Roc, renderer-free (SF72): their species rows (species/, which build
// views) and the headless runtime's creature stream (the variant's scale range is each spawn's first draw) read the same rows.
/** The ray's single admitted scale/health variant. */
export const DRIFT_RAY_VARIANTS: SpeciesData['variants'] = [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 50 }];
/** The goat scale range remains the first manager spawn draw. */
export const SKY_GOAT_VARIANTS: SpeciesData['variants'] = [{ id: 'cloud', label: STRINGS.goat, weight: 1, rarity: 'common', scale: [0.95, 1.1], hp: 40 }];
/** The Roc's fixed boss scale and health. */
export const STORM_ROC_VARIANTS: SpeciesData['variants'] = [{ id: 'storm', label: STRINGS.roc, weight: 1, rarity: 'legendary', scale: [1, 1], hp: 420 }];

/** The wisp's fixed scale and health, shared by client and native spawn admission. */
export const GALE_WISP_VARIANTS: SpeciesData['variants'] = [{ id: 'gale', label: STRINGS.wisp, weight: 1, rarity: 'common', scale: [1, 1], hp: 18 }];

import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { STRINGS } from '../data/strings';

// The one variant of the ray, the goat and the Storm Roc, renderer-free (SF72): their species rows (species/, which build
// views) and the headless runtime's creature stream (the variant's scale range is each spawn's first draw) read the same rows.
export const DRIFT_RAY_VARIANTS: SpeciesRow['variants'] = [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1], hp: 50 }];
export const SKY_GOAT_VARIANTS: SpeciesRow['variants'] = [{ id: 'cloud', label: STRINGS.goat, weight: 1, rarity: 'common', scale: [0.95, 1.1], hp: 40 }];
export const STORM_ROC_VARIANTS: SpeciesRow['variants'] = [{ id: 'storm', label: STRINGS.roc, weight: 1, rarity: 'legendary', scale: [1, 1], hp: 420 }];

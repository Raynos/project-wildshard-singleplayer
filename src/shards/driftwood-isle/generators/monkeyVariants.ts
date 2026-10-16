import type { SpeciesVariant } from '@wildshard/engine/ai/species';
import { engineString } from '@wildshard/engine/strings';

/** The Coconut Monkey's variants (./monkey.ts's species row), renderer-free: a renderer-free host rolls the same table. */
export const MONKEY_VARIANTS: SpeciesVariant[] = [
  { id: 'monkey', label: 'Coconut monkey', weight: 85, rarity: 'common', scale: [1.25, 1.4], hp: 30 },
  { id: 'elder', label: engineString('s_d5584ccb3432'), weight: 15, rarity: 'uncommon', scale: [1.5, 1.6], hp: 45 },
];

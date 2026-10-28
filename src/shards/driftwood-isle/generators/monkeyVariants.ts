import type { bakeSpecies } from '@wildshard/sdk/bake/species';
import labels from '../data/monkeyLabels.json' with { type: 'json' };

/** The Coconut Monkey's variants (./monkey.ts's species row), renderer-free: a renderer-free host rolls the same table. */
export const MONKEY_VARIANTS: Parameters<typeof bakeSpecies>[0]['variants'] = [
  { id: 'monkey', label: 'Coconut monkey', weight: 85, rarity: 'common', scale: [1.25, 1.4], hp: 30 },
  { id: 'elder', label: labels.elder, weight: 15, rarity: 'uncommon', scale: [1.5, 1.6], hp: 45 },
];

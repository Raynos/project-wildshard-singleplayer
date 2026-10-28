import { expect, expectTypeOf, test } from 'vitest';
import type { SpeciesVariant } from '../src/engine/ai/species';
import { engineString } from '../src/engine/strings';
import { MONKEY_VARIANTS } from '../src/shards/driftwood-isle/generators/monkeyVariants';

test('owned monkey variants retain native gameplay fields, labels and ordered weights', () => {
  expectTypeOf<typeof MONKEY_VARIANTS>().toEqualTypeOf<SpeciesVariant[]>();
  const original: SpeciesVariant[] = [
    { id: 'monkey', label: 'Coconut monkey', weight: 85, rarity: 'common', scale: [1.25, 1.4], hp: 30 },
    { id: 'elder', label: engineString('s_d5584ccb3432'), weight: 15, rarity: 'uncommon', scale: [1.5, 1.6], hp: 45 },
  ];
  expect(MONKEY_VARIANTS).toEqual(original);
  expect(JSON.stringify(MONKEY_VARIANTS)).toBe(JSON.stringify(original));
});

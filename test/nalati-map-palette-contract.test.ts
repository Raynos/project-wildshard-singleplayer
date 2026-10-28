import { expectTypeOf, test } from 'vitest';
import type { MinimapPalette } from '../src/engine/ui/Minimap';
import type { NALATI_MINIMAP } from '../src/shards/nalati-grasslands/generators/minimapRecipe';

test('the source palette retains the complete native sample/place contract', () => {
  expectTypeOf<typeof NALATI_MINIMAP>().toEqualTypeOf<Pick<MinimapPalette, 'ground' | 'pois'>>();
});

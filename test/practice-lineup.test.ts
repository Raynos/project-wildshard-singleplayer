// E348 (the E315 M5 leftover): the practice arena's dummies go through the model contract — its lineup is placements of the
// shared model shared/training-dummy, one copy per armour, each variant one the model defines; the card counts them.
import { describe, expect, it } from 'vitest';
import { ARENA_LINEUP } from '#engine-internal/practice/lineup';
import { paramsOf } from '#engine-internal/models/model';
import { trainingDummy } from '#engine-internal/models/trainingDummy';
import { DUMMY_VARIANTS } from '#engine-internal/practice/TrainingDummy';

describe("the practice arena's lineup (E348)", () => {
  it('places the shared dummy model: three copies, one per armour, on the room floor', () => {
    expect(ARENA_LINEUP).toHaveLength(DUMMY_VARIANTS.length);
    const armours = ARENA_LINEUP.map((pl) => paramsOf(trainingDummy, pl.variant, pl.params).variant);
    expect(new Set(armours)).toEqual(new Set(DUMMY_VARIANTS.map((v) => v.id)));
    for (const pl of ARENA_LINEUP) {
      expect(trainingDummy.variants?.some((v) => v.id === pl.variant), pl.variant).toBe(true);
      expect(pl.y).toBe(0);
    }
    // the order the arena stood them in before E348 (DUMMY_VARIANTS by index: left, centre, right)
    expect(armours).toEqual(DUMMY_VARIANTS.map((v) => v.id));
  });
});

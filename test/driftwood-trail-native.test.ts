import { expect, test } from 'vitest';
import { BufferAttribute } from 'three';
import { originalTrailside } from '../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs';
import { islandTrailsideSpec, trailsideSpecKey } from '../src/shards/driftwood-isle/generators/trailsideLayout';
import { driftwoodTrailRows } from '../src/shards/driftwood-isle/generators/fixedFacts';

const bake = driftwoodTrailRows();

test('the offline trail retains its authored placements, native colliders and floor ownership', () => {
  const original = originalTrailside();
  try {
    expect(original.metadata).toEqual(bake);
    for (const name of ['position', 'color']) {
      const attribute: unknown = original.geometry.getAttribute(name);
      if (!(attribute instanceof BufferAttribute)) throw new Error('Missing native trail channel');
    }
    expect(bake.specKey).toBe(trailsideSpecKey(islandTrailsideSpec()));
  } finally { original.geometry.dispose(); }
});



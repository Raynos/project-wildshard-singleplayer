import { expect, test } from 'vitest';
import { WORLD_SCENES } from '../src/shards/driftwood-isle/generators/worldScenes';
import catalogue from '../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };
import { originalTrailside } from '../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs';
import { islandTrailsideSpec, trailsideSpecKey } from '../src/shards/driftwood-isle/generators/trailsideLayout';
import bake from '../src/shards/driftwood-isle/data/trailsideBake.json' with { type: 'json' };

test('the offline trail retains its authored placements, native colliders and floor ownership', () => {
  const original = originalTrailside();
  try {
    expect(original.metadata).toEqual(bake);
    const trail = WORLD_SCENES.steps.find(step => step.id === 'trail');
    const material = WORLD_SCENES.materials.find(slot => slot.id === trail?.materials['kit']);
    expect(material?.kind === 'lowpoly' ? material.variant : undefined).toBe(catalogue[0]?.source.material.variant);
    expect(bake.specKey).toBe(trailsideSpecKey(islandTrailsideSpec()));
  } finally { original.geometry.dispose(); }
});

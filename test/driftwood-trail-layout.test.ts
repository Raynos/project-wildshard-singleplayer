import { expect, test } from 'vitest';
import { worldScenes } from '../src/shards/driftwood-isle/generators/worldScenes';
import { driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import catalogue from '../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };
import { originalTrailside } from '../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs';
import { islandTrailsideSpec, trailsideSpecKey } from '../src/shards/driftwood-isle/generators/trailsideLayout';
import { driftwoodTrailRows } from '../src/shards/driftwood-isle/generators/fixedFacts';
import { hashImmutableBytes } from '../src/sdk/immutable';

const bake = driftwoodTrailRows();

test('the offline trail retains its authored placements, native colliders and floor ownership', async () => {
  const WORLD_SCENES = worldScenes(await driftwoodSceneBanks());
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(bake, null, 2)}\n`))).toBe('bf515ce72cf444ada4be2e7f257b8be7ed699deb42fe7bc76b1ffc95543385b5');
  const original = originalTrailside();
  try {
    expect(original.metadata).toEqual(bake);
    const trail = WORLD_SCENES.steps.find(step => step.id === 'trail');
    const material = WORLD_SCENES.materials.find(slot => slot.id === trail?.materials['kit']);
    expect(material?.kind === 'lowpoly' ? material.variant : undefined).toBe(catalogue[0]?.source.material.variant);
    expect(bake.specKey).toBe(trailsideSpecKey(islandTrailsideSpec()));
  } finally { original.geometry.dispose(); }
});

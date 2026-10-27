import { expect, test } from 'vitest';
import { driftwoodEmittedProduct } from './fixtures/driftwood-emitted-product';
import { BufferAttribute } from 'three';
import catalogue from '../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };
import { originalTrailside } from '../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs';
import { islandTrailsideSpec, trailsideSpecKey } from '../src/shards/driftwood-isle/generators/trailsideLayout';
import { driftwoodTrailRows } from '../src/shards/driftwood-isle/generators/fixedFacts';
import { hashImmutableBytes } from '../src/sdk/immutable';

const bake = driftwoodTrailRows();

test('the offline trail retains its authored placements, native colliders and floor ownership', async () => {
  const WORLD_SCENES = (await driftwoodEmittedProduct()).section('world/scenes');
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(bake, null, 2)}\n`))).toBe('bf515ce72cf444ada4be2e7f257b8be7ed699deb42fe7bc76b1ffc95543385b5');
  const original = originalTrailside();
  try {
    expect(original.metadata).toEqual(bake);
    // The cross-host scalar correction must not alter even one drawn vertex
    // or colour byte: these are the defining original producer's two channels.
    for (const [name, hash] of [
      ['position', 'ab4774ce3f42089aa8f1eecfe8cf57ffe683df2a5df65a1a2cf78021dd36df35'],
      ['color', 'be865c9217ef171eafe5ce023de36ab9f6d3a37fc5de51d80caa3ed00d372ef6'],
    ] as const) {
      const attribute: unknown = original.geometry.getAttribute(name);
      if (!(attribute instanceof BufferAttribute)) throw new Error('Missing native trail channel');
      expect(attribute.count).toBe(116040);
      expect(hashImmutableBytes(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength))).toBe(hash);
    }
    const trail = WORLD_SCENES.steps.find(step => step.id === 'trail');
    const material = WORLD_SCENES.materials.find(slot => slot.id === trail?.materials['kit']);
    expect(material?.kind === 'lowpoly' ? material.variant : undefined).toBe(catalogue[0]?.source.material.variant);
    expect(bake.specKey).toBe(trailsideSpecKey(islandTrailsideSpec()));
  } finally { original.geometry.dispose(); }
});

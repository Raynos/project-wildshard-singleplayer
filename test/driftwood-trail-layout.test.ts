import { expect, test } from 'vitest';
import { driftwoodEmittedProduct } from './fixtures/driftwood-emitted-product';
import catalogue from '../src/shards/driftwood-isle/data/trailCatalogue.json' with { type: 'json' };

test('the emitted trail keeps its original geometry owner and material', async () => {
  const scenes = (await driftwoodEmittedProduct()).section('world/scenes');
  const trail = scenes.steps.find(step => step.id === 'trail');
  const material = scenes.materials.find(slot => slot.id === trail?.materials['kit']);
  expect(trail?.geometry['trail']).toEqual({ library: 'cascade', model: 'trailside' });
  expect(material?.kind === 'lowpoly' ? material.variant : undefined).toBe(catalogue[0]?.source.material.variant);
}, 30000);

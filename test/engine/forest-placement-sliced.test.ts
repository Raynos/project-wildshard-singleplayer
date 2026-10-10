// SF67: the forest's placement as steps (Forest.buildSliced pauses between them) plants exactly the one-task placement.
import { expect, it } from 'vitest';
import { setActiveChunk, getActiveChunk } from '../../src/game/shard/registry';
import { placeForest, placeForestSteps, plantSpecs } from '../../src/engine/world/forest/placement';

it('places the same trees in steps as in one task', () => {
  setActiveChunk('pine-hollow');
  const variants = plantSpecs(getActiveChunk().trees);
  const eager = placeForest(variants);
  const steps = placeForestSteps(variants);
  let pauses = 0, step = steps.next();
  while (step.done !== true) { pauses++; step = steps.next(); }
  expect(pauses).toBeGreaterThan(3);
  expect(JSON.stringify(step.value.trees)).toBe(JSON.stringify(eager.trees));
  expect(step.value.trees.length).toBeGreaterThan(100);
});

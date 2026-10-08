// SHARD-PLATFORM G254 (dw-parity): a restored creature's rig poses from its restored memory. AnimalSim.restore copies
// `mem` into a new object; the rig context kept the object it was built with, so a restored grid region's Drowned Sailor
// posed (and placed its deck offset) from stale memory, 0.6 m under the hold's floor.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { CRAB, CRAB_LOOK } from '../../src/shards/driftwood-isle/species/crab';
import { fakeWorld } from '../fake/world';

const previousScope = app.levelScope;
beforeEach(() => { app.levelScope = app.engineScope.child('animal-restore-test'); });
afterEach(() => { app.levelScope?.dispose(); app.levelScope = previousScope; });

it('poses a restored creature from its restored memory', () => {
  const factory = new AnimalFactory(fakeWorld().sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const original = factory.model('crab', 'small');
  const seen: Record<string, number>[] = [];
  const model = { ...original, species: speciesWithLook(CRAB, { ...CRAB_LOOK, animate: (c) => { seen.push(c.mem); } }) };
  const animal = new Animal(factory.instantiate(model, 0.5), model, 0.5);
  animal.place(0, 0, 0, 0);
  animal.mem['floor'] = 0.6;
  const saved = animal.snapshot();
  animal.restore(saved);
  animal.update(1 / 30, 0, true);
  expect(seen.at(-1)).toBe(animal.mem);
  expect(seen.at(-1)?.['floor']).toBe(0.6);
});

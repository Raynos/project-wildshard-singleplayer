import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { AnimalFactory } from '../src/engine/entities/AnimalFactory';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import { PracticePrototypeAnimal, validatePracticePrototype } from '../src/game/practice/PracticePrototypeAnimal';
import { EncounterSession } from '../src/game/practice/EncounterSession';
import { fakeWorld } from './fake/world';

test('prototype death contract is opt-in and cannot override native corpse admission', () => {
  expect(() => validatePracticePrototype(undefined, true)).not.toThrow();
  expect(() => validatePracticePrototype({ death: 'despawn' }, false)).not.toThrow();
  expect(() => validatePracticePrototype({ death: 'despawn' }, true)).toThrow('cannot be combined');
});

test('real prototype damage kills once, retires its body, and fresh selection restores living state', async () => {
  const owner = new Scope('prototype-lifecycle-test');
  vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  const factory = new AnimalFactory(fakeWorld().sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, oneMaterial: true } });
  const model = factory.model('bear', 'brown');
  const instances: PracticePrototypeAnimal[] = [];
  const session = new EncounterSession<string, PracticePrototypeAnimal>({
    load: () => {
      const animal = owner.run(() => new PracticePrototypeAnimal(factory.instantiate(model, .5), model, 7001));
      instances.push(animal); return Promise.resolve(animal);
    },
    dispose: animal => { animal.retireBody(); animal.mesh.removeFromParent(); },
  });
  try {
    expect(await session.select('prototype')).toBe(true);
    const first = session.snapshot.actor;
    if (first === null) throw new Error('Missing prototype');
    const retired = vi.spyOn(first, 'retireBody');
    const damaged = vi.fn(); first.onDamaged = () => { damaged(); };
    const before = first.hp;
    expect(first.applyFinalDamage(1, new Vector3(), new Vector3(0, 0, 1))).toBe(false);
    expect(first.hp).toBe(before - 1); expect(first.hidden).toBe(false);
    expect(first.applyFinalDamage(before, new Vector3(), new Vector3(0, 0, 1))).toBe(true);
    expect(first.hp).toBe(0); expect(first.alive).toBe(false);
    expect(first.hidden).toBe(true); expect(first.mesh.visible).toBe(false);
    expect(retired).toHaveBeenCalledTimes(1);
    expect(first.applyFinalDamage(before, new Vector3(), new Vector3(0, 0, 1))).toBe(false);
    expect(damaged).toHaveBeenCalledTimes(2);
    expect(await session.retry()).toBe(true);
    const fresh = session.snapshot.actor;
    expect(fresh).not.toBe(first); expect(fresh?.alive).toBe(true);
    expect(fresh?.hidden).toBe(false); expect(fresh?.hp).toBe(before);
    expect(retired).toHaveBeenCalledTimes(2);
  } finally {
    session.dispose(); owner.dispose();
    for (const animal of instances) {
      animal.mesh.skeleton.dispose();
      for (const material of Array.isArray(animal.mesh.material) ? animal.mesh.material : [animal.mesh.material]) material.dispose();
    }
    model.geometry.dispose();
    for (const material of new Set([model.fur, model.hard, model.eye, ...model.shells])) material.dispose();
  }
});

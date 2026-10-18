import { expect, test, vi } from 'vitest';
import { Color } from 'three';
import { AnimalFactory } from '../src/engine/entities/AnimalFactory';
import { SkyRig } from '../src/engine/world/skyRig';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { Rng } from '../src/engine/core/rng';
import { instantiatePracticeRig } from '../src/game/practice/practiceRig';

test('practice uses a deterministic unit tint through the actual factory color conversion', () => {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const setup = vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const preload = vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  const owner = new Scope('practice-rig-test');
  const factory = new AnimalFactory(sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const model = factory.model('bear', 'brown');
  const rigs = owner.run(() => [
    instantiatePracticeRig(factory, model, new Rng(7001)),
    instantiatePracticeRig(factory, model, new Rng(7001)),
    factory.instantiate(model, 65771), // the previous integer-seed misuse produces the observed huge RGB values
  ]);
  try {
    const colors = rigs.map(rig => {
      const material = Array.isArray(rig.mesh.material) ? rig.mesh.material[0] : rig.mesh.material;
      if (material === undefined) throw new Error('Missing body material');
      const color: unknown = Reflect.get(material, 'color');
      if (!(color instanceof Color)) throw new Error('Missing lit body color');
      return color.toArray();
    });
    expect(colors[0]).toEqual(colors[1]);
    expect(colors[0]?.every(channel => channel >= 0.75 && channel <= 1.05)).toBe(true);
    expect(colors[2]?.[0]).toBeCloseTo(19732.05);
    expect(colors[2]?.every(channel => channel > 1000)).toBe(true);
  } finally {
    for (const rig of rigs) {
      rig.mesh.skeleton.dispose();
      for (const material of Array.isArray(rig.mesh.material) ? rig.mesh.material : [rig.mesh.material]) material.dispose();
    }
    model.geometry.dispose();
    for (const material of new Set([model.fur, model.hard, model.eye, ...model.shells])) material.dispose();
    owner.dispose(); setup.mockRestore(); preload.mockRestore();
  }
});

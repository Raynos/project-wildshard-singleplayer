// oxlint-disable-next-line import/no-nodejs-modules -- Load the shipped Rapier bytes for independent real worlds.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Scene } from 'three';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { Forest } from '../src/engine/world/forest/Forest';
import { SkyRig } from '../src/engine/world/skyRig';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { addPiece } from '../src/engine/physics/pieces';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test.each([true, false])('animal floors retain destination physics across source retirement: %s', async retained => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const source = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const destination = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const owner = new Scope('retained-herd'), previous = activeLevel(), previousPhysics = app.physics;
  configureLevel({ ...previous, ground: { structures: true } });
  const sky: unknown = Object.create(SkyRig.prototype), forest: unknown = Object.create(Forest.prototype);
  if (!(sky instanceof SkyRig) || !(forest instanceof Forest)) throw new Error('Missing native services');
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  try {
    for (const [host, y] of [[source, 9], [destination, 4]] as const) {
      host.scope.run(() => addPiece(host.physics, { id: 'floor', name: 'Floor', category: 'nature', file: 'fixture',
        colliders: [{ kind: 'box', x: 0, y: y - .5, z: 0, hx: 5, hy: .5, hz: 5 }] }));
      host.physics.world.step();
    }
    app.physics = source.physics;
    const manager = owner.run(() => new AnimalManager(new Scene(), sky, forest, { style: 'toon',
      render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
      ...(retained ? { physics: destination.physics } : {}) }));
    const animal = owner.run(() => manager.spawn('bear', 0, 0, 0, 'brown', { fromY: 12 }));
    expect(animal.position.y).toBeCloseTo(retained ? 4 : 9);
    if (retained) {
      source.dispose();
      expect(animal.groundHeight?.(0, 0, 12)).toBeCloseTo(4);
      const next = owner.run(() => manager.spawn('bear', 1, 0, 0, 'brown', { fromY: 12 }));
      expect(next.position.y).toBeCloseTo(4);
    }
  } finally { owner.dispose(); source.dispose(); destination.dispose(); app.physics = previousPhysics; configureLevel(previous); }
});

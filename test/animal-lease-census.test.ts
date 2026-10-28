// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real retained native physics world for spawned rigs.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Scene } from 'three';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalModel } from '../src/engine/entities/AnimalFactory';
import { Forest } from '../src/engine/world/forest/Forest';
import { SkyRig } from '../src/engine/world/skyRig';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { loadRapier } from '../src/engine/physics/rapier';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { addPiece } from '../src/engine/physics/pieces';
import { createSimHost } from '../src/engine/sim';
import { SIM_LEVEL } from './fixtures/sim-level/level';

function call(manager: AnimalManager, method: 'leaseModels' | 'outside' | 'dormant', ...args: unknown[]): unknown {
  const fn: unknown = Reflect.get(manager, method);
  if (typeof fn !== 'function') throw new Error('Missing actual animal lease operation');
  return Reflect.apply(fn, manager, args);
}

test('real rigs retain original ordered lease, grace, last-reader and wake-pending decisions', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), owner = new Scope('lease-census');
  const previous = activeLevel(); configureLevel({ ...previous, ground: { structures: true } });
  host.scope.run(() => addPiece(host.physics, { id: 'floor', name: 'Floor', category: 'nature', file: 'fixture',
    colliders: [{ kind: 'box', x: 0, y: -.5, z: 0, hx: 10, hy: .5, hz: 10 }] }));
  host.physics.world.step();
  const sky: unknown = Object.create(SkyRig.prototype), forest: unknown = Object.create(Forest.prototype);
  if (!(sky instanceof SkyRig) || !(forest instanceof Forest)) throw new Error('Missing native model services');
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  try {
    const manager = owner.run(() => new AnimalManager(new Scene(), sky, forest, { style: 'toon', physics: host.physics,
      render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } }));
    const one = owner.run(() => manager.spawn('bear', 0, 0, 0, 'brown', { y: 0 }));
    const two = owner.run(() => manager.spawn('bear', 2, 0, 0, 'brown', { y: 0 }));
    const three = owner.run(() => manager.spawn('bear', 4, 0, 0, 'black', { y: 0 }));
    const brown = manager.factory.model('bear', 'brown'), black = manager.factory.model('bear', 'black');
    const models = new Map<Animal, AnimalModel>([[one, brown], [two, brown], [three, black]]), last = new Map<AnimalModel, number>();
    const pending = new Set<AnimalModel>(), events: string[] = [];
    const nativeIn = manager.factory.leaseIn.bind(manager.factory), nativeOut = manager.factory.leaseOut.bind(manager.factory);
    vi.spyOn(manager.factory, 'leaseIn').mockImplementation(model => { events.push(`in:${model.variant}`); return nativeIn(model) && !pending.has(model); });
    vi.spyOn(manager.factory, 'leaseOut').mockImplementation(model => { events.push(`out:${model.variant}`); nativeOut(model); });
    // Frozen original Map/Set census from AnimalManager.ts at 8c6e32496d.
    const poll = (now: number): void => {
      const counts = new Map<AnimalModel, number>(), awake = new Set<AnimalModel>(), expected: string[] = [];
      for (const animal of manager.animals) {
        const model = models.get(animal); if (model === undefined) throw new Error('Missing original native model');
        counts.set(model, (counts.get(model) ?? 0) + 1);
        const outside = call(manager, 'outside', animal);
        if (typeof outside !== 'boolean') throw new Error('Missing actual resident predicate');
        if (!outside) awake.add(model);
      }
      for (const [model, count] of counts) {
        if (awake.has(model)) { last.set(model, now); expected.push(`in:${model.variant}`); continue; }
        const since = last.get(model);
        if (since === undefined) last.set(model, now);
        else if (now - since >= 10 && count === manager.factory.rigsOf(model)) expected.push(`out:${model.variant}`);
      }
      events.length = 0; call(manager, 'leaseModels', now); expect(events).toEqual(expected);
      for (const animal of manager.animals) {
        const model = models.get(animal); if (model === undefined) throw new Error('Missing original native model');
        expect(call(manager, 'dormant', animal)).toBe(Boolean(call(manager, 'outside', animal)) || (awake.has(model) && pending.has(model)));
      }
    };
    Reflect.set(manager, 'resident', (x: number) => x < 1);
    poll(0); poll(9.999); poll(10); expect(events).toEqual(['in:brown', 'out:black']);
    manager.animals.reverse(); poll(10); expect(events).toEqual(['out:black', 'in:brown']);
    Reflect.set(manager, 'resident', () => false);
    poll(10.001); poll(19.999); poll(20); expect(events).toEqual(['out:black', 'out:brown']);
    pending.add(brown); Reflect.set(manager, 'resident', () => true); poll(21);
    expect(call(manager, 'dormant', one)).toBe(true); expect(call(manager, 'dormant', three)).toBe(false);
    pending.clear(); poll(22); expect(call(manager, 'dormant', one)).toBe(false);
    const foreign = owner.run(() => manager.factory.instantiate(brown));
    try {
      Reflect.set(manager, 'resident', () => false); poll(32); expect(events).toEqual(['out:black']);
      manager.retire(two); poll(33); expect(events).toEqual(['out:black']);
      manager.retire(one); manager.retire(three); poll(34); expect(events).toEqual([]);
      // Restoring the same live rig to the manager retains its prior model's
      // grace history; another owner's reader still blocks leasing it out.
      manager.animals.push(one); poll(35); expect(events).toEqual([]);
      expect(manager.factory.rigsOf(brown)).toBe(3);
    } finally { foreign.mesh.skeleton.dispose(); for (const material of foreign.materials) material.dispose(); }
  } finally { owner.dispose(); host.dispose(); configureLevel(previous); vi.restoreAllMocks(); }
});

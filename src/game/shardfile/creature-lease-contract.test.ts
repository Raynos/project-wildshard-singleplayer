import { afterEach, expect, test, vi } from 'vitest';
import { Texture } from 'three';
import { AnimalFactory, type TextureLease } from '@wildshard/engine/entities/AnimalFactory';
import { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { followRing } from './tileDriver';
import { manager } from '@wildshard/engine/test/manager';
import { overrideTerrain } from '@wildshard/engine/test/terrain';

// T6.2: the KTX2 lease itself (GPU storage out, the file's mips back in) is the engine's; here the manager decides when
const lease = { out: new Set<Texture>(), back: new Map<Texture, () => void>() };
const fake: TextureLease = {
  out: texture => { if (lease.out.has(texture)) return false; lease.out.add(texture); return true; },
  leased: texture => lease.out.has(texture),
  back: texture => new Promise<void>(resolve => { lease.back.set(texture, () => { lease.out.delete(texture); lease.back.delete(texture); resolve(); }); }),
};

const cleanup: (() => void)[] = [];
afterEach(() => { vi.restoreAllMocks(); lease.out.clear(); lease.back.clear(); for (const stop of cleanup.splice(0).reverse()) stop(); });

function fixture() {
  cleanup.push(overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }));
  const scope = new Scope('creature-lease-contract'); cleanup.push(() => { scope.dispose(); });
  scope.expose(app, 'levelScope', scope); scope.expose(app, 'physics', null);
  const f = scope.run(() => manager()); cleanup.push(() => { f.game.playerScope.dispose(); });
  const factory: unknown = Reflect.get(f.manager, 'factory');
  if (!(factory instanceof AnimalFactory)) throw new Error('Missing creature factory');
  factory.lease = fake;
  const animal = scope.run(() => f.manager.spawn('bear', 0, 200, 0, 'brown', { y: 0 }));
  // the shared manager draws untextured low-poly bodies; a lease gives back a model's file textures, so the bear's model
  // paints with one before its rig first draws
  const models: unknown = Reflect.get(factory, 'models');
  if (!(models instanceof Map) || models.size !== 1) throw new Error('Missing creature model');
  const listed: unknown = Reflect.get(factory, 'textures');
  const built: unknown[] = [...models.values()];
  for (const model of built) if (typeof model === 'object' && model !== null) {
    Reflect.set(model, 'map', new Texture());
    if (listed instanceof Map || listed instanceof WeakMap) listed.delete(model); // the list its first draw took, without it
  }
  f.manager.setResidency(followRing());
  let t = 0;
  return { ...f, animal, scope, factory, step: (dt = .5): void => { t += dt; scope.run(() => { f.manager.update(dt, t, f.player.position, false); }); } };
}

test('a model whose animals all stay outside the ring gives its textures back after the grace, its actor untouched', () => {
  const f = fixture(), actor = JSON.stringify(f.animal.snapshot());
  for (let frame = 0; frame < 19; frame++) f.step();
  expect(lease.out.size).toBe(0);
  f.step(); f.step();
  expect(lease.out.size).toBeGreaterThan(0);
  expect(JSON.stringify(f.animal.snapshot())).toBe(actor);
  expect(f.animal.mesh.visible).toBe(false);
});

test('a woken animal stays dormant until its model has its textures back, then wakes in place', async () => {
  const f = fixture(), decisions = vi.spyOn(f.manager.scheduler, 'takeBrainDt').mockReturnValue(0);
  vi.spyOn(f.manager.scheduler, 'bodyDt').mockReturnValue(0);
  for (let frame = 0; frame < 25; frame++) f.step();
  expect(lease.out.size).toBeGreaterThan(0);
  f.animal.position.z = 0; f.step();
  expect(lease.back.size).toBe(lease.out.size);
  expect(decisions).not.toHaveBeenCalled(); expect(f.animal.mesh.visible).toBe(false);
  const returns = [...lease.back.values()];
  for (const done of returns) done();
  await Promise.resolve();
  f.step();
  expect(decisions).toHaveBeenCalledExactlyOnceWith(expect.any(String), f.animal);
  expect(f.animal.mesh.visible).toBe(true); expect(f.manager.animals).toEqual([f.animal]);
});

test('a rig the manager does not own keeps its model whole', () => {
  const f = fixture();
  f.scope.run(() => { f.factory.instantiate(f.factory.model('bear', 'brown'), .5); });
  for (let frame = 0; frame < 25; frame++) f.step();
  expect(lease.out.size).toBe(0);
});

test('closing the level takes every leased texture back', () => {
  const f = fixture();
  for (let frame = 0; frame < 25; frame++) f.step();
  const out = lease.out.size;
  expect(out).toBeGreaterThan(0);
  f.scope.dispose();
  expect(lease.back.size).toBe(out);
});

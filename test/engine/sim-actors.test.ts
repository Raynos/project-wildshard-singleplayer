// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the actual native physics engine.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { deferredRecipe, installDeferred } from '../fixtures/sim-level/deferred';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [] };
it.each([6, 18])('restores native deferred identities, pending strikes and the respawn wait at tick %i', checkpoint => {
  const original = createSimHost(level, { rapier }); installDeferred(original);
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < checkpoint; tick++) original.step();
    const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(original)));
    expect(saved.entities.map(actor => actor.id)).toEqual(checkpoint === 6 ? ['deferred:1'] : []);
    if (checkpoint === 6) expect(saved.strikes.find(strike => strike.id === 'deferred:1')?.state.phase).toBe('windup');
    restored = restoreSimHost(level, { rapier }, saved, fresh => { installDeferred(fresh, saved); });
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    for (let tick = checkpoint; tick < 100; tick++) {
      original.step(); restored.step();
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      if (tick === 22) expect([...restored.entities.keys()]).toEqual([]); // still waiting, no early respawn
      if (tick === 23) expect([...restored.entities.keys()]).toEqual(['deferred:2']);
    }
    expect(restored.player.health.attributes.health).toBeLessThan(100);
  } finally { restored?.dispose(); original.dispose(); }
});
it('owns deferred native resources independently of the caller and cancels retired strike targets', () => {
  const host = createSimHost(SIM_LEVEL, { rapier }), caller = new Scope('actor-caller');
  try {
    const before = host.physics.world.colliders.len(), bodies = host.physics.world.bodies.len();
    const recipe = deferredRecipe(1);
    const actor = withOwner(caller, () => host.spawn(recipe));
    recipe.spec = { ...recipe.spec, dims: { ...recipe.spec.dims, bodyRadius: 9 } };
    expect(actor.dims.bodyRadius).toBe(0.35);
    caller.dispose();
    expect(host.physics.world.colliders.len()).toBe(before + 1); expect(host.physics.world.bodies.len()).toBe(bodies);
    expect(() => host.spawn(deferredRecipe(1))).toThrow('Invalid dynamic');
    const release = host.onStep('runtime.actor.deferred:2', () => undefined);
    expect(() => host.spawn(deferredRecipe(2))).toThrow('Invalid dynamic'); release();
    expect(() => host.onStep('runtime.actor.deferred:1', () => undefined)).toThrow('registration');
    expect(host.startStrike(host.player.id, actor.entityId)).toBe(true);
    expect(host.retire('boar:1')).toBe(false); expect(host.retire(actor.entityId)).toBe(true); expect(host.retire(actor.entityId)).toBe(false);
    expect(host.strikes.get(host.player.id)?.busy).toBe(false); expect(host.attackTargets()).toEqual([]);
    expect(host.physics.world.colliders.len()).toBe(before); expect(host.physics.world.bodies.len()).toBe(bodies);
    host.spawn(deferredRecipe(1)); host.step();
    expect(host.entities.get('deferred:1')?.seed).toBe(71);
  } finally { caller.dispose(); host.dispose(); }
});
it('refuses missing rosters and changed trusted recipes before returning a restored host', () => {
  const host = createSimHost(level, { rapier }); host.spawn(deferredRecipe(1));
  try {
    const saved = snapshotSimHost(host);
    expect(() => restoreSimHost(level, { rapier }, saved)).toThrow('registrations');
    expect(() => restoreSimHost(level, { rapier }, saved, fresh => { fresh.spawn({ ...deferredRecipe(1), scale: 2 }); })).toThrow('recipe');
    expect(snapshotSimHost(host)).toEqual(saved);
  } finally { host.dispose(); }
});

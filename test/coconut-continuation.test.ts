// oxlint-disable-next-line import/no-nodejs-modules -- Exercise continuation on the shipped native physics bytes.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Rng } from '../src/engine/core/rng';
import { Bodies } from '../src/engine/physics/bodies';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { Coconuts, type CoconutPorts, type CoconutThrower } from '../src/shards/driftwood-isle/combat/coconuts';
import { DRIFTWOOD_STRIKES } from '../src/shards/driftwood-isle/combat/strikes';

function ports(bodies: Bodies | null): CoconutPorts<CoconutThrower> {
  return { bodies: () => bodies, rng: new Rng(37), owner: {}, surface: () => undefined,
    hit: vi.fn<CoconutPorts<CoconutThrower>['hit']>(), sound: vi.fn<CoconutPorts<CoconutThrower>['sound']>(),
    splash: vi.fn<CoconutPorts<CoconutThrower>['splash']>() };
}

test('a missing body service neither advances the volley cursor nor draws launch randomness', () => {
  const p = ports(null), volley = new Coconuts(p), before = p.rng.snapshot();
  volley.throw(new Vector3(), new Vector3(10, 0, 0), null);
  expect(p.rng.snapshot()).toEqual(before);
  expect(volley.snapshot(() => 0)).toEqual({ next: 0, slots: [] });
  volley.dispose();
});

test('coconut continuation reattaches saved bodies without respawning and consumes the current player contact once', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const physics = new Physics(rapier), bodies = new Bodies(physics), p = ports(bodies), volley = new Coconuts(p);
  const source = { position: new Vector3(10, 0, 10), kind: 'monkey', label: 'Monkey' }, player = new Vector3(100, 0, 100);
  let resumedPhysics: Physics | undefined;
  try {
    volley.throw(new Vector3(10, 2, 10), new Vector3(20, 2, 10), source);
    volley.throw(new Vector3(15, 3, 15), new Vector3(25, 3, 15), null);
    volley.update(0.1, 1, player);
    const saved = volley.snapshot(actor => actor === source ? 4 : -1);
    expect(saved.slots.map(slot => slot.thrower)).toEqual([4, -1]);
    resumedPhysics = new Physics(rapier, physics.snapshot());
    const resumedBodies = new Bodies(resumedPhysics), resumedPorts = ports(resumedBodies), resumed = new Coconuts(resumedPorts);
    resumedPorts.rng.restore(p.rng.snapshot());
    const reattach = resumed.restore(saved, index => index === 4 ? source : null);
    expect(resumedBodies.list).toHaveLength(0);
    reattach();
    expect(resumedBodies.list).toHaveLength(2);
    expect(resumedPhysics.world.bodies.len()).toBe(2);
    expect(resumed.snapshot(actor => actor === source ? 4 : -1)).toEqual(saved);
    for (let i = 0; i < 3; i++) {
      bodies.pre(); physics.step(); bodies.post(1 / 60); volley.update(1 / 60, 1, player);
      resumedBodies.pre(); resumedPhysics.step(); resumedBodies.post(1 / 60); resumed.update(1 / 60, 1, player);
    }
    const original = volley.bodyAt(0), restored = resumed.bodyAt(0);
    if (original === null || restored === null) throw new Error('Missing continued coconut');
    expect(restored.curr.x).toBeCloseTo(original.curr.x, 6);
    expect(restored.curr.y).toBeCloseTo(original.curr.y, 6);
    expect(restored.curr.z).toBeCloseTo(original.curr.z, 6);
    expect(resumedPorts.hit).not.toHaveBeenCalled();
    player.set(restored.curr.x, restored.curr.y - 1, restored.curr.z);
    resumed.update(0, 1, player); resumed.update(0, 1, player);
    expect(resumedPorts.hit).toHaveBeenCalledExactlyOnceWith(source, DRIFTWOOD_STRIKES.coconut.damage, DRIFTWOOD_STRIKES.coconut.id);
    expect(resumedPorts.sound).toHaveBeenCalledOnce();
    expect(restored.rb.linvel().y).toBeCloseTo(1.5);
    expect(resumed.snapshot(() => 4).slots[0]?.state).toBe(2);
    resumed.dispose(); expect(resumedBodies.list).toHaveLength(0);
    expect(resumedPhysics.world.bodies.len()).toBe(0);
  } finally { bodies.dispose(); resumedPhysics?.dispose(); physics.dispose(); }
});

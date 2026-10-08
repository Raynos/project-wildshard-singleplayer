// oxlint-disable-next-line import/no-nodejs-modules -- Read the clean-export physics binary in this Node fixture.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { fakeWorld } from '../fake/world';
import { manager } from '../fake/manager';
import { Physics } from '../../src/engine/physics/Physics';
import { CreatureBodies } from '../../src/engine/physics/creatures';
import { loadRapier } from '../../src/engine/physics/rapier';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer); });

function fixture() {
  const world = fakeWorld(), factory = new AnimalFactory(world.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } });
  const model = factory.model('boar', 'boar'), rig = factory.instantiate(model, 1);
  const view = new Animal(rig, model, 1, 1, 'fixture:1');
  const sim = new AnimalSim({ kind: 'boar', label: 'Boar', variant: 'boar', rarity: 'common', hp: 60, aggressive: false,
    dims: model.dims, mods: { speed: 1, chargeDist: 1, chargeDamage: 25, damageTaken: 1, relentless: false } }, 1, 1, 'fixture:1', { heightAt: () => 0, random: () => 0.5 });
  return { sim, view, rig, model };
}
describe('creature rig over one authoritative simulation', () => {
  it('shares actor health, positions and commands while render frames leave full host state unchanged', () => {
    const { sim, view } = fixture(); view.bindSimulation(sim);
    expect(view.combatActor()).toBe(sim.combatActor()); expect(view.position).toBe(sim.position);
    view.place(2, 3, 0); view.setMotion(0, 2); view.startAttack(1); sim.step(0.1);
    const before = sim.snapshot();
    for (let i = 0; i < 30; i++) view.update(1 / 60, i / 60, i % 2 === 0);
    expect(sim.snapshot()).toEqual(before); expect(view.mesh.position.toArray()).toEqual(sim.position.toArray());
    expect(view.attackPhase).toBe(sim.attackPhase);
    view.combatActor().attributes.health = 40; expect(sim.hp).toBe(40);
    view.applyFinalDamage(10, new Vector3(), new Vector3(0, 0, 1)); expect(sim.hp).toBe(30);
    view.update(1 / 60, 1, true); expect(view.hp).toBe(30);
    view.applyFinalDamage(30, new Vector3(), new Vector3(0, 0, 1));
    const dead = sim.snapshot(); view.update(1, 2, true); expect(sim.snapshot()).toEqual(dead); expect(view.alive).toBe(false);
  });
  it('retiring the view leaves the host motor alive and restores remain visible through the same vectors', () => {
    const { sim, view } = fixture(); view.bindSimulation(sim);
    const dispose = vi.fn<() => void>(); sim.motor = { move: () => undefined, dispose };
    sim.place(1, 2, 0); const saved = sim.snapshot(); sim.place(4, 5, 0);
    view.restore(saved); view.update(1 / 60, 0, false);
    expect(view.position.toArray()).toEqual(saved.position); view.retireBody(); expect(dispose).not.toHaveBeenCalled();
  });
  it('legacy manager renders bound views but never runs their brain, acts or retirement damage', () => {
    const { sim } = fixture(), world = manager();
    const view = world.manager.spawn('boar', 0, 0, 0, 'boar', { entityId: sim.entityId }); view.bindSimulation(sim);
    sim.place(0, 0, 0); sim.setMotion(0, 2); sim.state = 'charge'; sim.step(0.1);
    const saved = sim.snapshot();
    for (let i = 0; i < 30; i++) world.manager.update(1 / 60, i / 60, new Vector3(0, 0, 1));
    expect(sim.snapshot()).toEqual(saved); expect(view.mesh.position.toArray()).toEqual(sim.position.toArray());
    world.manager.retire(view); expect(sim.snapshot()).toEqual(saved); expect(world.manager.animals).not.toContain(view);
    expect(() => world.manager.replace(view, 0, 0, 0, 'boar')).toThrow('unreplaced retired actor');
  });
  it('keeps posed query hitboxes while leaving the only movement motor with the host', () => {
    const { sim, view } = fixture(); view.bindSimulation(sim);
    const dispose = vi.fn<() => void>(); sim.motor = { move: () => undefined, dispose };
    const physics = new Physics(rapier), bodies = new CreatureBodies<Animal>(physics);
    try {
      bodies.sync([view], new Vector3()); expect(physics.world.colliders.len()).toBe(2);
      expect(physics.world.bodies.len()).toBe(0); expect(view.motor).toBe(null);
      bodies.sync([view], new Vector3(100, 0, 100)); bodies.remove(view);
      expect(dispose).not.toHaveBeenCalled(); expect(sim.motor).not.toBe(null);
    } finally { physics.dispose(); }
  });
  it('refuses rebinding and mismatched instance identities', () => {
    const { sim, view } = fixture(); expect(() => view.bindSimulation(view)).toThrow();
    view.bindSimulation(sim); expect(() => view.bindSimulation(sim)).toThrow();
    const other = fixture(); Object.defineProperty(other.sim, 'entityId', { value: 'other:1' });
    expect(() => other.view.bindSimulation(other.sim)).toThrow();
  });
});

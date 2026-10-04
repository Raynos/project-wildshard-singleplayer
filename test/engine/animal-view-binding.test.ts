import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { fakeWorld } from '../fake/world';

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
  it('refuses rebinding and mismatched instance identities', () => {
    const { sim, view } = fixture(); expect(() => view.bindSimulation(view)).toThrow();
    view.bindSimulation(sim); expect(() => view.bindSimulation(sim)).toThrow();
    const other = fixture(); Object.defineProperty(other.sim, 'entityId', { value: 'other:1' });
    expect(() => other.view.bindSimulation(other.sim)).toThrow();
  });
});

import { describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { Vector3 } from 'three';
import { App } from '../../src/engine/app/app';
import type { DamageRequest } from '../../src/engine/combat/pipeline';
import { killBelowWorld } from '../../src/engine/entities/killHeight';
import { creature } from '../fake/creature';
import { Physics } from '../../src/engine/physics/Physics';
import { CharacterMotor } from '../../src/engine/physics/CharacterMotor';
import { loadRapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);

describe('creature impulse and world death plane', () => {
  it('copies impulses, adds them, collides with a wall through the ground motor and decays to rest', async () => {
    const { animal } = creature('crab', 'small'), impulse = new Vector3(6, 8, 0);
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
    physics.world.createCollider(R.ColliderDesc.cuboid(0.1, 5, 5).setTranslation(1, 0, 0).setCollisionGroups(groups('WORLD')));
    animal.motor = new CharacterMotor(physics, { radius: 0.2, height: 1, step: 0.2, maxClimbDeg: 40, snap: 0.2, group: 'CREATURE', blockedBy: ['WORLD'] });
    physics.step();
    animal.impulse(impulse); impulse.x = 100;
    animal.update(0.1, 0, false);
    expect(animal.position.x).toBeCloseTo(0.6); expect(animal.position.y).toBe(0);
    animal.impulse(new Vector3(2, 0, 0)); expect(animal.hasImpulse).toBe(true);
    for (let i = 0; i < 180; i++) { animal.update(1 / 60, i / 60, false); physics.step(); }
    expect(animal.position.x).toBeLessThan(0.71);
    expect(animal.hasImpulse).toBe(false);
    expect(() => animal.impulse(new Vector3(Infinity, 0, 0))).toThrow('finite');
    physics.dispose();
  });
  it('gives a flyer vertical impulse through its body without shard position writes', () => {
    const { animal } = creature('crab', 'small', {}, { altitude: 20, above: 'world', climbRate: 4, diveRate: 8 });
    animal.impulse(new Vector3(0, 10, 0)); animal.update(0.1, 0, false);
    expect(animal.position.y).toBe(21); expect(animal.hasImpulse).toBe(true);
  });
  it('keeps a world without killY unchanged, and reports one terminal cause below a declared plane', () => {
    const { animal } = creature('crab', 'small'), app = new App();
    const died = vi.fn((_event: { req: DamageRequest }): void => undefined), damaged = vi.fn((): void => undefined);
    app.events.on('actor.died', died, app.engineScope); app.events.on('damage.dealt', damaged, app.engineScope);
    app.combat.rule({ id: 'test.invulnerable', order: 1, when: {}, op: 'negate', value: 0 }, app.engineScope);
    expect(killBelowWorld(animal, undefined, app.combat)).toBe(false); expect(animal.alive).toBe(true);
    expect(killBelowWorld(animal, { killY: 0 }, app.combat)).toBe(false);
    expect(killBelowWorld(animal, { killY: 1 }, app.combat)).toBe(true); app.events.flush('update');
    expect(animal.alive).toBe(false); expect(animal.hp).toBe(0); expect(died).toHaveBeenCalledOnce(); expect(damaged).toHaveBeenCalledOnce();
    expect(died.mock.calls[0]?.[0].req.cause).toEqual({ kind: 'out-of-world', label: 'Out of world' });
    expect(killBelowWorld(animal, { killY: 1 }, app.combat)).toBe(false); app.events.flush('update'); expect(died).toHaveBeenCalledOnce();
  });
});

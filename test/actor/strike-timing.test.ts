// S1.3/S2.3: fixed-step windup/contact/recovery contracts move to the engine strike blocks.
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { LaneCharge } from '../../src/shards/pine-hollow/combat/ctx';
import { AnimalManager } from '../../src/engine/entities/AnimalManager';
import { Animal } from '../../src/engine/entities/Animal';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { getActiveChunk, setActiveChunk } from '../../src/game/shard/registry';
import { fakeWorld } from '../fake/world';
import { seedRandom } from '../fake/FakeGame';

// Flat arena fixture: timing must not depend on today's shard terrain or baked geometry.
// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);

const originalChunk = getActiveChunk().slug;
let restoreRandom: () => void = () => undefined;
beforeEach(() => { restoreRandom = seedRandom(); setActiveChunk('driftwood-isle'); });
afterEach(() => { restoreRandom(); setActiveChunk(originalChunk); });

function boar(): Animal {
  const world = fakeWorld(), factory = new AnimalFactory(world.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const model = factory.model('boar', 'sow');
  const a = new Animal(factory.instantiate(model, 0.5), model, 0.5);
  a.place(0, 0, 0);
  return a;
}

describe('strike timing at 60 fixed steps per second', () => {
  it('Pine LaneCharge tells for 36 steps, hits once in the run and recovers for 13 steps', () => {
    const { game } = fakeWorld(), a = boar(), player = new THREE.Vector3(0, 0, 3);
    const lane = new LaneCharge(game.scene, 0xff4444, { width: 2.4, speed: 12, overshoot: 2, dmg: 30, skid: 0.2, reach: 1.7 });
    const hits: { step: number; damage: number }[] = [];
    let step = 0;
    lane.start(a, player.x, player.z, 0.6);
    game.onFixed('step', (dt) => {
      step++;
      lane.update(a, dt, step * dt, player, (damage) => { hits.push({ step, damage }); });
      a.update(dt, step * dt, false);
    });
    const advance = (n: number): void => { for (let i = 0; i < n; i++) game.advance(1 / 60); };
    advance(35); expect(lane.state).toBe('tell'); expect(a.speed).toBe(0); expect(hits).toEqual([]);
    advance(1); expect(lane.state).toBe('run'); expect(a.attackPhase).toBe(-1);
    advance(37); expect(hits).toEqual([]);
    advance(1); expect(hits).toEqual([{ step: 74, damage: 30 }]);
    for (let i = 0; i < 200 && lane.state === 'run'; i++) advance(1);
    expect(lane.state).toBe('skid');
    const skidAt = step;
    advance(11); expect(lane.state).toBe('skid');
    // Repeated addition of 1/60 places the 0.2 boundary on step 13 in today's code.
    advance(2); expect(lane.state).toBe('none'); expect(step - skidAt).toBe(13);
    expect(hits).toHaveLength(1);
  });

  it('LaneCharge misses a sidestep and cancel prevents a pending hit', () => {
    const { game } = fakeWorld(), a = boar(), lane = new LaneCharge(game.scene, 0xff4444,
      { width: 2.4, speed: 12, overshoot: 2, dmg: 30, skid: 0.2, reach: 1.7 });
    const hurt = vi.fn<(damage: number) => void>();
    lane.start(a, 0, 3, 0.1);
    for (let i = 0; i < 120; i++) { lane.update(a, 1 / 60, i / 60, new THREE.Vector3(5, 0, 3), hurt); a.update(1 / 60, i / 60, false); }
    expect(hurt).not.toHaveBeenCalled();
    lane.start(a, a.position.x, a.position.z + 1, 0.1); lane.cancel();
    lane.update(a, 1, 3, a.position, hurt);
    expect(lane.busy).toBe(false); expect(hurt).not.toHaveBeenCalled();
  });

  it('AnimalManager boar charge waits for its 0.55s windup, hits once, then enters recovery', () => {
    const world = fakeWorld(), manager = new AnimalManager(world.game.scene, world.sky, world.forest, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
    // BloodFX is a private visual-only dependency whose constructor requires a canvas. No DOM in this contract.
    Reflect.set(manager, 'blood', { update: (): void => undefined, burst: (): void => undefined });
    const a = manager.spawn('boar', 0, 0, 0, 'sow');
    const hits: number[] = [], windups: { step: number; duration: number }[] = [];
    let step = 0;
    manager.onCharge = (_animal, damage) => { hits.push(damage); };
    manager.onWindup = (_animal, duration) => { windups.push({ step, duration }); };
    world.player.position.set(0, 0, 5);
    world.game.onFixed('step', (dt) => { step++; manager.update(dt, step * dt, world.player.position); });
    const advance = (n: number): void => { for (let i = 0; i < n; i++) world.game.advance(1 / 60); };
    // A real hit is the public trigger for the manager to engage an aggressive boar.
    a.applyDamage(1, a.position, new THREE.Vector3(0, 0, 1));
    for (let i = 0; i < 180 && windups.length === 0; i++) advance(1);
    expect(windups).toHaveLength(1); expect(windups[0]?.duration).toBe(0.55);
    world.player.position.set(0, 0, 1);
    const started = step;
    advance(29); expect(hits).toEqual([]); expect(a.state).toBe('charge');
    for (let i = 0; i < 90 && hits.length === 0; i++) advance(1);
    expect(hits).toHaveLength(1); expect(step - started).toBeGreaterThanOrEqual(33);
    expect(a.state).toBe('stalk');
    advance(30); expect(hits).toHaveLength(1);
  });
});

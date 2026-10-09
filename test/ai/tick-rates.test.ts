import { registerSpecies, speciesDef } from '../../src/engine/entities/species/registry';
import { afterEach, beforeEach, describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { getActiveChunk, setActiveChunk } from '../../src/game/shard/registry';
import { huntOf, manager } from '../fake/manager';
import { pinBrain } from '../../src/engine/ai/inspect';
import { Flock } from '../../src/shards/nalati-grasslands/creatures/flock';
import { Marmots } from '../../src/shards/nalati-grasslands/creatures/marmots';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const originalChunk = getActiveChunk().slug;
beforeEach(() => { setActiveChunk('driftwood-isle'); });
afterEach(() => { setActiveChunk(originalChunk); });
describe('distance-banded creature clocks', () => {
  it.each([[2, 40, 120], [59, 40, 120], [60, 20, 60], [159, 20, 60], [160, 0, 0], [180, 0, 0]])('at %dm dispatches %i brains and %i bodies over two seconds', (distance, brains, bodies) => {
    const f = manager(), a = f.manager.spawn('boar', 0, distance, 0, 'boar');
    const ticks: number[] = [];
    const body = vi.fn(); Reflect.set(a, 'update', body);
    Reflect.set(f.manager, 'think', (actor: Animal, dt: number): void => { expect(actor).toBe(a); ticks.push(dt); });
    f.advance(120); expect(ticks).toHaveLength(brains); expect(body).toHaveBeenCalledTimes(bodies);
    if (brains) expect(ticks.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(2);
  });
  it.each([2, 80, 180])('preserves unmigrated custom species at 10Hz at %dm until S4.2', (distance) => {
    const f = manager(), think = vi.fn<() => void>();
    registerSpecies({ ...speciesDef('boar'), kind: 'test-unmigrated-custom', think });
    const a = f.manager.spawn('test-unmigrated-custom', 0, distance, 0, 'boar');
    Reflect.set(f.manager, 'think', think); f.advance(120);
    expect(think).toHaveBeenCalledTimes(20); expect(a.alive).toBe(true);
  });
  it.each([[40, 40, 120], [100, 20, 60], [200, 0, 0]])('migrated custom brain at %dm uses %i decisions and %i body strike steps', (distance, decisions, bodies) => {
    const f = manager(), think = vi.fn<() => void>(), act = vi.fn<() => void>();
    registerSpecies({ ...speciesDef('boar'), kind: 'test-nalati-ai', tick: 'ai', think, act });
    const a = f.manager.spawn('test-nalati-ai', 0, distance, 0, 'boar');
    const pose = vi.fn(); Reflect.set(a, 'update', pose); f.advance(120);
    expect(think).toHaveBeenCalledTimes(decisions); expect(act).toHaveBeenCalledTimes(bodies); expect(pose).toHaveBeenCalledTimes(bodies);
    if (bodies) expect(act.mock.invocationCallOrder[0]).toBeLessThan(pose.mock.invocationCallOrder[0] ?? Infinity);
    const before = think.mock.calls.length; f.manager.interrupt(a, 'hit'); expect(think).toHaveBeenCalledTimes(before + 1);
  });
  it('keeps bosses, elites, driven mounts and scripted quest actors moving outside the far band', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'); pinBrain(a);
    const body = vi.fn(); Reflect.set(a, 'update', body); f.advance(60); expect(body).toHaveBeenCalledTimes(60);
  });
  it('re-thinks a far actor immediately on a hit without moving its body', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'), think = vi.fn<() => void>(), body = vi.fn();
    Reflect.set(f.manager, 'think', think); Reflect.set(a, 'update', body); f.advance(1);
    f.manager.interrupt(a, 'hit'); expect(think).toHaveBeenCalledTimes(1); expect(body).not.toHaveBeenCalled();
  });
  it('a harness-held animal has neither a brain tick nor a body attack tick', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 0, 2, 'boar'); a.harnessHold = true; a.startAttack(1);
    const think = vi.fn<() => void>(); Reflect.set(f.manager, 'think', think);
    f.advance(120); expect(think).not.toHaveBeenCalled(); expect(a.attackPhase).toBe(0);
  });
  it('an engaged encounter uses body and brain every frame until its child scope ends', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'), scope = new Scope('engaged-fixture');
    const think = vi.fn<() => void>(), body = vi.fn();
    Reflect.set(f.manager, 'think', think); Reflect.set(a, 'update', body);
    pinBrain(a, scope); f.advance(60); expect(think).toHaveBeenCalledTimes(60); expect(body).toHaveBeenCalledTimes(60);
    scope.dispose(); f.advance(60); expect(think).toHaveBeenCalledTimes(60); expect(body).toHaveBeenCalledTimes(60);
  });
  it('public app pins and interrupts reach the manager clock immediately', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'), scope = new Scope('quest');
    const think = vi.fn<(actor: Animal, dt: number) => void>(), body = vi.fn(); Reflect.set(f.manager, 'think', think); Reflect.set(a, 'update', body);
    app.scheduler.pin(a, scope); f.advance(60);
    expect(think).toHaveBeenCalledTimes(20); expect(body).toHaveBeenCalledTimes(60);
    scope.dispose(); f.advance(1); app.scheduler.interrupt(a, 'target.dodge');
    expect(think).toHaveBeenCalledTimes(21); expect(think.mock.lastCall?.[1]).toBe(0);
    expect(body).toHaveBeenCalledTimes(60);
  });
  it('advances a charge wind-up on body frames between decision ticks', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 5, 0, 'boar');
    const brain = huntOf(f.manager).memory(a); if (brain === undefined) throw new Error('missing brain');
    Object.assign(brain, { windup: 0.04, timer: 10 }); a.state = 'charge'; a.startAttack(0.04);
    const think = vi.fn<() => void>(); Reflect.set(f.manager, 'think', think);
    f.advance(1); expect(think).not.toHaveBeenCalled(); expect(Reflect.get(brain, 'windup')).toBeCloseTo(0.04 - 1 / 60);
    f.advance(2); expect(think).toHaveBeenCalledTimes(1); expect(Reflect.get(brain, 'windup')).toBe(0);
  });
  it.each([[20, 40, 120], [100, 20, 60], [200, 0, 0]])('a sheep flock at %dm uses %i decisions and %i body frames', (distance, brains, bodies) => {
    const f = manager(), flock = new Flock(f.sky, { x: 0, z: distance, count: 3, seed: 357 });
    const think = vi.fn<() => void>(), draw = vi.fn(); Reflect.set(flock, 'think', think); Reflect.set(flock, 'writeInstances', draw);
    for (let frame = 0; frame < 120; frame++) flock.update(1 / 60, frame / 60, f.player.position, 0, []);
    expect(think).toHaveBeenCalledTimes(brains); expect(draw).toHaveBeenCalledTimes(bodies);
  });
  it('pauses far marmot decisions and motion, then resumes nearby (J2)', () => {
    const f = manager(), marmots = new Marmots(f.sky, 357).build([{ x: 0, z: 0 }]);
    const list: unknown = Reflect.get(marmots, 'list'); if (!Array.isArray(list)) throw new Error('marmots moved');
    const m: unknown = list[0]; if (typeof m !== 'object' || m === null) throw new Error('marmot missing');
    Object.assign(m, { state: 3, t: 100, x: 0, z: 0, bx: 10, bz: 0, sink: 0 });
    const pose = Array.from(marmots.mesh.instanceMatrix.array);
    f.player.position.z = 200;
    for (let frame = 0; frame < 30; frame++) marmots.update(1 / 30, f.player.position, 0, true);
    expect(Reflect.get(m, 't')).toBe(100);
    expect(Reflect.get(m, 'x')).toBe(0);
    expect(Reflect.get(m, 'sink')).toBe(0);
    expect(Array.from(marmots.mesh.instanceMatrix.array)).toEqual(pose);
    f.player.position.z = 30;
    for (let frame = 0; frame < 30; frame++) marmots.update(1 / 30, f.player.position, 0, true);
    expect(Reflect.get(m, 't')).toBeCloseTo(99);
    expect(Reflect.get(m, 'x')).toBeCloseTo(0.35);
    expect(Array.from(marmots.mesh.instanceMatrix.array)).not.toEqual(pose);
  });
  it('holds a far burrow arrival until the colony resumes nearby (J2)', () => {
    const f = manager(), marmots = new Marmots(f.sky, 357).build([{ x: 0, z: 0 }]);
    const list: unknown = Reflect.get(marmots, 'list'); if (!Array.isArray(list)) throw new Error('marmots moved');
    const m: unknown = list[0]; if (typeof m !== 'object' || m === null) throw new Error('marmot missing');
    Object.assign(m, { state: 2, t: 3, x: 1, z: 0, bx: 0, bz: 0 });
    const pose = Array.from(marmots.mesh.instanceMatrix.array);
    f.player.position.z = 200;
    for (let frame = 0; frame < 9; frame++) marmots.update(1 / 30, f.player.position, 0, true);
    expect(Reflect.get(m, 'state')).toBe(2);
    expect(Reflect.get(m, 't')).toBe(3);
    expect(Array.from(marmots.mesh.instanceMatrix.array)).toEqual(pose);
    f.player.position.z = 30;
    for (let frame = 0; frame < 9; frame++) marmots.update(1 / 30, f.player.position, 0, true);
    expect(Reflect.get(m, 'state')).toBe(3);
    expect(Reflect.get(m, 't')).toBeGreaterThanOrEqual(10);
    expect(Reflect.get(m, 't')).toBeLessThan(18);
    expect(Array.from(marmots.mesh.instanceMatrix.array)).not.toEqual(pose);
  });
});

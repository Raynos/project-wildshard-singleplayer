import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Animal } from '#engine/entities/Animal';
import type * as Heightfield from '#engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import { manager } from '../fake/manager';
import { pinBrain } from '#engine/ai/inspect';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
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
    const f = manager(), a = f.manager.spawn('crab', 0, distance, 0, 'small'), think = vi.fn();
    Reflect.set(f.manager, 'think', think); f.advance(120);
    expect(think).toHaveBeenCalledTimes(20); expect(a.alive).toBe(true);
  });
  it('keeps bosses, elites, driven mounts and scripted quest actors moving outside the far band', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'); pinBrain(a);
    const body = vi.fn(); Reflect.set(a, 'update', body); f.advance(60); expect(body).toHaveBeenCalledTimes(60);
  });
  it('re-thinks a far actor immediately on a hit without moving its body', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 200, 0, 'boar'), think = vi.fn(), body = vi.fn();
    Reflect.set(f.manager, 'think', think); Reflect.set(a, 'update', body); f.advance(1);
    f.manager.interrupt(a, 'hit'); expect(think).toHaveBeenCalledTimes(1); expect(body).not.toHaveBeenCalled();
  });
  it('a harness-held animal has neither a brain tick nor a body attack tick', () => {
    const f = manager(), a = f.manager.spawn('crab', 0, 0, 2, 'small'); a.harnessHold = true; a.startAttack(1);
    const think = vi.fn(); Reflect.set(f.manager, 'think', think);
    f.advance(120); expect(think).not.toHaveBeenCalled(); expect(a.attackPhase).toBe(0);
  });
});

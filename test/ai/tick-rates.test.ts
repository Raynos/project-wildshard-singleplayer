import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Animal } from '#engine/entities/Animal';
import type * as Heightfield from '#engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import { manager } from '../fake/manager';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
const originalChunk = getActiveChunk().slug;
beforeEach(() => { setActiveChunk('driftwood-isle'); });
afterEach(() => { setActiveChunk(originalChunk); });
describe('current brain clock; S2.6 intentionally changes the distance bands', () => {
  it.each([2, 30, 80, 180])('at %dm, the real manager still dispatches 10Hz with dt=.1', (distance) => {
    const f = manager(), a = f.manager.spawn('crab', 0, 0, distance, 'small');
    const ticks: number[] = [];
    Reflect.set(f.manager, 'think', (actor: Animal, dt: number): void => { expect(actor).toBe(a); ticks.push(dt); });
    f.advance(120); expect(ticks).toHaveLength(19); expect(new Set(ticks)).toEqual(new Set([0.1]));
    f.advance(1); expect(ticks).toHaveLength(20); // floating-point accumulation boundary
  });
  it('a harness-held animal has neither a brain tick nor a body attack tick', () => {
    const f = manager(), a = f.manager.spawn('crab', 0, 0, 2, 'small'); a.harnessHold = true; a.startAttack(1);
    const think = vi.fn(); Reflect.set(f.manager, 'think', think);
    f.advance(120); expect(think).not.toHaveBeenCalled(); expect(a.attackPhase).toBe(0);
  });
});

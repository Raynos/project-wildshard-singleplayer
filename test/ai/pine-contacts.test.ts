import { describe, expect, it, vi } from 'vitest';
import { StrikeRunner } from '../../src/engine/ai/strikes';
import { PINE_STRIKES } from '../../src/shards/pine-hollow/combat/strikes';
import { inArc, ringCatches } from '../../src/shards/pine-hollow/combat/combatMath';
import { huntOf, manager } from '../fake/manager';

describe('authored Pine contacts on the goal clock', () => {
  it('preserves both measured sweep arcs at every sampled world point, independent of actor scale', () => {
    const runner = new StrikeRunner(), f = manager(), actor = f.manager.spawn('boar', 0, 0, 0, 'ironhide');
    for (let x = -8; x <= 8; x += 0.25) for (let z = -8; z <= 8; z += 0.25) {
      const expected = inArc(0, 0, 0, x, z, 1.31, 4) || inArc(0, 0, -0.26, x, z, 0.52, 7.1);
      expect(runner.contact(PINE_STRIKES.sweep, { actor, target: { x, y: 0, z }, canReach: () => true, hit: () => undefined })).toBe(expected);
    }
  });
  it('preserves the traveling root band and airborne dodge while ignoring cover', () => {
    const runner = new StrikeRunner(), f = manager(), actor = f.manager.spawn('boar', 0, 0, 0, 'boar'), cover = vi.fn(() => false);
    for (const airborne of [false, true]) for (const radius of [4.4, 7.2, 18.6]) for (const d of [radius - 1, radius - 0.5, radius, radius + 0.5, radius + 1]) {
      expect(runner.contact(PINE_STRIKES.roots, { actor, target: { x: 0, y: 0, z: d }, ringRadius: radius, airborne, canReach: cover, hit: () => undefined })).toBe(ringCatches(d, radius, 0.9, airborne));
    }
    expect(cover).not.toHaveBeenCalled();
  });
  it('keeps lantern contact strictly inside three meters and roar damage12/cover exemption', () => {
    const runner = new StrikeRunner(), f = manager(), actor = f.manager.spawn('boar', 0, 0, 0, 'boar'), damage: number[] = [];
    const context = { actor, target: { x: 20, y: 0, z: 3 }, origin: { x: 20, y: 0, z: 0 }, canReach: () => false, hit: (row: { damage: number }) => { damage.push(row.damage); } };
    expect(runner.contact(PINE_STRIKES.lantern, context)).toBe(false);
    context.target.z = 2.99; expect(runner.contact(PINE_STRIKES.lantern, context)).toBe(true);
    context.target.x = 0; context.target.z = 8; context.origin.x = 0;
    expect(runner.contact(PINE_STRIKES.roar, context)).toBe(true); expect(damage).toEqual([9, 12]);
  });
  it('retires one manager actor idempotently without disturbing its neighbor', () => {
    const f = manager(), a = f.manager.spawn('boar', 0, 0, 0, 'boar'), b = f.manager.spawn('boar', 1, 0, 0, 'boar');
    f.manager.retire(a); f.manager.retire(a);
    expect(f.manager.animals).toEqual([b]); expect(a.alive).toBe(false); expect(a.hidden).toBe(true); expect(a.mesh.parent).toBeNull();
    const hunt = huntOf(f.manager);
    expect(hunt.memory(a)).toBeUndefined(); expect(hunt.memory(b)).toBeDefined();
    f.advance(1); expect(b.alive).toBe(true);
  });
});

import { describe, expect, it, afterAll } from 'vitest';
import { overrideTerrain } from '#engine/world/Heightfield';
import { creature } from '../fake/creature';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);

describe('legacy state sequences (replace with HFSM imports at S2.3/S4.2)', () => {
  it('crab approaches, snaps, recovers, then loses a distant player', () => {
    const f = creature('crab', 'small'); f.advance(80);
    expect(f.states).toEqual(['idle', 'sidestep', 'attack', 'sidestep']);
    expect(f.hits).toEqual([{ frame: 43, damage: 10 }]);
    f.ctx.player.z = 30; f.advance(18); expect(f.states.at(-1)).toBe('idle');
  });
  it('a fresh hit interrupts the crab windup and enforces a recovery before another snap', () => {
    const f = creature('crab', 'small'); f.advance(24); expect(f.starts).toHaveLength(1);
    f.animal.lastHitT = 1; f.advance(36); expect(f.hits).toEqual([]); expect(f.starts).toHaveLength(1);
    f.advance(48); expect(f.starts.length).toBeGreaterThan(1);
  });
  it('the small crab flees when its big herd mate dies and becomes shy', () => {
    const f = creature('crab', 'small'), leader = creature('crab', 'big').animal;
    leader.alive = false; f.ctx.herd = [f.animal, leader]; f.advance(7);
    expect(f.states).toEqual(['flee']); expect(f.animal.mem['shy']).toBe(1); expect(f.sounds).toContain('crab_click');
  });
  it('the sailor rises, guards, swings, and sinks after the player leaves', () => {
    const f = creature('sailor', 'sailor'); f.advance(230);
    expect(f.states.slice(0, 4)).toEqual(['rise', 'stalk', 'attack', 'stalk']);
    expect(f.hits.map((h) => h.damage)).toContain(14);
    f.ctx.player.z = 30; f.advance(480); expect(f.states.at(-1)).toBe('hide');
  });
  it('captain stays hidden until awakened, then rises and fights', () => {
    const f = creature('captain', 'captain'); f.advance(30); expect(f.states).toEqual(['hide']);
    f.animal.mem['awake'] = 1; f.advance(220);
    expect(f.states.slice(0, 4)).toEqual(['hide', 'rise', 'stalk', 'attack']);
    expect(f.hits.map((h) => h.damage)).toContain(24);
  });
});

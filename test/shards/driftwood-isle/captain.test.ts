import { describe, expect, it } from 'vitest';
import { CAPTAIN_DEF } from '../../../src/shards/driftwood-isle/combat/captain';
import { captainPhase } from '../../../src/shards/driftwood-isle/species/captainPolicy';
import { captainFixture } from '../../fake/captain';

describe('Drowned Captain authored encounter', () => {
  it('declares exactly the existing fight and disables the runtime extras', () => {
    expect(CAPTAIN_DEF).toEqual({
      id: 'boss.captain', name: 'boss.captain.name', arena: { at: 'shrine.pool', r: 22 }, wake: { flag: 'used:altar' },
      intro: null, seal: false, checkpoint: false, bar: 'boss',
      phases: [{ at: 1, strikes: ['strike.captain.swing'] },
        { at: 0.66, strikes: ['strike.captain.swing', 'strike.captain.burst'] },
        { at: 0.33, strikes: ['strike.captain.swing', 'strike.captain.second-cut', 'strike.captain.burst'] }],
      reward: null, persist: { deadFlag: 'dead:captain' }, capExempt: true,
    });
  });
  it('restores asleep until approaching the pool; the bar keeps the strict arena and rise edges', () => {
    const f = captainFixture(); f.flags.add('used:altar'); f.player.position.z = 22;
    f.boss.update(1 / 60, 0); expect(f.actor.mem['awake']).toBeUndefined(); expect(f.ui.barShown).toBe(false);
    f.player.position.z = 21.99; f.actor.mem['rise'] = 0.5;
    f.boss.update(1 / 60, 0); expect(f.actor.mem['awake']).toBe(1); expect(f.ui.barShown).toBe(false);
    f.actor.mem['rise'] = 0.5001; f.boss.update(1 / 60, 0);
    expect(f.ui.showBar).toHaveBeenCalledWith('The Drowned Captain', [0.66, 0.33]);
    f.actor.hp = 100; f.actor.mem['phase'] = captainPhase(f.actor.hp, 320); f.boss.update(1 / 60, 0);
    expect(f.actor.hp).toBe(100); expect(f.boss.phase).toBe(2); expect(f.boss.checkpoint).toBe(0);
    expect(f.ui.showNameCard).not.toHaveBeenCalled(); expect(f.ui.showRetry).not.toHaveBeenCalled(); expect(f.ui.setPhase).not.toHaveBeenCalled();
    f.player.position.z = 22; f.boss.update(1 / 60, 0); expect(f.ui.barShown).toBe(false);
    f.scope.dispose();
  });
});

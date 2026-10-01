import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import type * as Heightfield from '#engine/world/Heightfield';
import { manager } from '../fake/manager';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
const originalChunk = getActiveChunk().slug;
afterEach(() => { setActiveChunk(originalChunk); });
describe('the real manager aggression director', () => {
  it.each(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack'])('%s preserves its current attacker policy', (slug) => {
    setActiveChunk(slug); const f = manager();
    const animals = Array.from({ length: 5 }, (_, i) => f.manager.spawn('crab', (i - 2) * 0.1, 0, 0, 'small'));
    f.player.position.set(0, 0, 1.5);
    f.advance(25);
    const attacking = animals.filter((a) => a.attackPhase >= 0);
    expect(attacking).toHaveLength(slug === 'driftwood-isle' ? 2 : 5);
    if (slug === 'driftwood-isle') {
      const holder = attacking[0]; if (holder === undefined) throw new Error('no token holder');
      holder.alive = false; holder.cancelAttack();
      f.advance(18);
      expect(animals.filter((a) => a.alive && a.attackPhase >= 0)).toHaveLength(2);
      expect(animals.some((a) => !attacking.includes(a) && a.attackPhase >= 0)).toBe(true);
    }
  });
});

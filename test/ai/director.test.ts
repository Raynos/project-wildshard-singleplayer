import { afterEach, describe, expect, it, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '../../src/game/shard/registry';
import { manager } from '../fake/manager';
import { creature } from '../fake/creature';
import { Pack } from '../../src/shards/nalati-grasslands/runtime/packLegacy';
import { wildEnv } from '../../src/shards/nalati-grasslands/creatures/env';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const originalChunk = getActiveChunk().slug;
const wasMounted = wildEnv.playerMounted;
afterEach(() => { setActiveChunk(originalChunk); wildEnv.playerMounted = wasMounted; });
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
describe('Nalati pack token policy is independent of the shard director', () => {
  it.each([[false, false, false, 1], [true, false, false, 2], [false, true, false, 2], [true, true, false, 3], [true, false, true, 1]] as const)('mounted%s bold%s prey%s permits%s lungers', (mounted, bold, prey, expected) => {
    const f = creature('crab', 'small'), members = Array.from({ length: 5 }, (_, i) => {
      const a = creature('crab', 'small').animal; a.position.set(i * 0.2, 0, 2); Object.assign(a.mem, { lunge: 0, role: 1 }); return a;
    });
    wildEnv.playerMounted = mounted;
    const pack = legacyActor(Pack.prototype, { members, prey: prey ? { position: f.ctx.player, yaw: 0 } : null, boldT: bold ? 10 : 0,
      nextTokenT: 0, bites: 0, directors: undefined });
    for (let i = 0; i < 5; i++) { f.ctx.t = i * 10; invokeLegacy(pack, 'assignToken', f.ctx); }
    expect(members.filter((a) => a.mem['lunge'] === 1)).toHaveLength(expected);
  });
});

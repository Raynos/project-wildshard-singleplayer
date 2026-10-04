import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { BossBrain, type BossDefinition, type BossScript } from '../../../src/engine/ai/BossBrain';
import { silentBossPresentation } from '../../../src/engine/ai/phases';
import { ANTLER_KING_ENCOUNTER } from '../../../src/shards/pine-hollow/data/antlerKing';
import recorded from '../../fixtures/pine/antler-phases-before.json';

function encounter(definition: Omit<BossDefinition, 'reward'>) {
  let tick = 0, hp = 1, dead = false;
  const calls: { tick: number; event: string; value: string | number | boolean }[] = [];
  const call = (event: string, value: string | number | boolean = '') => { calls.push({ tick, event, value }); };
  const point = new Vector3(), saved = { defeated: false, rewardTaken: false, kills: 0 };
  const script: BossScript = {
    inArena: () => true, reset: phase => { hp = definition.phases[phase]?.at ?? 1; dead = false; call('reset', phase); },
    seal: on => { call('seal', on); }, intro: () => point, begin: phase => { call('begin', phase); },
    enterPhase: phase => { call('phase', phase); }, update: () => undefined,
    get hpFrac() { return hp; }, shielded: false, get dead() { return dead; },
    clampHp: value => { hp = value; call('clamp', value); }, setInvulnerable: on => { call('shield', on); },
    victory: () => { call('victory'); }, rewardPoint: () => point, respawnPoint: () => ({ pos: point, yaw: 0 }),
  };
  const boss = new BossBrain({ ...definition, reward: { trophy: () => { call('trophy'); } } }, script, {
    player: { position: point }, lockInput: on => { call('lock', on); }, respawn: () => { call('respawn'); },
    skipHeld: () => false, faceToward: () => undefined, spawnReward: () => { call('reward'); },
    persist: value => { call('persist', JSON.stringify(value)); }, music: event => { call('music', event); },
    feed: text => { call('feed', text); }, toast: text => { call('toast', text); },
  }, silentBossPresentation(), saved);
  return { boss, calls, advance: (next: number) => {
    tick = next;
    if ([400, 900, 1900, 2200].includes(tick)) hp = 0.1;
    if ([550, 950].includes(tick)) boss.onPlayerDeath();
    if ([1200, 2500].includes(tick)) dead = true;
    if (tick === 1300) saved.rewardTaken = true;
    if (tick === 1600) { boss.disarm(); boss.arm(); }
    boss.update(1 / 60, tick / 60);
  }, physical: () => ({ hp, dead }), restorePhysical: (state: { hp: number; dead: boolean }) => { hp = state.hp; dead = state.dead; } };
}
describe('Antler King shipping table as data', () => {
  it('matches the recorded production table and its real checkpoint/reward engine for 10,000 ticks', () => {
    expect(recorded.path).toBe('src/shards/pine-hollow/combat/antlerKing.ts');
    expect(recorded.source).toMatch(/^[a-f0-9]{40}$/u);
    expect(ANTLER_KING_ENCOUNTER).toEqual(recorded.definition);
    const before = encounter(recorded.definition), after = encounter(ANTLER_KING_ENCOUNTER);
    before.boss.arm(); after.boss.arm();
    for (let tick = 1; tick <= 10000; tick++) {
      before.advance(tick); after.advance(tick);
      expect(after.boss.snapshot()).toEqual(before.boss.snapshot());
      expect(after.physical()).toEqual(before.physical());
    }
    expect(after.calls).toEqual(before.calls);
    expect(after.calls.filter(row => row.event === 'phase').map(row => row.value)).toEqual([1, 2, 1, 2]);
    expect(after.calls.filter(row => row.event === 'respawn')).toHaveLength(2);
    expect(after.calls.filter(row => row.event === 'reward')).toHaveLength(1);
    expect(after.boss.snapshot().saved).toEqual({ defeated: true, rewardTaken: true, kills: 2 });
  });
  it('restores during the real phase-one retry intro without replaying native actions or rewards', () => {
    const original = encounter(ANTLER_KING_ENCOUNTER); original.boss.arm();
    for (let tick = 1; tick <= 575; tick++) original.advance(tick);
    const fresh = encounter(ANTLER_KING_ENCOUNTER);
    fresh.restorePhysical(original.physical()); fresh.boss.restore(original.boss.snapshot());
    expect(fresh.calls).toEqual([]);
    const offset = original.calls.length;
    for (let tick = 576; tick <= 10575; tick++) {
      original.advance(tick); fresh.advance(tick);
      expect(fresh.boss.snapshot()).toEqual(original.boss.snapshot());
    }
    expect(fresh.calls).toEqual(original.calls.slice(offset));
  });
});

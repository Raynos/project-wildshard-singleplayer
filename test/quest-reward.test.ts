// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '#engine';
import { QuestRewardBeat } from '#game';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); document.body.replaceChildren(); });

function beat(takeover = false) {
  const scope = new Scope('reward.test'); scopes.push(scope);
  const player = { position: new Vector3(0, 0, 0), velocity: new Vector3(1, 0, 1), yaw: 3, pitch: 0, carried: false };
  const dayNight = { phase: 0.9 }, objective = document.createElement('div');
  const setViewmodel = vi.fn<(on: boolean) => void>(), sting = vi.fn<() => void>(), finish = vi.fn(() => takeover);
  let ready = false;
  const reward = new QuestRewardBeat({ scope, player, dayNight, objective, setViewmodel, sting }, {
    kicker: 'Opened', title: 'The Ring', subtitle: 'Golden hour', at: new Vector3(10, 2, 0), yaw: -3, pitch: 0.5, phase: 0.745,
    when: () => ready, finish,
  });
  return { scope, player, dayNight, objective, setViewmodel, sting, finish, reward, start: () => { ready = true; } };
}

describe('Wendell reward beat shared by all shards', () => {
  it('eases by the shortest yaw and forward clock path; holds for seven seconds then releases once', () => {
    const h = beat(); h.reward.update(1); expect(h.sting).not.toHaveBeenCalled();
    h.start(); h.reward.update(1.25);
    expect(h.player.position.toArray()).toEqual([5, 1, 0]); expect(h.player.yaw).toBeCloseTo(Math.PI);
    expect(h.player.velocity.length()).toBe(0); expect(h.player.carried).toBe(true);
    expect(h.dayNight.phase).toBeCloseTo(0.14636); expect(h.objective.classList.contains('ws-quest-hide')).toBe(true);
    h.reward.update(2.25); expect(h.dayNight.phase).toBeCloseTo(0.745);
    h.reward.update(3.5); expect(h.finish).not.toHaveBeenCalled();
    h.reward.update(0.01); h.reward.update(8);
    expect(h.finish).toHaveBeenCalledOnce(); expect(h.sting).toHaveBeenCalledOnce();
    expect(h.player.carried).toBe(false); expect(h.setViewmodel.mock.calls).toEqual([[false], [true]]);
  });
  it('hands camera ownership to the completion card without raising the weapon', () => {
    const h = beat(true); h.start(); h.reward.update(8);
    expect(h.player.carried).toBe(true); expect(h.setViewmodel.mock.calls).toEqual([[false]]);
  });
  it('releases the held player and removes the caption when disposed mid-beat', () => {
    const h = beat(); h.start(); h.reward.update(1); h.scope.dispose(); h.reward.update(8);
    expect(h.player.carried).toBe(false); expect(document.querySelector('.ws-quest-reward')).toBeNull();
    expect(h.finish).not.toHaveBeenCalled();
  });
});

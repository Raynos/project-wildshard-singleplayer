// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { QuestRewardBeat } from '../../../src/game/quest/reward';
import { DriftwoodReward } from '../../../src/shards/driftwood-isle/runtime/reward';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); document.body.replaceChildren(); });
const player = (carried = false) => ({ position: new Vector3(2, 3, 4), velocity: new Vector3(1, 2, 3), yaw: 3, pitch: -0.2, carried });
const target = { at: new Vector3(10, 2, 0), yaw: -3, pitch: 0.5, phase: 0.745 };

function pair(takeover: boolean, carried = false) {
  const scope = new Scope('driftwood.reward.oracle'); scopes.push(scope);
  const pagePlayer = player(carried), nativePlayer = player(carried), pageDay = { phase: 0.9 }, nativeDay = { phase: 0.9 };
  let ready = false;
  const pageFinish = vi.fn(() => takeover), nativeFinish = vi.fn(() => takeover);
  const page = new QuestRewardBeat({ scope, player: pagePlayer, dayNight: pageDay, sting: vi.fn<() => void>() }, {
    ...target, kicker: 'The Sealed Ring', title: 'Driftwood Isle', subtitle: 'Golden hour', when: () => ready, finish: pageFinish,
  });
  const native = new DriftwoodReward(nativePlayer, nativeDay, { ...target, when: () => ready, finish: nativeFinish });
  return { scope, page, native, pagePlayer, nativePlayer, pageDay, nativeDay, pageFinish, nativeFinish, start: () => { ready = true; } };
}

it('matches the real shipping reward for 10k ticks, including delayed start, captured carry and completion takeover', () => {
  for (const takeover of [false, true]) for (const carried of [false, true]) {
    const h = pair(takeover, carried);
    for (let tick = 0; tick < 10_000; tick++) {
      if (tick === 19) h.start();
      h.page.update(1 / 60); h.native.update(1 / 60);
      expect(h.nativePlayer).toEqual(h.pagePlayer); expect(h.nativeDay).toEqual(h.pageDay);
      expect(h.native.active).toBe(h.page.active);
    }
    expect(h.pageFinish).toHaveBeenCalledOnce(); expect(h.nativeFinish).toHaveBeenCalledOnce();
  }
});

it('restores mid-ease without callbacks or a pose step and matches the live page for the complete suffix', () => {
  const h = pair(false); h.start();
  for (let tick = 0; tick < 73; tick++) { h.page.update(1 / 60); h.native.update(1 / 60); }
  const saved = h.native.snapshot(), restoredPlayer = player(), restoredDay = { ...h.nativeDay };
  restoredPlayer.position.copy(h.nativePlayer.position); restoredPlayer.velocity.copy(h.nativePlayer.velocity); restoredPlayer.yaw = h.nativePlayer.yaw;
  const when = vi.fn(() => true), finish = vi.fn(() => false), restored = new DriftwoodReward(restoredPlayer, restoredDay, { ...target, when, finish });
  restored.restore(structuredClone(saved));
  expect(when).not.toHaveBeenCalled(); expect(finish).not.toHaveBeenCalled();
  expect(restoredPlayer).toEqual(h.nativePlayer); expect(restoredDay).toEqual(h.nativeDay);
  for (let tick = 73; tick < 10_000; tick++) {
    h.page.update(1 / 60); h.native.update(1 / 60); restored.update(1 / 60);
    expect(restoredPlayer).toEqual(h.pagePlayer); expect(restoredDay).toEqual(h.pageDay);
    expect(restored.snapshot()).toEqual(h.native.snapshot());
  }
  expect(when).not.toHaveBeenCalled(); expect(finish).toHaveBeenCalledOnce();
});

it('preserves the director finish fence, disposal law and atomic malformed-state refusal', () => {
  const h = pair(false); h.start(); h.page.update(20, false); h.native.update(20, false);
  expect(h.nativePlayer).toEqual(h.pagePlayer); expect(h.nativeFinish).not.toHaveBeenCalled();
  const before = h.native.snapshot();
  for (const bad of [{ ...before, elapsed: -3 }, { ...before, player: { pitch: Infinity, carried: true } },
    { ...before, player: { ...before.player, carried: false } }, { ...before, extra: true }]) {
    expect(() => h.native.restore(bad)).toThrow(); expect(h.native.snapshot()).toEqual(before);
  }
  const detached = h.native.snapshot(); detached.from.x = 999; expect(h.native.snapshot()).toEqual(before);
  h.scope.dispose(); h.native.dispose(); h.page.update(8); h.native.update(8);
  expect(h.nativePlayer.carried).toBe(h.pagePlayer.carried); expect(h.nativeFinish).not.toHaveBeenCalled();
  const finish = pair(true); finish.start(); finish.page.update(20, false); finish.native.update(20, false);
  finish.page.update(0, true); finish.native.update(0, true); finish.page.update(0, true); finish.native.update(0, true);
  expect(finish.nativePlayer).toEqual(finish.pagePlayer); expect(finish.nativeFinish).toHaveBeenCalledOnce();
  finish.scope.dispose(); finish.native.dispose(); expect(finish.nativePlayer.carried).toBe(true);
});

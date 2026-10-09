import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { applyQuestRewardPose } from '../src/game/quest/rewardMotion';

it('reproduces the held midpoint and forward wrapped clock without changing its captured origin', () => {
  const from = { position: new Vector3(), yaw: 3, pitch: 0, phase: 0.9 }, before = JSON.stringify(from);
  const target = { at: new Vector3(10, 2, 0), yaw: -3, pitch: 0.5, phase: 0.745 };
  const player = { position: new Vector3(30, 4, 5), velocity: new Vector3(1, 3, 1), yaw: 0, pitch: -0.2 }, day = { phase: from.phase };
  applyQuestRewardPose(1.25, from, target, player, day);
  expect(player.position.toArray()).toEqual([5, 1, 0]);
  expect(player.velocity.toArray()).toEqual([0, 0, 0]);
  expect(player.yaw).toBe(Math.PI); expect(player.pitch).toBe(0.25);
  expect(day.phase).toBeCloseTo(0.14636);
  applyQuestRewardPose(3.5, from, target, player, day);
  expect(player.position.toArray()).toEqual(target.at.toArray()); expect(player.pitch).toBe(0.5);
  expect(day.phase).toBeCloseTo(0.745); expect(JSON.stringify(from)).toBe(before);
});

it('keeps omitted destinations and resumes from copied origin/elapsed values exactly without stepping on restore', () => {
  const from = { position: new Vector3(1, 2, 3), yaw: -3, pitch: 0.4, phase: 0.2 };
  const makePlayer = () => ({ position: new Vector3(8, 4, 6), velocity: new Vector3(1, 3, 1), yaw: 0, pitch: 0 });
  const original = makePlayer(), restored = makePlayer(), day = { phase: 0.2 }, restoredDay = { phase: 0.2 };
  const copied = { ...from, position: from.position.clone() };
  for (let tick = 0; tick < 10_000; tick++) {
    const elapsed = tick / 60;
    applyQuestRewardPose(elapsed, from, {}, original, day);
    applyQuestRewardPose(elapsed, copied, {}, restored, restoredDay);
    expect(original.position.toArray()).toEqual([8, 4, 6]);
    expect(restored.position.toArray()).toEqual(original.position.toArray());
    expect(restored.yaw).toBe(original.yaw); expect(restored.pitch).toBe(original.pitch);
    expect(restoredDay.phase).toBe(day.phase);
  }
  expect(original.yaw).toBe(from.yaw); expect(original.pitch).toBe(from.pitch); expect(day.phase).toBe(0.2);
  applyQuestRewardPose(2, from, {}, original, null);
  applyQuestRewardPose(2, from, {}, original, undefined);
});

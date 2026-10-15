import { expect, test } from 'vitest';
import { stepNpcHeadFocus, type NpcHeadFocusState } from '../src/game/plugin/animation';
import { CASTAWAY_HEAD_FOCUS, TRADER_HEAD_FOCUS } from '../src/shards/driftwood-isle/data/npcFocus';

const state = (): NpcHeadFocusState => ({ headYaw: 0, headPitch: 0, glanceT: 0, glanceYaw: 0, glancePitch: .1 });
test('nearby focus follows a bounded head target and pauses the idle glance clock', () => {
  const pose = state(); pose.glanceT = 2;
  stepNpcHeadFocus(pose, CASTAWAY_HEAD_FOCUS, { distance: 2, relativeYaw: Math.PI / 2, playerY: 2, headY: 1.6 }, .1, 1);
  expect(pose.headYaw).toBeGreaterThan(0); expect(pose.headYaw).toBeLessThanOrEqual(CASTAWAY_HEAD_FOCUS.yawLimit);
  expect(pose.headPitch).toBeLessThan(0); expect(pose.glanceT).toBe(2);
  stepNpcHeadFocus(pose, CASTAWAY_HEAD_FOCUS, { distance: 20, relativeYaw: 0, playerY: 0, headY: 1.6 }, .1, 2);
  expect(pose.glanceT).toBeLessThan(2);
});
test('gesture overrides retain idle clocks and an invalid clock refuses before mutation', () => {
  const pose = state(); pose.glanceT = 2;
  stepNpcHeadFocus(pose, TRADER_HEAD_FOCUS, { distance: 20, relativeYaw: 0, playerY: 0, headY: 1.6, overrideYaw: -.25, overridePitch: .45 }, .1, 1);
  expect(pose.headYaw).toBeLessThan(0); expect(pose.headPitch).toBeGreaterThan(0); expect(pose.glanceT).toBe(2);
  const before = { ...pose };
  expect(() => stepNpcHeadFocus(pose, TRADER_HEAD_FOCUS, { distance: 1, relativeYaw: 0, playerY: 0, headY: 1.6 }, Number.NaN, 1)).toThrow('Invalid NPC focus clock');
  expect(pose).toEqual(before);
});

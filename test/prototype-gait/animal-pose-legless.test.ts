import { expect, test } from 'vitest';
import { AnimalPoseLaw } from '../../src/engine/entities/animalPose';

function law(legLen: number, flying: boolean) {
  const result = new AnimalPoseLaw({ custom: true, dims: {
    bodyY: 0, bodyRadius: .5, bodyHalfLen: .7, headRadius: .2, halfWidth: 1, legLen, feet: [],
  } });
  result.input.speed = 1; result.input.flying = flying;
  return result;
}

test.each([0, -1])('grounded leg length %s skips stride integration while moving and idle', (legLen) => {
  const pose = law(legLen, false);
  pose.phase = .25;
  for (let frame = 1; frame <= 180; frame++) {
    // Start idle, move forward and sideways, then return to idle with gait weights still easing.
    pose.input.speed = frame > 30 && frame <= 90 ? 1 : 0;
    pose.input.strafe = frame > 90 && frame <= 120 ? 1 : 0;
    pose.advance(1 / 60, frame / 60, true);
    expect(pose.phase).toBe(.25);
    expect(() => pose.snapshot()).not.toThrow();
  }
  const restored = law(legLen, false); restored.restore(pose.snapshot());
  pose.input.speed = 1; restored.input.speed = 1;
  pose.advance(1 / 60, 181 / 60, true); restored.advance(1 / 60, 181 / 60, true);
  expect(restored.snapshot()).toBe(pose.snapshot());
  expect(restored.phase).toBe(.25);
});

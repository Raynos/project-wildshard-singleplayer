import { expect, test } from 'vitest';
import { AnimalPoseLaw } from '../../../src/engine/entities/animalPose';

function law() {
  return new AnimalPoseLaw({ custom: true, dims: { bodyY: 0, bodyRadius: .5,
    bodyHalfLen: .7, headRadius: .2, halfWidth: 1, legLen: 0, feet: [] } });
}

test('flight freezes an existing terrestrial phase rather than resetting it, while custom clocks advance', () => {
  const pose = law(); pose.phase = .375;
  Object.assign(pose.input, { flying: true, speed: 1, attackT: .2, flinch: .7, brace: .6, deathT: .1 });
  pose.advance(.1, 10, true);
  expect(pose.phase).toBe(.375);
  expect(pose.input.attackT).toBeCloseTo(.3, 12);
  expect(pose.input.flinch).toBeCloseTo(.7 * Math.exp(-.55), 12);
  expect(pose.input.brace).toBeCloseTo(.6 * Math.exp(-.7), 12);
  expect(pose.input.deathT).toBeCloseTo(.225, 12);
  expect(() => pose.snapshot()).not.toThrow();
});

test('far flight retains old timer split and caller-owned attack control', () => {
  const pose = law(); pose.phase = .375;
  Object.assign(pose.input, { flying: true, speed: 1, attackT: .2, flinch: .7, deathT: .1 });
  pose.advance(.1, 10, false);
  expect(pose.phase).toBe(.375); expect(pose.poseFrozen).toBe(true);
  expect(pose.input.attackT).toBeCloseTo(.3, 12);
  expect(pose.input.flinch).toBe(.7); expect(pose.input.deathT).toBe(.1);
  pose.input.advanceAttack = false; pose.advance(.1, 10.1, true);
  expect(pose.input.attackT).toBeCloseTo(.3, 12);
});

test('explicit debug gait phase remains authoritative during declared flight', () => {
  const pose = law(); pose.input.flying = true; pose.input.speed = 1;
  pose.input.debugGait = { gait: 'walk', phase: .65 };
  pose.advance(.1, 10, true);
  expect(pose.phase).toBe(.65); expect(() => pose.snapshot()).not.toThrow();
});

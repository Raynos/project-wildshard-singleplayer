import { expect, test } from 'vitest';
import { Bone, Vector3 } from 'three';
import { RigidCorpsePose, registerRigidCorpseAnimation } from '../src/engine/entities/rigidCorpsePose';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { worldTime } from '../src/engine/core/time';

function fixture() {
  const body = new Bone(), mem = { value: 3 }, position = new Vector3();
  const context: AnimalRigContext & { bones: Record<string, Bone> } = {
    bones: { body }, dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .2, headRadius: .1, legLen: 1, halfWidth: .5, feet: [] },
    mem, position, lookTarget: new Vector3(), animal: { mem, position, yOffset: 0 }, seed: 1, scale: 1,
    dt: 0, t: 0, speed: 1, strafe: 1, phase: .3, state: 'stalk', alive: false, deathT: 0, flinch: .5, brace: 1, attack: .4, lookWeight: 1, yaw: .7,
  };
  let calls = 0;
  const animate = registerRigidCorpseAnimation(c => {
    calls++; body.position.y = c.deathT + (c.mem['value'] ?? 0);
    body.rotation.z = c.deathT; expect(c.speed).toBe(0); expect(c.attack).toBe(-1); expect(c.brace).toBe(0); expect(c.alive).toBe(false);
  });
  return { context, body, animate, calls: () => calls };
}
test.each([30, 60, 120, 6])('fixed endpoint clock is independent of %s Hz render cadence and near/far observation', hz => {
  const f = fixture(), pose = new RigidCorpsePose(f.context, f.animate); let accumulator = 0, steps = 0;
  for (let frame = 0; frame < hz; frame++) {
    accumulator += 1 / hz;
    while (accumulator >= 1 / 60 - 1e-12) { pose.step(1 / 60); steps++; accumulator -= 1 / 60; }
    if (frame % 3 !== 0) { pose.render(.25); pose.render(.75); }
  }
  pose.render(1); expect(steps).toBe(60); expect(f.calls()).toBe(60); expect(pose.deathT).toBe(1); expect(f.body.position.y).toBe(4);
});
test('death inputs are detached, paused/dropped steps do not advance and hit-stop does not invent clock scaling', () => {
  const f = fixture(), pose = new RigidCorpsePose(f.context, f.animate);
  f.context.mem['value'] = 900; f.context.phase = 8; f.context.position.y = 20;
  worldTime.scale = .05;
  try {
    pose.step(1 / 60); const death = pose.deathT;
    for (let i = 0; i < 120; i++) pose.render(.5);
    expect(pose.deathT).toBe(death); expect(f.calls()).toBe(1);
    // Host pause or catch-up clamp contributes no extra fixed call, regardless of wall time.
    pose.step(1 / 60); pose.render(1); expect(pose.deathT).toBeCloseTo(2 / 48); expect(f.body.position.y).toBeCloseTo(3 + 2 / 48);
  } finally { worldTime.scale = 1; }
});
test('rejects arbitrary callbacks and rolls back unsafe scale writes', () => {
  const f = fixture(); expect(() => new RigidCorpsePose(f.context, () => undefined)).toThrow('admitted');
  const pose = new RigidCorpsePose(f.context, registerRigidCorpseAnimation(() => { f.body.scale.y = 2; f.body.position.y = 200; }));
  expect(() => pose.step(1 / 60)).toThrow('Unsafe'); expect(f.body.position.y).toBe(0); expect(f.body.scale.y).toBe(1);
});

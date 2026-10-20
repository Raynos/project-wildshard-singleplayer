import { Bone } from 'three';
import { expect, test } from 'vitest';
import { AnimalPoseLaw } from '../src/engine/entities/animalPose';
import { playClips } from '../src/game/plugin/animation';
import { DRIFT_RAY_CLIPS, GALE_WISP_CLIPS, SKY_GOAT_CLIPS } from '../src/shards/far-reach/generators/creatureClips';
import { ROC_CLIPS } from '../src/shards/far-reach/generators/rocClips';
import { RAY_CLIPS } from '../src/shards/sunscar-dunes/generators/rows/species/duneRay';
import { MATRIARCH_CLIPS } from '../src/shards/sunscar-dunes/generators/rows/species/matriarch';

function law(legLen: number, flying: boolean) {
  const result = new AnimalPoseLaw({ custom: true, dims: {
    bodyY: 0, bodyRadius: .5, bodyHalfLen: .7, headRadius: .2, halfWidth: 1, legLen, feet: [],
  } });
  result.input.speed = 1; result.input.flying = flying;
  return result;
}
function bones() { return { body: new Bone(), head: new Bone(), wingL: new Bone(), wingR: new Bone(), tail: new Bone(), swirl: new Bone(), legFL: new Bone() }; }

test('grounded stride retains its original frequency and real sky-goat stride clip', () => {
  const pose = law(1, false), joints = bones();
  const frequency = Math.max(.6, .62 / (2 * Math.sin(.36)));
  for (let frame = 1; frame <= 60; frame++) {
    pose.advance(1 / 60, frame / 60, true);
    expect(pose.phase).toBeCloseTo((frame * frequency / 60) % 1, 12);
    playClips(SKY_GOAT_CLIPS, { bones: joints, t: frame / 60, phase: pose.phase, speed: 1, alive: true, deathT: -1, attack: -1, mem: {} });
    expect(joints.legFL.rotation.x).toBeCloseTo(Math.sin(pose.phase * Math.PI * 2) * .62, 12);
  }
  expect(() => pose.snapshot()).not.toThrow(); expect(pose.phase).toBeGreaterThan(0);
});

test('declared flight keeps finite zero-leg continuation and existing flyer time-driven animation', () => {
  const pose = law(0, true), drift = bones(), wisp = bones(), roc = bones(), dune = bones(), matriarch = bones();
  for (let frame = 1; frame <= 120; frame++) {
    const t = frame / 60; pose.advance(1 / 60, t, true);
    expect(pose.phase).toBe(0); expect(() => pose.snapshot()).not.toThrow();
    const context = { t, dt: 1 / 60, phase: pose.phase, speed: 1, alive: true, deathT: -1, attack: -1, mem: {} };
    playClips(DRIFT_RAY_CLIPS, { ...context, bones: drift });
    playClips(GALE_WISP_CLIPS, { ...context, bones: wisp });
    playClips(ROC_CLIPS, { ...context, bones: roc });
    playClips(RAY_CLIPS, { ...context, bones: dune });
    playClips(MATRIARCH_CLIPS, { ...context, bones: matriarch });
    expect(drift.wingL.rotation.z).toBeCloseTo(Math.sin(t * 2.3) * .38, 12);
    expect(wisp.swirl.rotation.y).toBeCloseTo(t * 6, 12);
    expect(roc.wingL.rotation.z).toBeCloseTo(.1 + Math.sin(t * .9) * .06
      + Math.sin(t * 3.8) * .45 * Math.max(0, Math.sin(t * 1.05) - .85) / .15, 12);
    expect(dune.wingL.rotation.z).toBeCloseTo(Math.sin(t * 2.4) * -.32, 12);
    expect(matriarch.wingL.rotation.z).toBeCloseTo(Math.sin(t * 1.5) * -.34, 12);
  }
  const restored = law(0, true); restored.restore(pose.snapshot());
  pose.advance(1 / 60, 121 / 60, true); restored.advance(1 / 60, 121 / 60, true);
  expect(restored.snapshot()).toBe(pose.snapshot());
});

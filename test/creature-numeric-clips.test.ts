import { Bone, Euler, Vector3 } from 'three';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { CRAB_CLIPS } from '../src/shards/driftwood-isle/generators/crabClips';
import { THRALL_CLIPS } from '../src/shards/pine-hollow/generators/thrallClips';
import { shippingCrab } from './fixtures/animal-pose/customShipping';
import { shippingThrall } from './fixtures/animal-pose/thrallShipping';

const crabNames = ['body', 'head'].concat(['L', 'R'].flatMap(side =>
  ['arm', 'hand', 'tip'].map(joint => `claw${side}_${joint}`).concat(
    [0, 1, 2].flatMap(i => ['hip', 'knee'].map(joint => `leg${side}${i}_${joint}`)))));
const thrallNames = ['body', 'head', 'neck1', 'FL_carpus', 'FR_carpus', 'FL_fetlock', 'FR_fetlock', 'BL_stifle', 'BR_stifle', 'BL_hock', 'BR_hock'];
function context(names: readonly string[], plain = false): AnimalRigContext & { animal: AnimalRigContext['animal'] & { variant: string } } {
  const mem = {}, position = new Vector3(3, 0, 8);
  return { bones: Object.fromEntries(names.map(name => [name, plain ? { position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) } : new Bone()])), dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    dt: 1 / 30, t: 1, seed: .7, scale: 1, speed: .4, strafe: .2, phase: .3, state: 'alert', alive: true,
    deathT: -1, flinch: .3, brace: .4, attack: -1, lookTarget: new Vector3(6, 2, 10), lookWeight: .7, position, yaw: .2, mem,
    animal: { mem, position, yOffset: 0, variant: 'thrall' } };
}
function transforms(c: AnimalRigContext): number[] { return Object.values(c.bones).flatMap(b => [b.position.x, b.position.y, b.position.z, b.rotation.x, b.rotation.y, b.rotation.z, b.scale.x, b.scale.y, b.scale.z]); }

test('crab channel rows preserve every shipping joint across gait, strikes, look, brace, flinch and death', () => {
  const animate = numericCreaturePose(CRAB_CLIPS), actual = context(crabNames, true), expected = context(crabNames);
  for (const state of ['idle', 'sidestep', 'attack', 'alert'] as const) for (const attack of [-1, 0, .2, .6, .64, .78, .86, 1]) for (const deathT of [-1, 0, .4, 1]) {
    for (const c of [actual, expected]) { c.state = state; c.attack = attack; c.deathT = deathT; c.alive = deathT < 0; c.t += .037; c.phase = (c.phase + .117) % 1; c.speed = Math.sin(c.t) * 1.4; c.strafe = Math.cos(c.t) * 1.5; }
    shippingCrab(expected); animate(actual);
    const wanted = transforms(expected);
    transforms(actual).forEach((value, i) => expect(value, `${state} ${attack} ${deathT} scalar ${i}`).toBe(wanted[i]));
    expect(actual.mem).toEqual(expected.mem);
  }
});

test('Pine thrall channel rows retain additive poses, optional joints, gates and independent rigs', () => {
  const animate = numericCreaturePose(THRALL_CLIPS);
  for (const names of [thrallNames, ['head', 'FL_carpus'], []]) {
    const actual = context(names), expected = context(names);
    for (let i = 0; i < 60; i++) {
      for (const c of [actual, expected]) { c.t = i * .073; c.seed = i * .113; c.phase = i / 60; c.speed = i / 13; c.alive = i % 7 !== 0; c.animal.variant = i % 5 === 0 ? 'ordinary' : 'thrall'; }
      shippingThrall(expected); animate(actual);
      expect(transforms(actual)).toEqual(transforms(expected));
      expect(actual.mem).toEqual(expected.mem);
    }
  }
});

test('creature pose admission refuses non-joint outputs and stateful or unbounded look rows', () => {
  const first = structuredClone(CRAB_CLIPS.programs[0]);
  if (first?.numeric === undefined) throw new Error('Missing numeric pose fixture');
  first.numeric.outputs[0] = { property: 'x', target: 'frame', path: ['animal', 'hp'] };
  expect(() => numericCreaturePose({ ...CRAB_CLIPS, programs: [first] })).toThrow('creature pose');
  expect(() => numericCreaturePose({ ...CRAB_CLIPS, look: [Number.NaN, 1, .5] })).toThrow();
  expect(() => numericCreaturePose({ ...CRAB_CLIPS, programs: [] })).toThrow('creature pose');
});

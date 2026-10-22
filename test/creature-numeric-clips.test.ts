import { creaturePoseRows, numericChannelPrograms } from '../src/sdk/clientChannels';
import { SAILOR_CLIPS, CAPTAIN_CLIPS } from '../src/shards/driftwood-isle/generators/humanoidClips';
import { animateSailor as shippingSailorPose } from './fixtures/animal-pose/sailorPoseShipping';
import { animateCaptain as shippingCaptainPose } from './fixtures/animal-pose/captainPoseShipping';
import { NativeCreaturePose, stepCreatureLift, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { Bone, Euler, Vector3 } from 'three';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { CRAB_CLIPS } from '../src/shards/driftwood-isle/generators/crabClips';
import { THRALL_CLIPS } from '../src/shards/pine-hollow/generators/thrallClips';
import { shippingCrab } from './fixtures/animal-pose/customShipping';
import { shippingThrall } from './fixtures/animal-pose/thrallShipping';

const humanoidNames = ['body', 'spine', 'chest', 'head'].concat(['L', 'R'].flatMap(side => ['sh', 'el', 'hand'].map(part => `arm${side}_${part}`).concat(['hip', 'knee', 'foot'].map(part => `leg${side}_${part}`))));
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
  expect(() => numericCreaturePose({ ...SAILOR_CLIPS, scalars: [{ name: 'hp', path: ['animal', 'hp'] }] })).toThrow();
  expect(() => numericCreaturePose({ ...SAILOR_CLIPS, scalars: [{ name: 'rise', path: ['mem', 'constructor'] }] })).toThrow();
  expect(() => numericCreaturePose({ ...SAILOR_CLIPS, scalars: [SAILOR_CLIPS.scalars[0], SAILOR_CLIPS.scalars[0]] })).toThrow();
  const c = context(humanoidNames), before = transforms(c), animate = numericCreaturePose(SAILOR_CLIPS);
  c.mem['rise'] = Number.NaN;
  expect(() => animate(c)).toThrow('scalar observation'); expect(transforms(c)).toEqual(before);
});

test('humanoid rows preserve frozen joints and sailor lift on native and rendered rigs', () => {
  for (const captain of [false, true]) for (const plain of [true, false]) {
    const animate = numericCreaturePose(captain ? CAPTAIN_CLIPS : SAILOR_CLIPS);
    const actual = context(humanoidNames, plain), expected = context(humanoidNames);
    for (const init of [0, 1]) for (const phase of [0, 2, 3, 4]) for (const attack of [-1, 0, .2, .6, .62, .64, .78, .8, .85, .86, 1]) for (const deathT of [-1, 0, .4, 1]) {
      for (const c of [actual, expected]) {
        Object.assign(c.mem, { init, phase, rise: .4, rising: 1, sinking: 0, floor: 2.3 });
        c.attack = attack; c.deathT = deathT; c.alive = deathT < 0; c.t += .037; c.phase = (c.phase + .117) % 1; c.speed = Math.sin(c.t) * 1.4;
      }
      if (captain) shippingCaptainPose(expected); else { shippingSailorPose(expected); stepCreatureLift(actual.animal, actual.dt, 1.5, 1.5, -2.3, 6); }
      animate(actual);
      const wanted = transforms(expected);
      transforms(actual).forEach((value, i) => expect(value, `${captain} ${init} ${phase} ${attack} ${deathT} scalar ${i}`).toBe(wanted[i]));
      expect(actual.mem).toEqual(expected.mem); expect(actual.animal.yOffset).toBe(expected.animal.yOffset);
    }
    actual.mem = {}; actual.animal.mem = actual.mem;
    expect(() => animate(actual)).not.toThrow();
    expect(actual.mem).toEqual({});
  }
});

test('predecessor native sailor saves resume on numeric joints without changing their envelope', () => {
  const recipe: NativeCreaturePoseRecipe = { custom: true, joints: humanoidNames.map((name, i) => ({ name,
    parent: i === 0 ? -1 : 0, position: [0, i === 0 ? 1 : .3, 0], order: 'YXZ', scale: [1, 1, 1] })) };
  const make = () => new AnimalSim({ kind: 'sailor', label: 'Sailor', variant: 'sailor', rarity: 'uncommon', hp: 60,
    aggressive: true, dims: context(humanoidNames).dims,
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } },
  1, 1, 'sailor', { heightAt: () => 0, random: () => .5 });
  const oldActor = make(), newActor = make();
  for (const actor of [oldActor, newActor]) Object.assign(actor.mem, { init: 1, rise: .4, rising: 1, floor: 2.3 });
  const oldPose = new NativeCreaturePose(oldActor, recipe, shippingSailorPose), pose = numericCreaturePose(SAILOR_CLIPS);
  const resumed = new NativeCreaturePose(newActor, recipe, c => { stepCreatureLift(c.animal, c.dt, 1.5, 1.5, -2.3, 6); pose(c); });
  oldPose.advance(1 / 30, 1, true);
  Object.assign(newActor.mem, oldActor.mem); newActor.yOffset = oldActor.yOffset;
  const legacy = oldPose.snapshot(); resumed.restore(legacy);
  expect(resumed.snapshot()).toBe(legacy);
  for (let i = 0; i < 30; i++) {
    oldPose.advance(1 / 30, 1 + i / 30, true); resumed.advance(1 / 30, 1 + i / 30, true);
    expect(resumed.snapshot()).toBe(oldPose.snapshot());
    expect(newActor.mem).toEqual(oldActor.mem); expect(newActor.yOffset).toBe(oldActor.yOffset);
  }
});

test('typed creature inputs keep node order and snapshot all reads before outputs', () => {
  const programs = numericChannelPrograms('typed.pose', 'creature.pose', [
    { target: 'joint.body', path: ['rotation', 'x'], expr: (b, read) => b.binary('add', read('frame', ['mem', 'offset']), read('read.joint.body', ['rotation', 'y'])) },
    { target: 'joint.body', path: ['rotation', 'y'], expr: (b, read) => b.binary('add', read('read.joint.body', ['rotation', 'x']), b.constant(3)) },
    { target: 'joint.body', path: ['rotation', 'z'], expr: (_b, read) => read('frame', ['stateIndex']) },
  ]);
  const recipe = creaturePoseRows({ group: 'creature.pose', states: ['attack', 'alert'], programs });
  expect(recipe.programs.map(({ nodes, reads, channels }) => ({ nodes, reads, channels })))
    .toEqual(programs.map(({ nodes, reads, channels }) => ({ nodes, reads, channels })));
  expect(recipe.programs.flatMap(row => row.numeric.inputs.map(value => value.kind))).toEqual(['scalar', 'joint', 'joint', 'frame']);
  const c = context(['body']), body = c.bones['body'];
  if (body === undefined) throw new Error('Missing body');
  c.mem['offset'] = 2; body.rotation.set(1, 2, 0);
  const before = { ...c.mem }, animate = numericCreaturePose(recipe);
  animate(c);
  expect(body.rotation.toArray().slice(0, 3)).toEqual([4, 4, 1]);
  expect(c.mem).toEqual(before);
  // A source on an absent optional target was never read by the old adapter.
  expect(() => animate(context([]))).not.toThrow();
  c.mem['offset'] = Number.NaN;
  const retained = transforms(c);
  expect(() => animate(c)).toThrow('Invalid numeric input');
  expect(transforms(c)).toEqual(retained);
});

test('creature admission refuses legacy owner paths and nonnumeric frame fields', () => {
  const first = CRAB_CLIPS.programs[0];
  if (first === undefined) throw new Error('Missing pose');
  for (const input of [
    { input: first.reads[0], owner: 'frame', path: ['t'] },
    { input: first.reads[0], kind: 'frame', field: 'animal' },
    { input: first.reads[0], kind: 'scalar', record: { owner: 'frame', path: ['mem'] }, name: 'attack' },
  ]) expect(() => numericCreaturePose({ ...CRAB_CLIPS, programs: [{ ...first, numeric: { ...first.numeric, inputs: [input] } }] })).toThrow();
});

test('pose dimensions include optional bodyPitch and retain its absent-field fallback', () => {
  const programs = numericChannelPrograms('typed.dimensions', 'creature.pose', [
    { target: 'joint.body', path: ['rotation', 'x'], expr: (_b, read) => read('scalars', ['pitch']) },
  ]);
  const recipe = creaturePoseRows({ group: 'creature.pose', programs,
    scalars: [{ name: 'pitch', path: ['dims', 'bodyPitch'], fallback: 0.125 }] });
  const c = context(['body']), body = c.bones['body'];
  if (body === undefined) throw new Error('Missing body');
  const animate = numericCreaturePose(recipe);
  animate(c); expect(body.rotation.x).toBe(0.125);
  c.dims.bodyPitch = 0.375; animate(c); expect(body.rotation.x).toBe(0.375);
  const direct = numericChannelPrograms('typed.dimension-direct', 'creature.pose', [
    { target: 'joint.body', path: ['rotation', 'x'], expr: (_b, read) => read('frame', ['dims', 'bodyPitch']) },
  ]);
  const fromDimension = numericCreaturePose(creaturePoseRows({ group: 'creature.pose', programs: direct }));
  fromDimension(c); expect(body.rotation.x).toBe(0.375);
  delete c.dims.bodyPitch;
  expect(() => fromDimension(c)).toThrow('Invalid numeric input');
  expect(body.rotation.x).toBe(0.375);
  expect(() => creaturePoseRows({ group: 'creature.pose', programs,
    scalars: [{ name: 'pitch', path: ['dims', 'feet'], fallback: 0 }] })).toThrow();
  const unsupported = numericChannelPrograms('typed.dimension-invalid', 'creature.pose', [
    { target: 'joint.body', path: ['rotation', 'x'], expr: (_b, read) => read('frame', ['dims', 'unknown']) },
  ]);
  expect(() => creaturePoseRows({ group: 'creature.pose', programs: unsupported })).toThrow();
});

test('copied pose memory refuses accessors without invoking them', () => {
  const programs = numericChannelPrograms('typed.memory', 'creature.pose', [
    { target: 'joint.body', path: ['rotation', 'x'], expr: (_b, read) => read('frame', ['mem', 'offset']) },
  ]);
  const animate = numericCreaturePose(creaturePoseRows({ group: 'creature.pose', programs }));
  const c = context(['body']);
  let calls = 0;
  Object.defineProperty(c.mem, 'offset', { get: () => { calls++; return 1; } });
  const before = transforms(c);
  expect(() => animate(c)).toThrow('numeric record');
  expect(calls).toBe(0); expect(transforms(c)).toEqual(before);
  expect(() => animate(context([]))).not.toThrow();
});

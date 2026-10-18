import { Scope } from '../src/engine/app/scope';
import { Bone, Euler, Vector3 } from 'three';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { MONKEY_CLIPS } from '../src/shards/driftwood-isle/generators/monkeyClips';
import { MonkeyBinding } from '../src/shards/driftwood-isle/species/monkeyBinding';
import { RETURN_PROGRAM } from '../src/shards/driftwood-isle/generators/returnProgram';
import { animateMonkey as shipping } from './fixtures/animal-pose/monkeyPoseShipping';

const animate = new MonkeyBinding({ clips: MONKEY_CLIPS, program: RETURN_PROGRAM }, new Scope('fixture.monkey')).animate;

const names = ['body', 'spine', 'chest', 'head', 'tail1', 'tail2', 'tail3'].concat(['L', 'R'].flatMap(side =>
  ['sh', 'el', 'hand'].map(part => `arm${side}_${part}`).concat(['hip', 'knee', 'foot'].map(part => `leg${side}_${part}`))));
function context(plain: boolean): AnimalRigContext {
  const mem = {}, position = new Vector3(3, 0, 8);
  return { bones: Object.fromEntries(names.map(name => [name, plain ? { position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) } : new Bone()])),
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    dt: 1 / 30, t: 1, seed: .7, scale: 1, speed: .4, strafe: .2, phase: .3, state: 'alert', alive: true,
    deathT: -1, flinch: .3, brace: .4, attack: -1, lookTarget: new Vector3(6, 2, 10), lookWeight: .7, position, yaw: .2, mem,
    animal: { mem, position, yOffset: 0 } };
}
function transforms(c: AnimalRigContext): number[] { return Object.values(c.bones).flatMap(b => [b.position.x, b.position.y, b.position.z, b.rotation.x, b.rotation.y, b.rotation.z, b.scale.x, b.scale.y, b.scale.z]); }

test('monkey numeric joints preserve frozen gait, scratch, throw, bite, fall, climb and landing on both rigs', () => {
  for (const plain of [false, true]) {
    const actual = context(plain), expected = context(false);
    for (const state of ['idle', 'perch', 'attack'] as const) for (const mode of ['ground', 'bite', 'drop', 'land', 'climb', 'crown'])
      for (const attack of [-1, 0, .2, .58, .6, .62, .7, .75, .76, .82, 1]) for (const deathT of [-1, 0, .4, 1]) {
        for (const c of [actual, expected]) {
          Object.assign(c.mem, { bite: mode === 'bite' ? 1 : 0, onGround: mode === 'ground' ? 1 : 0,
            drop: mode === 'drop' || mode === 'land' ? 1 : 0, vy: -2, land: .3,
            climb: mode === 'climb' || mode === 'crown' ? 1 : 0, perchH: 5, bx: 0, bz: 0, px: 3, pz: 4 });
          c.animal.yOffset = mode === 'land' ? .01 : mode === 'crown' ? 4.99 : 2;
          c.position.set(3, 0, 8); c.attack = attack; c.deathT = deathT; c.alive = deathT < 0; c.state = state;
          c.t += .037; c.phase = (c.phase + .117) % 1; c.speed = Math.sin(c.t) * 1.4; c.strafe = Math.cos(c.t) * 1.5;
        }
        shipping(expected); animate(actual);
        const wanted = transforms(expected);
        transforms(actual).forEach((value, i) => expect(value, `${plain} ${state} ${mode} ${attack} ${deathT} scalar ${i}`).toBe(wanted[i]));
        expect(actual.mem).toEqual(expected.mem); expect(actual.animal.yOffset).toBe(expected.animal.yOffset); expect(actual.position).toEqual(expected.position);
      }
  }
});

test('predecessor native monkey saves retain root authority, pose LOD and exact continuation', async () => {
  const { NativeCreaturePose } = await import('../src/game/plugin/animation');
  const { AnimalSim } = await import('../src/engine/entities/AnimalSim');
  const recipe = { custom: true, joints: names.map((name, i) => ({ name, parent: i === 0 ? -1 : 0,
    position: [0, i === 0 ? 1 : .3, 0] as const, order: 'YXZ' as const, scale: [1, 1, 1] as const })) };
  const make = () => new AnimalSim({ kind: 'monkey', label: 'Monkey', variant: 'monkey', rarity: 'common', hp: 30,
    aggressive: true, dims: context(true).dims,
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 6, relentless: false } },
  1, 1, 'monkey', { heightAt: () => 0, random: () => .5 });
  const oldActor = make(), actor = make();
  const before = new NativeCreaturePose(oldActor, recipe, shipping), resumed = new NativeCreaturePose(actor, recipe, animate);
  for (const mode of ['drop', 'climb']) {
    Object.assign(oldActor.mem, { bite: 0, onGround: 0, drop: mode === 'drop' ? 1 : 0, vy: 0, land: 0,
      climb: mode === 'climb' ? 1 : 0, perchH: 2, bx: 0, bz: 0, px: 3, pz: 4 });
    oldActor.yOffset = 1;
    before.advance(1 / 30, 1, true);
    Object.assign(actor.mem, oldActor.mem); actor.yOffset = oldActor.yOffset; actor.position.copy(oldActor.position);
    const saved = before.snapshot(); resumed.restore(saved); expect(resumed.snapshot()).toBe(saved);
    for (let i = 0; i < 45; i++) {
      const near = i % 3 !== 0;
      before.advance(1 / 30, 1 + i / 30, near); resumed.advance(1 / 30, 1 + i / 30, near);
      expect(resumed.snapshot()).toBe(before.snapshot()); expect(actor.mem).toEqual(oldActor.mem);
      expect(actor.yOffset).toBe(oldActor.yOffset); expect(actor.position).toEqual(oldActor.position);
    }
  }
});

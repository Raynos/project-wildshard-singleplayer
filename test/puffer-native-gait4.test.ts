// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the preserved native rig1 source without running Blender.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { AnimalPoseLaw } from '../src/engine/entities/animalPose';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { pufferNativeGait4Clips, PUFFER_GAIT4_LEG_LEN, PUFFER_GAIT4_STANCE, PUFFER_GAIT4_STROKE } from '../src/shards/driftwood-isle/generators/pufferNativeGait4Clips';

const native = v.parse(v.looseObject({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/approved-puffer/unaccepted-v57-motion-rig1-native.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const bone = new Bone(); bone.name = def.name; bone.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing parent');
      bone.position.sub(new Vector3(...rest.pos)); parent.add(bone);
    }
    bones[def.name] = bone;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones, dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: .46, bodyRadius: .86, headRadius: .56,
    legLen: PUFFER_GAIT4_LEG_LEN, feet: [], halfWidth: .98 }, dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0,
    phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(),
    lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}

test('gait4 settled stop returns named rig1 feet to bind and retains head bind', () => {
  const { context, bones } = rig(), pose = numericCreaturePose(pufferNativeGait4Clips());
  const head = bones['head']?.position.toArray(); context.phase = .8; context.speed = .7; pose(context);
  context.speed = 0; pose(context);
  for (const [name, z] of [['finL', .16], ['finR', .16], ['rearL', -.36], ['rearR', -.36]] as const) {
    expect(bones[name]?.position.z).toBeCloseTo(z); expect(bones[name]?.position.y).toBeCloseTo(.5 - context.dims.bodyY);
  }
  expect(bones['head']?.position.toArray()).toEqual(head);
  expect(pufferNativeGait4Clips().programs.every(row => row.locals === undefined)).toBe(true);
});

test('existing engine walk phase reflects actual speed and calibrated stride', () => {
  const { context } = rig(), law = new AnimalPoseLaw({ dims: context.dims, custom: true });
  law.input.speed = .7; law.input.desiredSpeed = .7;
  for (let i = 0; i < 60; i++) law.advance(1 / 60, i / 60, true);
  const before = law.phase; law.advance(1 / 60, 1, true);
  expect((law.phase - before + 1) % 1).toBeCloseTo(.7 * PUFFER_GAIT4_STANCE / PUFFER_GAIT4_STROKE / 60, 6);
  law.input.speed = .35; law.advance(1 / 60, 1 + 1 / 60, true);
  expect((law.phase - before + 1) % 1).toBeCloseTo((.7 + .35) * PUFFER_GAIT4_STANCE / PUFFER_GAIT4_STROKE / 60, 6);
});

test('phase wrap and turn preserve local continuity; abrupt stop remains an explicitly bounded pop', () => {
  const { context, bones } = rig(), pose = numericCreaturePose(pufferNativeGait4Clips());
  context.speed = .7; context.phase = .99999; pose(context);
  const end = bones['finL']?.position.clone(); context.phase = 0; pose(context);
  if (end === undefined || bones['finL'] === undefined) throw new Error('Missing fin');
  expect(end.distanceTo(bones['finL'].position)).toBeLessThan(.0001);
  const beforeTurn = bones['finL'].position.clone(); context.yaw = 1; pose(context);
  expect(beforeTurn.distanceTo(bones['finL'].position)).toBe(0);
  context.speed = 0; pose(context);
  const stopPop = beforeTurn.distanceTo(bones['finL'].position);
  expect(stopPop).toBeGreaterThan(.1); expect(stopPop).toBeLessThan(.14);
});

test('attack gate fades gait within .22s without changing swell or body release timing', () => {
  const { context, bones } = rig(), pose = numericCreaturePose(pufferNativeGait4Clips());
  context.speed = .7; context.phase = 0; context.mem['puffer-st'] = 1;
  context.mem['regular-clock'] = 0; pose(context); expect(bones['finL']?.position.z).toBeCloseTo(.28);
  context.mem['regular-clock'] = .11; pose(context); expect(bones['finL']?.position.z).toBeCloseTo(.22);
  context.mem['regular-clock'] = .22; pose(context); expect(bones['finL']?.position.z).toBeCloseTo(.16);
  context.mem['regular-clock'] = .85; pose(context); expect(bones['belly']?.scale.x).toBeCloseTo(1.1);
  context.mem['regular-clock'] = 1; pose(context); expect(bones['body']?.rotation.x).toBeGreaterThan(.04);
});

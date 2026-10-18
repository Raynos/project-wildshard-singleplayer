// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the preserved native rig1 source without running Blender.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose as admittedPose } from '../src/game/plugin/channelPrograms';
import { numericCreaturePose } from '../src/pufferGaitContinuityPreview';
import { pufferPreviewPoseRoute } from '../vite/puffer-preview-pose-route';
import { pufferNativeGait4Clips, PUFFER_GAIT4_LEG_LEN } from '../src/shards/driftwood-isle/generators/pufferNativeGait4Clips';

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

test('gait5 preserves displayed foot at stop and settles within the bounded pose interval', () => {
  const { context: c, bones } = rig(), animate = numericCreaturePose(pufferNativeGait4Clips());
  c.speed = .151; c.phase = .02147; c.t = 1; animate(c);
  const from = bones['finL']?.position.clone(); if (from === undefined) throw new Error('Missing fin');
  c.speed = 0; c.mem['puffer-st'] = 1; c.mem['regular-clock'] = 0; c.t += c.dt; animate(c);
  expect(bones['finL']?.position.z).toBeCloseTo(from.z);
  expect(Math.abs((bones['finL']?.position.y ?? 0) - from.y)).toBeLessThan(.002);
  for (let i = 1; i <= 15; i++) { c.t += c.dt; c.mem['regular-clock'] = i * c.dt; animate(c); }
  expect(bones['finL']?.position.z).toBeCloseTo(.16);
  expect(bones['finL']?.position.y).toBeCloseTo(.5 - c.dims.bodyY);
});

test('gait5 resumes from displayed rest without an initial stride pop and converges', () => {
  const { context: c, bones } = rig(), animate = numericCreaturePose(pufferNativeGait4Clips());
  c.mem['puffer-st'] = 0; c.t = 1; animate(c);
  const z = bones['finL']?.position.z; c.speed = .7; c.phase = .4; c.t += c.dt; animate(c);
  expect(bones['finL']?.position.z).toBe(z);
  for (let i = 0; i < 9; i++) { c.t += c.dt; animate(c); }
  expect(bones['finL']?.position.z).toBeCloseTo(.16 + .12 - .24 * .4 / .62);
});

test('visual history is actor-local, resets on rewind/death, and never writes observed simulation state', () => {
  const a = rig(), b = rig(), animate = numericCreaturePose(pufferNativeGait4Clips());
  a.context.speed = .7; a.context.phase = .1; a.context.t = 1; animate(a.context);
  a.context.speed = 0; a.context.t += a.context.dt;
  const snapshot = JSON.stringify({ mem: a.context.mem, position: a.context.position, speed: a.context.speed, phase: a.context.phase, t: a.context.t, dt: a.context.dt });
  animate(a.context);
  expect(JSON.stringify({ mem: a.context.mem, position: a.context.position, speed: a.context.speed, phase: a.context.phase, t: a.context.t, dt: a.context.dt })).toBe(snapshot);
  animate(b.context); expect(b.bones['finL']?.position.z).toBeCloseTo(.16);
  a.context.t = 0; animate(a.context); expect(a.bones['finL']?.position.z).toBeCloseTo(.16);
  a.context.alive = false; a.context.deathT = .5; animate(a.context);
  expect(a.bones['finL']?.position.z).toBeCloseTo(.16);
});

test('original numeric admission remains mandatory; normal caller route is unchanged', () => {
  expect(() => numericCreaturePose({ programs: [], group: 'creature.pose' })).toThrow();
  expect(() => admittedPose({ programs: [], group: 'creature.pose' })).toThrow();
  expect(pufferPreviewPoseRoute('gait5', './game/plugin/channelPrograms', '/candidate/src/practiceContent.ts', '/candidate')).toBe('/candidate/src/pufferGaitContinuityPreview.ts');
  for (const mode of ['attack', 'rest', 'gait4']) expect(pufferPreviewPoseRoute(mode, './game/plugin/channelPrograms', '/candidate/src/practiceContent.ts', '/candidate')).toBeNull();
  expect(pufferPreviewPoseRoute('gait5', './game/plugin/channelPrograms', '/candidate/src/pufferGaitContinuityPreview.ts', '/candidate')).toBeNull();
  expect(pufferPreviewPoseRoute('gait5', '@wildshard/game/plugin/channelPrograms', '/candidate/src/practiceContent.ts', '/candidate')).toBeNull();
});

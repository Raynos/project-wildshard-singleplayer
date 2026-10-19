// oxlint-disable-next-line import/no-nodejs-modules -- Measure the preserved native mesh in a renderer-free transform sweep.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Matrix4, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { bellbackNativeClips } from '../src/shards/driftwood-isle/generators/bellbackNativeClips';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(), v.number(), v.number()]) })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }),
JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json', 'utf8')));

test('native motion envelope records exact rigid vertices, never a collider or contact acceptance', () => {
  const bones: Record<string, Bone> = {}, inverses: Record<string, Matrix4> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing bind parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const root = bones['body']; if (root === undefined) throw new Error('Missing body');
  root.updateMatrixWorld(true);
  for (const [name, joint] of Object.entries(bones)) inverses[name] = joint.matrixWorld.clone().invert();
  const position = new Vector3(), mem = {};
  const context: AnimalRigContext = { bones, dims: { bodyY: 1.2000000476837158, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const animate = numericCreaturePose(bellbackNativeClips());
  const results: Record<string, { minY: number; maxY: number; belowFloor: number; frames: number; parts: Record<string, { minY: number; maxY: number; maxReach: number }> }> = {};
  const point = new Vector3(), matrix = new Matrix4();
  for (const [name, stage, _phase, end] of [['idle', 0, 0, 4], ['walk', 0, 0, 1], ['pulse', 1, 0, 1.52], ['echo', 2, 0, 1.6], ['stomp', 3, 0, 1.7], ['hit', 4, 0, 1], ['death', 6, 0, 1]] as const) {
    const result = { minY: Infinity, maxY: -Infinity, belowFloor: 0, frames: 0, parts: {} as Record<string, { minY: number; maxY: number; maxReach: number }> }; results[name] = result;
    for (let sample = 0; sample <= 40; sample++) {
      const fraction = sample / 40;
      context.mem['tg-state'] = stage; context.mem['tg-clock'] = fraction * end;
      context.phase = fraction; context.speed = name === 'walk' ? 1 : 0;
      context.flinch = name === 'hit' ? 1 - fraction : 0;
      context.t = name === 'idle' ? fraction * end : 0; context.deathT = name === 'death' ? fraction : -1; context.alive = name !== 'death';
      animate(context); root.updateMatrixWorld(true); result.frames++;
      for (const part of native.parts) {
        const joint = bones[part.name], inverse = inverses[part.name];
        if (joint === undefined || inverse === undefined) throw new Error('Missing rigid part transform');
        matrix.multiplyMatrices(joint.matrixWorld, inverse);
        const partResult=result.parts[part.name] ??= {minY:Infinity,maxY:-Infinity,maxReach:0};
        for (let i = 0; i < part.positions.length; i += 3) {
          point.fromArray(part.positions, i).applyMatrix4(matrix);
          if (!Number.isFinite(point.y)) throw new Error('Nonfinite transformed vertex');
          partResult.minY=Math.min(partResult.minY,point.y);partResult.maxY=Math.max(partResult.maxY,point.y);partResult.maxReach=Math.max(partResult.maxReach,Math.hypot(point.x,point.z));
          result.minY = Math.min(result.minY, point.y); result.maxY = Math.max(result.maxY, point.y);
          if (point.y < -.005) result.belowFloor++;
        }
      }
    }
  }
  // An evidence measurement, intentionally not a "contact passed" assertion.
  mkdirSync('tmp/bellback-native-measurement', { recursive: true });
  writeFileSync('tmp/bellback-native-measurement/envelope.json', JSON.stringify(results, null, 2));
  expect(results['walk']?.frames).toBe(41);
  for (const row of Object.values(results)) expect(row.belowFloor).toBe(0);
});

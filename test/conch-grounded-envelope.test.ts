// oxlint-disable-next-line import/no-nodejs-modules -- Measure the preserved native mesh in a renderer-free transform sweep.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Matrix4, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { conchGroundedClips } from '../src/shards/driftwood-isle/generators/conchGroundedClips';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

const directory = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
const metadata = v.parse(v.object({ bodies: v.array(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(), v.number(), v.number()]) })) })) }), JSON.parse(readFileSync(`${directory}/metadata.json`, 'utf8')));
const defs = metadata.bodies[0]; if (defs === undefined) throw new Error('Missing body');

test('weighted native motion clears sampled floor, never a collider or contact acceptance', async () => {
  const bodies = packedCreatureBodies(JSON.parse(readFileSync(`${directory}/metadata.json`, 'utf8')), undefined, () => Promise.resolve(new Uint8Array(readFileSync(`${directory}/payload.bin`))));
  await bodies.preload(); const packed = bodies.copy('conch-duelist', 'conch-duelist');
  const native = { bones: defs.bones, parts: packed.hardParts.map(geometry => ({ positions: Array.from(geometry.getAttribute('position').array), indices: Array.from(geometry.getAttribute('skinIndex').array), weights: Array.from(geometry.getAttribute('skinWeight').array) })) };
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
  const context: AnimalRigContext = { bones, dims: { bodyY: 1.04, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(), lookWeight: 0, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  const animate = numericCreaturePose(conchGroundedClips());
  const results: Record<string, { minY: number; maxY: number; belowFloor: number; frames: number }> = {};
  const point = new Vector3(), restPoint = new Vector3(), weighted = new Vector3();
  const skinMatrices = native.bones.map(() => new Matrix4());
  for (const [name, stage, end] of [['idle', 0, 1], ['walk', 0, 1], ['guard', 1, .59], ['flinch', 4, 1], ['thrust', 1, 1.6], ['counter', 3, 1.45], ['death', 5, 1]] as const) {
    const result = { minY: Infinity, maxY: -Infinity, belowFloor: 0, frames: 0 }; results[name] = result;
    for (let sample = 0; sample <= 60; sample++) for (const idleTime of [0, Math.PI / 3.4, 3 * Math.PI / 3.4]) for (const recoil of [0, 1]) {
      const fraction = sample / 60;
      context.mem['conch-st'] = stage; context.mem['conch-guard'] = name === 'guard' ? 1 : 0; context.flinch = recoil; context.mem['regular-clock'] = fraction * end;
      context.phase = fraction; context.speed = name === 'walk' ? 1 : 0;
      context.t = idleTime; context.deathT = name === 'death' ? fraction : -1; context.alive = name !== 'death';
      animate(context); root.updateMatrixWorld(true); result.frames++;
      native.bones.forEach((def, i) => { const joint = bones[def.name], inverse = inverses[def.name], matrix = skinMatrices[i];
        if (joint === undefined || inverse === undefined || matrix === undefined) throw new Error('Missing skin matrix'); matrix.multiplyMatrices(joint.matrixWorld, inverse); });
      for (const part of native.parts) {
        for (let i = 0; i < part.positions.length; i += 3) {
          restPoint.fromArray(part.positions, i); point.set(0, 0, 0); let totalWeight = 0;
          for (let slot = 0; slot < 4; slot++) {
            const at = i / 3 * 4 + slot, index = part.indices[at], weight = part.weights[at];
            if (index === undefined || weight === undefined) throw new Error('Missing packed weight');
            if (weight === 0) continue;
            const matrix = skinMatrices[index]; if (matrix === undefined) throw new Error('Missing weighted joint');
            weighted.copy(restPoint).applyMatrix4(matrix); point.addScaledVector(weighted, weight); totalWeight += weight;
          }
          if (Math.abs(totalWeight - 1) > 1e-6) throw new Error('Unnormalized skin weights');
          if (!Number.isFinite(point.y)) throw new Error('Non-finite vertex');
          result.minY = Math.min(result.minY, point.y); result.maxY = Math.max(result.maxY, point.y);
          if (point.y < -.005) result.belowFloor++;
        }
      }
    }
  }
  // An evidence measurement, intentionally not a "contact passed" assertion.
  mkdirSync('tmp/conch-native-measurement', { recursive: true });
  writeFileSync('tmp/conch-native-measurement/grounded-envelope.json', JSON.stringify(results, null, 2));
  for (const geometry of packed.hardParts) geometry.dispose();
  expect(results['walk']?.frames).toBe(366);
  for (const row of Object.values(results)) { expect(row.minY).toBeGreaterThanOrEqual(0); expect(row.belowFloor).toBe(0); }
});

import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete original pose bytes from the shipped skin.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash every Float64 pose component without rounding.
import { createHash } from 'node:crypto';
import { Bone, Euler } from 'three';
import { parseSkinFile } from '@wildshard/format/skinAssets';
import { withPortableMath } from './fake/portableMath';
import { bindSkinPoseLayers, compileSkinPoseLayers } from '../src/game/shardfile/skinLayerPlayback';
import { bindSkinPoseLayers as originalBinding, compileSkinPoseLayers as originalCompile } from './fixtures/skin-layer-before';

for (const portable of [false, true]) test(`the shipped Template layers retain every original ${portable ? 'portable' : 'native'} pose component`, () => {
 const check = (): void => {
  const { row, binding } = parseSkinFile(readFileSync('src/shards/_template/assets/bfa4dfc9c18979f904557ee8deab0058b8a399be10266f5fb1578b403f482fd4'));
  const names = row.rig.joints[0]; if (names === undefined) throw new Error('Missing original joints');
  const hash = createHash('sha256'), originalHash = createHash('sha256'), scratch = new Euler();
  let states = 0, frames = 0, components = 0;
  for (const layers of Object.values(binding.poseLayers ?? {})) {
    if (layers === undefined) continue;
    states++;
    const bones = names.map(name => { const bone = new Bone(); bone.name = name; return bone; });
    const pose = bindSkinPoseLayers(compileSkinPoseLayers(layers, names), bones);
    const apply = pose.apply, restore = pose.restore;
    const originalBones = names.map(name => { const bone = new Bone(); bone.name = name; return bone; });
    const original = originalBinding(originalCompile(layers, names), originalBones);
    const values = new Float64Array(bones.length * 10), originalValues = new Float64Array(values.length);
    for (let frame = 0; frame < 257; frame++) {
      const time = frame * 0.137;
      for (let index = 0; index < bones.length; index++) {
        const bone = bones[index]; if (bone === undefined) throw new Error('Missing original joint');
        bone.position.set(index * 0.1, frame * 0.001, -index * 0.2);
        bone.scale.set(1.1, 0.9, 1.2);
        bone.quaternion.setFromEuler(scratch.set(time * 0.01, index * 0.02, -time * 0.03));
        const prior = originalBones[index]; if (prior === undefined) throw new Error('Missing original joint');
        prior.position.copy(bone.position); prior.quaternion.copy(bone.quaternion); prior.scale.copy(bone.scale);
      }
      const before = bones.flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray()));
      original.apply(time); apply(time);
      for (let index = 0; index < bones.length; index++) {
        const bone = bones[index]; if (bone === undefined) throw new Error('Missing posed joint');
        bone.position.toArray(values, index * 10);
        bone.quaternion.toArray(values, index * 10 + 3);
        bone.scale.toArray(values, index * 10 + 7);
        const prior = originalBones[index]; if (prior === undefined) throw new Error('Missing original posed joint');
        prior.position.toArray(originalValues, index * 10); prior.quaternion.toArray(originalValues, index * 10 + 3); prior.scale.toArray(originalValues, index * 10 + 7);
      }
      expect(new Uint8Array(values.buffer)).toEqual(new Uint8Array(originalValues.buffer));
      originalHash.update(new Uint8Array(originalValues.buffer));
      hash.update(new Uint8Array(values.buffer)); frames++; components += values.length;
      restore(); original.restore();
      expect(originalBones.flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray()))).toEqual(before);
      expect(bones.flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray()))).toEqual(before);
    }
    expect(() => { pose.apply(-1); }).toThrow('Invalid skin layer clock');
    expect(() => { pose.apply(Number.NaN); }).toThrow('Invalid skin layer clock');
  }
  // Original keyed-axis, host-native Mac before-control: dfdad111397a3d7e17ce3da89b7c8a71132884d86240aea92dd7cd9aca747d89.
  // Hash the same complete Float64 values under portable math on every host.
  const digest = hash.digest('hex'), originalDigest = originalHash.digest('hex');
  expect({ states, frames, components }).toEqual({ states: 3, frames: 771, components: 154200 });
  expect(digest).toBe(originalDigest);
  if (portable) expect(digest).toBe('b516f310ea65c973171e44e81839fbb6d472cc0bc8f4dc8fd8c0330bb3079b72');
 };
 if (portable) withPortableMath(check); else check();
});

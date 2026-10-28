import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete original pose bytes from the shipped skin.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash every Float64 pose component without rounding.
import { createHash } from 'node:crypto';
import { Bone, Euler } from 'three';
import { parseSkinFile } from '@wildshard/format/skinAssets';
import { bindSkinPoseLayers, compileSkinPoseLayers } from '../src/game/shardfile/skinLayerPlayback';

test('the shipped Template layers retain every original pose component', () => {
  const { row, binding } = parseSkinFile(readFileSync('src/shards/_template/assets/bfa4dfc9c18979f904557ee8deab0058b8a399be10266f5fb1578b403f482fd4'));
  const names = row.rig.joints[0]; if (names === undefined) throw new Error('Missing original joints');
  const hash = createHash('sha256'), scratch = new Euler();
  let states = 0, frames = 0, components = 0;
  for (const layers of Object.values(binding.poseLayers ?? {})) {
    if (layers === undefined) continue;
    states++;
    const bones = names.map(name => { const bone = new Bone(); bone.name = name; return bone; });
    const pose = bindSkinPoseLayers(compileSkinPoseLayers(layers, names), bones);
    const values = new Float64Array(bones.length * 10);
    for (let frame = 0; frame < 257; frame++) {
      const time = frame * 0.137;
      for (let index = 0; index < bones.length; index++) {
        const bone = bones[index]; if (bone === undefined) throw new Error('Missing original joint');
        bone.position.set(index * 0.1, frame * 0.001, -index * 0.2);
        bone.scale.set(1.1, 0.9, 1.2);
        bone.quaternion.setFromEuler(scratch.set(time * 0.01, index * 0.02, -time * 0.03));
      }
      const before = bones.flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray()));
      pose.apply(time);
      for (let index = 0; index < bones.length; index++) {
        const bone = bones[index]; if (bone === undefined) throw new Error('Missing posed joint');
        bone.position.toArray(values, index * 10);
        bone.quaternion.toArray(values, index * 10 + 3);
        bone.scale.toArray(values, index * 10 + 7);
      }
      hash.update(new Uint8Array(values.buffer)); frames++; components += values.length;
      pose.restore();
      expect(bones.flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray()))).toEqual(before);
    }
    expect(() => { pose.apply(-1); }).toThrow('Invalid skin layer clock');
    expect(() => { pose.apply(Number.NaN); }).toThrow('Invalid skin layer clock');
  }
  // Frozen with the original keyed-axis implementation before this allocation cut.
  expect({ states, frames, components, hash: hash.digest('hex') }).toEqual({ states: 3, frames: 771, components: 154200,
    hash: 'dfdad111397a3d7e17ce3da89b7c8a71132884d86240aea92dd7cd9aca747d89' });
});

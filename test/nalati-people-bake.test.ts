// oxlint-disable-next-line import/no-nodejs-modules -- Compare shipped geometry channels by their exact bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the original and prepared shipped assets.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { readSourceModel } from '../src/sdk/bake/skinned';
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };
// The original conditioned skins (game figureRig fitNpcFigure + mergeNpcFigures over the source GLBs), frozen
import FROZEN from './fixtures/legacy-oracles/nalati-people.json' with { type: 'json' };

type Key = keyof typeof frames;
const keys = Object.keys(frames) as Key[];
const hash = (array: ArrayBufferView): string => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
function isGeometry(value: unknown): value is THREE.BufferGeometry { return value instanceof THREE.BufferGeometry; }
interface FrozenFigure { readonly attributes: Readonly<Record<string, string>>; readonly index: string; readonly bones: readonly string[]; readonly inverses: readonly (readonly number[])[]; readonly poses: Readonly<Record<string, readonly (readonly number[])[]>> }
const cases: Readonly<Record<string, FrozenFigure>> = FROZEN.cases;

for (const phone of [false, true]) for (const selection of [keys, ...keys.map(key => [key])]) {
  const name = selection.length === 1 ? selection[0] : 'camp';
  it(`${name} ${phone ? 'phone' : 'desktop'} preserves the original conditioned skin and posed vertices`, async () => {
    const before = cases[`${String(name)}/${phone ? 'phone' : 'desktop'}`];
    if (before === undefined) throw new Error('Missing frozen camp skin');
    const loaded = await readSourceModel(readFileSync(`public/assets/nalati/baked/people/${name}${phone ? '.phone' : ''}.glb`));
    const after = loaded.gltf.scene.getObjectByProperty('isSkinnedMesh', true);
    if (!(after instanceof THREE.SkinnedMesh) || !(after.geometry instanceof THREE.BufferGeometry)) throw new Error('Prepared camp skin missing');
    const geometry: unknown = after.geometry;
    if (!isGeometry(geometry)) throw new Error('Prepared geometry missing');
    expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(before.attributes).sort());
    for (const [key, expected] of Object.entries(before.attributes)) {
      const actual = geometry.getAttribute(key);
      if (!(actual instanceof THREE.BufferAttribute)) throw new Error('Prepared channels must stay packed');
      expect(hash(actual.array), key).toBe(expected);
    }
    expect(hash(Uint32Array.from(geometry.index?.array ?? []))).toBe(before.index);
    expect(after.skeleton.bones.map(bone => bone.name)).toEqual(before.bones);
    // Compare the bind transforms as uploaded to the GPU, then several non-rest root/head/arm poses.
    const inverse = (matrix: THREE.Matrix4): number[] => Array.from(Float32Array.from(matrix.elements, value => value === 0 ? 0 : value));
    expect(after.skeleton.boneInverses.map(inverse)).toEqual(before.inverses);
    for (const phase of [0, 0.8, 2.7]) {
      for (const [i, bone] of after.skeleton.bones.entries()) bone.matrixWorld.makeRotationY(phase + i * 0.2).setPosition(i * 0.3, Math.sin(phase), -i);
      const samples = before.poses[String(phase)], position = geometry.getAttribute('position');
      if (samples === undefined) throw new Error('Missing frozen pose');
      for (let i = 0, k = 0; i < position.count; i += 113, k++) {
        const a = after.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(position, i)), b = samples[k];
        if (b === undefined) throw new Error('Frozen pose samples differ in count');
        expect(a.distanceTo(new THREE.Vector3(b[0], b[1], b[2]))).toBeLessThan(1e-6);
      }
    }
  });
}

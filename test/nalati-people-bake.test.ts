// oxlint-disable-next-line import/no-nodejs-modules -- Compare shipped geometry channels by their exact bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the original and prepared shipped assets.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { rawFromGltf } from '../src/shards/nalati-grasslands/generators/modelPainting';
import { fitNpcFigure, mergeNpcFigures } from '../src/game/systems/npc/figureRig';
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };

type Key = keyof typeof frames;
const keys = Object.keys(frames) as Key[];
const hash = (array: ArrayBufferView): string => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
const restoreDocument = (): void => {
  if (documentBefore === undefined) Reflect.deleteProperty(globalThis, 'document');
  else Object.defineProperty(globalThis, 'document', documentBefore);
};
afterEach(restoreDocument);
function isGeometry(value: unknown): value is THREE.BufferGeometry { return value instanceof THREE.BufferGeometry; }

for (const phone of [false, true]) for (const selection of [keys, ...keys.map(key => [key])]) {
  const name = selection.length === 1 ? selection[0] : 'camp';
  it(`${name} ${phone ? 'phone' : 'desktop'} preserves the original conditioned skin and posed vertices`, async () => {
    const figures = await Promise.all(selection.map(async key => {
      const row = frames[key], frame = { height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder) };
      const source = await readSourceModel(readFileSync(`public/assets/nalati/models/people/${row.file}.gen${phone ? '.phone' : ''}.glb`));
      const raw = rawFromGltf(source.gltf.scene, key), cuts: number[] = [];
      source.gltf.scene.traverse(object => { const cut: unknown = object.userData['neckCut']; if (typeof cut === 'number') cuts.push(cut * frame.height); });
      return fitNpcFigure(key, raw.geometry, new THREE.DataTexture(new Uint8Array(4), 1, 1), frame, cuts[0] ?? null);
    }));
    // Exercise the former browser UV pack without decoding/re-encoding the original image bytes.
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => undefined }) }) });
    const before = mergeNpcFigures(figures, () => new THREE.MeshLambertMaterial(), 'nalati-camp-people-gen', phone ? 256 : 512);
    restoreDocument();
    const loaded = await readSourceModel(readFileSync(`public/assets/nalati/baked/people/${name}${phone ? '.phone' : ''}.glb`));
    const after = loaded.gltf.scene.getObjectByProperty('isSkinnedMesh', true);
    if (!(after instanceof THREE.SkinnedMesh) || !(after.geometry instanceof THREE.BufferGeometry)) throw new Error('Prepared camp skin missing');
    const geometry: unknown = after.geometry;
    if (!isGeometry(geometry)) throw new Error('Prepared geometry missing');
    expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(before.mesh.geometry.attributes).sort());
    for (const [key, attribute] of Object.entries(before.mesh.geometry.attributes)) {
      const actual = geometry.getAttribute(key);
      if (!(attribute instanceof THREE.BufferAttribute) || !(actual instanceof THREE.BufferAttribute)) throw new Error('Prepared channels must stay packed');
      expect(hash(actual.array), key).toBe(hash(attribute.array));
    }
    expect(hash(Uint32Array.from(geometry.index?.array ?? []))).toBe(hash(Uint32Array.from(before.mesh.geometry.index?.array ?? [])));
    expect(after.skeleton.bones.map(bone => bone.name)).toEqual(before.mesh.skeleton.bones.map(bone => bone.name));
    // Compare the bind transforms as uploaded to the GPU, then several non-rest root/head/arm poses.
    const inverse = (matrix: THREE.Matrix4): Float32Array => Float32Array.from(matrix.elements, value => value === 0 ? 0 : value);
    expect(after.skeleton.boneInverses.map(inverse)).toEqual(before.mesh.skeleton.boneInverses.map(inverse));
    for (const phase of [0, 0.8, 2.7]) {
      for (const [i, bone] of before.mesh.skeleton.bones.entries()) {
        const other = after.skeleton.bones[i];
        if (other === undefined) throw new Error('Prepared joint order changed');
        bone.matrixWorld.makeRotationY(phase + i * 0.2).setPosition(i * 0.3, Math.sin(phase), -i);
        other.matrixWorld.copy(bone.matrixWorld);
      }
      for (let i = 0; i < geometry.getAttribute('position').count; i += 113) {
        const a = after.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), i));
        const b = before.mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(before.mesh.geometry.getAttribute('position'), i));
        expect(a.distanceTo(b)).toBeLessThan(1e-6);
      }
    }
  });
}

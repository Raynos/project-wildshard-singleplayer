// oxlint-disable-next-line import/no-nodejs-modules -- Load the real shipped source and prepared skins without a renderer.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import * as rigLoader from '../src/engine/anim/rig';
import { SkyRig } from '../src/engine/world/skyRig';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { loadPeopleRig, type NpcFigureFrame, type PersonKey } from '../src/shards/nalati-grasslands/campPeopleModels';
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };

const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (documentBefore === undefined) Reflect.deleteProperty(globalThis, 'document');
  else Object.defineProperty(globalThis, 'document', documentBefore);
  vi.restoreAllMocks();
});

for (const selection of [Object.keys(frames) as PersonKey[], ['elder'] as const]) it(`adopts ${selection.length} prepared figures with the original atlas and detached pose ownership`, async () => {
  const draw = vi.fn();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: draw }) }) });
  vi.spyOn(rigLoader, 'loadRigFile').mockImplementation(async path => {
    const source = await readSourceModel(readFileSync(`public${path}`));
    if (path.includes('/models/people/')) source.gltf.scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    });
    return source.gltf;
  });
  const selected = {} as Record<PersonKey, NpcFigureFrame>;
  for (const key of selection) { const row = frames[key]; selected[key] = { height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder) }; }
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const rig = await loadPeopleRig(sky, selected);
  expect(Object.keys(rig.bones)).toEqual(selection);
  expect(draw).toHaveBeenCalledTimes(selection.length);
  expect(rig.mesh.name).toBe('nalati-camp-people-gen');
  expect(rig.mesh.frustumCulled).toBe(false);
  expect(rig.mesh.castShadow && rig.mesh.receiveShadow).toBe(true);
  for (const key of selection) {
    const joints = rig.bones[key];
    for (const bone of [joints.root, joints.head, joints.arm]) {
      expect(bone.parent).toBeNull(); expect(bone.matrixAutoUpdate || bone.matrixWorldAutoUpdate).toBe(false);
    }
    expect(joints.neck.equals(joints.head.position)).toBe(true);
    expect(joints.shoulder.equals(joints.arm.position)).toBe(true);
  }
  const material = rig.mesh.material;
  if (!(material instanceof THREE.MeshLambertMaterial)) throw new Error('Camp material changed');
  expect(material.side).toBe(THREE.DoubleSide);
  expect(material.map?.flipY).toBe(false);
  expect(material.map?.anisotropy).toBe(4);
});

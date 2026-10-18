// oxlint-disable-next-line import/no-nodejs-modules -- Load the real shipped source and prepared skins without a renderer.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import * as rigLoader from '../src/engine/anim/rig';
import { SkyRig } from '../src/engine/world/skyRig';
import { readSourceModel } from '../src/sdk/bake/skinned';
import { peopleSkin } from '../src/shards/nalati-grasslands/models/people';
import { Scope } from '../src/engine/app/scope';
import population from '../src/shards/nalati-grasslands/boot/peopleFrames.generated.json' with { type: 'json' };
import frames from '../src/shards/nalati-grasslands/data/peopleFrames.json' with { type: 'json' };

const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (documentBefore === undefined) Reflect.deleteProperty(globalThis, 'document');
  else Object.defineProperty(globalThis, 'document', documentBefore);
  vi.restoreAllMocks();
});

for (const selection of [Object.keys(frames), ['elder']]) it(`adopts ${selection.length} prepared figures with the original atlas and detached pose ownership`, async () => {
  const draw = vi.fn();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: draw }) }) });
  vi.spyOn(rigLoader, 'loadRigFile').mockImplementation(async path => {
    const source = await readSourceModel(readFileSync(`public${path}`));
    if (path.includes('/models/people/')) source.gltf.scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    });
    return source.gltf;
  });
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  Reflect.set(sky, 'csm', { lights: [] }); Reflect.set(sky, 'sunDir', new THREE.Vector3(0, 1, 0));
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  const scope = new Scope('atlas-test');
  const rows = selection.length === 1 ? population.figures.elder.atlas.desktop : population.atlas.desktop;
  const mesh = await peopleSkin(rows, sky, scope);
  expect(draw).toHaveBeenCalledTimes(selection.length);
  expect(mesh.name).toBe('nalati-camp-people-gen');
  expect(mesh.frustumCulled).toBe(false);
  expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
  expect(mesh.skeleton.bones.map(bone => bone.name)).toEqual(rows.joints);
  for (const bone of mesh.skeleton.bones) {
      expect(bone.parent).toBeNull(); expect(bone.matrixAutoUpdate || bone.matrixWorldAutoUpdate).toBe(false);
  }
  const material = mesh.material;
  if (!(material instanceof THREE.MeshLambertMaterial)) throw new Error('Camp material changed');
  expect(material.side).toBe(THREE.DoubleSide);
  expect(material.map?.flipY).toBe(false);
  expect(material.map?.anisotropy).toBe(4);
  scope.dispose();
});

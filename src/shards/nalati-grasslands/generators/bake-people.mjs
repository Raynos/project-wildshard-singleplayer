// Exact camp conditioning and merge, before download. Browser canvas packing stays unchanged.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { readSourceModel, skinnedGlb } from '@wildshard/sdk/bake/skinned';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import frames from '../data/peopleFrames.json' with { type: 'json' };
import { fitNpcFigure, mergeNpcFigures, rawFromGltf } from './peopleRig.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** Same intake, cuts, conditioning, registration order and float32 channel writes as the former page path. */
export async function preparePeople(keys, phone) {
  const figures = await Promise.all(keys.map(async key => {
    const row = frames[key], frame = { height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder) };
    const source = await readSourceModel(readFileSync(resolve(root, `public/assets/nalati/models/people/${row.file}.gen${phone ? '.phone' : ''}.glb`)));
    const raw = rawFromGltf(source.gltf.scene, `person ${key}`), cuts = [];
    source.gltf.scene.traverse(object => { if (typeof object.userData.neckCut === 'number') cuts.push(object.userData.neckCut * frame.height); });
    return fitNpcFigure(key, raw.geometry, null, frame, cuts[0] ?? null);
  }));
  const rig = mergeNpcFigures(figures, () => new THREE.MeshLambertMaterial(), 'nalati-camp-people-gen', phone ? 256 : 512);
  // The browser only draws the original atlases. Its former UV packing happens offline now.
  const uv = rig.mesh.geometry.getAttribute('uv');
  let offset = 0;
  figures.forEach((figure, i) => {
    const count = figure.head.length;
    for (let j = offset; j < offset + count; j++) uv.setXY(j, (i % 3 + uv.getX(j)) / 3, (Math.floor(i / 3) + uv.getY(j)) / 2);
    offset += count;
  });
  return rig;
}

export async function bakePeople(keys, phone) {
  const rig = await preparePeople(keys, phone);
  const bones = rig.mesh.skeleton.bones.map(bone => {
    const figure = rig.bones[bone.name.slice(0, bone.name.lastIndexOf('-'))];
    const position = bone.name.endsWith('-head') ? figure.neck : bone.name.endsWith('-arm') ? figure.shoulder : new THREE.Vector3();
    return { name: bone.name, parent: null, pos: position.toArray() };
  });
  return skinnedGlb({ name: 'nalati-camp-people-gen', bones,
    parts: [{ name: 'nalati-camp-people-gen', geometry: rig.mesh.geometry, material: new THREE.MeshStandardMaterial() }] }).glb;
}

if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-people');
  writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/peopleFrames.generated.json'), jsonBytes(frames));
  for (const phone of [false, true]) for (const keys of [Object.keys(frames), ...Object.keys(frames).map(key => [key])]) {
    writer.put(resolve(root, `public/assets/nalati/baked/people/${keys.length === 1 ? keys[0] : 'camp'}${phone ? '.phone' : ''}.glb`), await bakePeople(keys, phone));
  }
  writer.finish();
}

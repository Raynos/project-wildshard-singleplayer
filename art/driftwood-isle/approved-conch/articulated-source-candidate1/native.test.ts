import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Bone, Matrix4, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
import { rigidCorpseSchema } from '../../../../src/format/rigidCorpse';
import source from './model.json' with { type: 'json' };
import metadata from './metadata.json' with { type: 'json' };
import recipe from './recipe.json' with { type: 'json' };
import contract from './contract.json' with { type: 'json' };
const folder = resolve('art/driftwood-isle/approved-conch/articulated-source-candidate1');
async function load() {
  const bytes = new Uint8Array(readFileSync(resolve(folder, 'payload.bin')));
  const library = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await library.preload();
  return library;
}
test('existing strict native consumer retains every packed source attribute and eight-owner recipe', async () => {
  expect(v.parse(rigidCorpseSchema, recipe)).toEqual(recipe);
  expect(recipe.parts).toHaveLength(8);
  expect(recipe.parts.reduce((n, p) => n + p.points.length, 0)).toBe(333);
  const library = await load();
  const first = library.copy('conch-duelist', 'conch-duelist');
  const second = library.copy('conch-duelist', 'conch-duelist');
  expect(first.bones).toEqual(source.bones);
  expect(first.dims.rigidCorpse).toEqual(recipe);
  expect(first.hardParts).toHaveLength(8);
  expect(first.furParts).toHaveLength(0); expect(first.eyeParts).toHaveLength(0);
  for (const [i, part] of source.parts.entries()) {
    const mesh = first.hardParts[i];
    if (mesh === undefined) throw new Error('Missing part');
    expect(mesh).not.toBe(second.hardParts[i]);
    for (const [name, width, values] of [
      ['position', 3, part.positions], ['normal', 3, part.normals], ['color', 3, part.colorsLinear],
      ['skinIndex', 4, part.skinIndices], ['skinWeight', 4, part.skinWeights], ['furLen', 1, part.furLen],
    ] as const) {
      const attr = mesh.getAttribute(name);
      const expected = name === 'skinIndex' ? Uint16Array.from(values) : Float32Array.from(values);
      expect(attr.itemSize).toBe(width); expect(attr.normalized).toBe(false);
      expect(Array.from(attr.array)).toEqual(Array.from(expected));
    }
    mesh.dispose(); second.hardParts[i]?.dispose();
  }
});
test('actual THREE all-weight skin equals each anatomical rigid owner at independent diagnostic articulation', async () => {
  const model = (await load()).copy('conch-duelist', 'conch-duelist');
  const joints = model.bones.map(def => {
    const b = new Bone(); b.name = def.name;
    const p = model.bones.find(row => row.name === def.parent);
    b.position.set(def.pos[0] - (p?.pos[0] ?? 0), def.pos[1] - (p?.pos[1] ?? 0), def.pos[2] - (p?.pos[2] ?? 0));
    return b;
  });
  const byName = new Map(joints.map(j => [j.name, j]));
  for (const [i, def] of model.bones.entries()) {
    const joint = joints[i]; const parent = byName.get(def.parent ?? '');
    if (joint && parent) parent.add(joint);
  }
  const root = joints[0];
  if (root === undefined) throw new Error('Missing root');
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(joints);
  const material = new MeshBasicMaterial();
  const meshes = model.hardParts.map(geometry => {
    const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton); return mesh;
  });
  // These are deliberately diagnostic transforms, NOT admitted gait/phase poses.
  for (const yaw of [0, .37, -1.1]) {
    for (const [i, joint] of joints.entries()) {
      if (contract.fixedJoints.includes(joint.name)) joint.rotation.set(0, 0, 0);
      else joint.rotation.set(.021 * i, joint === root ? yaw : -.017 * i, .013 * i);
    }
    root.updateMatrixWorld(true); skeleton.update();
    for (const [i, mesh] of meshes.entries()) {
      const owner = recipe.parts[i]?.bone;
      const index = joints.findIndex(b => b.name === owner);
      const bone = joints[index]; const def = model.bones[index];
      if (bone === undefined || def === undefined) throw new Error('Missing anatomical owner');
      const skin = bone.matrixWorld.clone().multiply(new Matrix4().makeTranslation(-def.pos[0], -def.pos[1], -def.pos[2]));
      const p = mesh.geometry.getAttribute('position');
      for (let corner = 0; corner < p.count; corner++) {
        const original = new Vector3().fromBufferAttribute(p, corner);
        const actual = mesh.applyBoneTransform(corner, original.clone());
        expect(actual.distanceTo(original.applyMatrix4(skin))).toBeLessThan(1e-12);
      }
    }
  }
  for (const mesh of meshes) mesh.geometry.dispose();
  material.dispose(); skeleton.dispose();
});
test('strict recipe refuses unrelated extra owner, inflated budget, invalid owner duplicates and flat hull', () => {
  const extra = structuredClone(recipe); const first = extra.parts[0];
  if (first === undefined) throw new Error('Missing recipe');
  extra.parts.push({ ...first, bone: 'invented' });
  expect(() => v.parse(rigidCorpseSchema, extra)).toThrow();
  const duplicate = structuredClone(recipe); const last = duplicate.parts[7];
  if (last === undefined) throw new Error('Missing recipe');
  last.bone = first.bone;
  expect(() => v.parse(rigidCorpseSchema, duplicate)).toThrow();
  const flat = structuredClone(recipe); const flatFirst = flat.parts[0];
  if (flatFirst === undefined) throw new Error('Missing recipe');
  flatFirst.points = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
  expect(() => v.parse(rigidCorpseSchema, flat)).toThrow();
  const over = structuredClone(recipe); const overFirst = over.parts[0];
  if (overFirst === undefined) throw new Error('Missing recipe');
  overFirst.points = Array.from({ length: 129 }, (_, i) => [i / 100, Math.sin(i), Math.cos(i)]);
  expect(() => v.parse(rigidCorpseSchema, over)).toThrow();
});

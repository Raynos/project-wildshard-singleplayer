import { expect, test } from 'vitest';
import { Bone, BoxGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Scene, Skeleton, SkinnedMesh } from 'three';
import { sceneJobs } from '../src/engine/render/precompile';

test('preparation retains both shadow-receiver variants of a shared material', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const plain = new Mesh(geometry, material), receiver = new Mesh(geometry, material), duplicate = new Mesh(geometry, material);
  receiver.receiveShadow = true;
  scene.add(plain, receiver, duplicate);
  const { jobs, materials } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(materials).toBe(1);
  expect(copies).toHaveLength(2);
  expect(copies.map(copy => copy.receiveShadow)).toEqual([false, true]);
  expect(scene.children).toEqual([plain, receiver, duplicate]);
  expect(plain.receiveShadow).toBe(false); expect(receiver.receiveShadow).toBe(true);
  geometry.dispose(); material.dispose();
});

test('preparation covers distinct skin array lengths without splitting instance counts', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const first = new SkinnedMesh(geometry, material), second = new SkinnedMesh(geometry, material);
  first.bind(new Skeleton([new Bone(), new Bone()]));
  second.bind(new Skeleton([new Bone(), new Bone(), new Bone()]));
  const small = new InstancedMesh(geometry, material, 3), large = new InstancedMesh(geometry, material, 5);
  scene.add(first, second, small, large);
  const { jobs } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(copies).toHaveLength(3);
  expect(copies.filter((copy): copy is SkinnedMesh => copy instanceof SkinnedMesh).map(copy => copy.skeleton.bones.length)).toEqual([2, 3]);
  expect(copies.filter(copy => copy instanceof InstancedMesh)).toHaveLength(1);
  first.skeleton.dispose(); second.skeleton.dispose(); small.dispose(); large.dispose();
  geometry.dispose(); material.dispose();
});

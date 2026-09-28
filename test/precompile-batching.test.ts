import { describe, expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Scene } from 'three';
import { sceneJobs, shadowJobs } from '../src/boot/precompile';

vi.mock('../src/boot/perflog', () => ({ PERFLOAD: false }));

function fixture(): Scene {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const plain = new Mesh(geometry, material);
  scene.add(plain);
  for (const colored of [false, true]) {
    const batch = new BatchedMesh(1, geometry.getAttribute('position').count, geometry.index?.count ?? 0, material);
    const instance = batch.addInstance(batch.addGeometry(geometry));
    if (colored) batch.setColorAt(instance, new Color(0xffffff));
    scene.add(batch);
  }
  for (const object of scene.children) object.castShadow = true;
  return scene;
}

describe('shader preparation for shared plain and batched materials', () => {
  it('keeps all three GPU program variants even when geometry attributes and material match', () => {
    const scene = fixture();
    const { jobs, materials } = sceneJobs(scene, null);
    expect(materials).toBe(1);
    expect(jobs.flatMap((job) => job.root.children)).toHaveLength(3);
    expect(scene.children.map((mesh) => mesh.parent)).toEqual([scene, scene, scene]);
  });

  it('also prepares each caster variant before the first shadow draw', () => {
    const jobs = shadowJobs(fixture(), null);
    const root = new Group();
    for (const job of jobs) root.add(job.root);
    let batches = 0;
    root.traverse((o) => { if (o instanceof BatchedMesh) batches++; });
    expect(batches).toBe(2);
  });
});

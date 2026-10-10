import { describe, expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Color, Group, Mesh, MeshDepthMaterial, MeshStandardMaterial, Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import { sceneJobs, shadowJobs, postJobs } from '../src/engine/render/precompile';

import { BloomEffect, EffectComposer, EffectPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { WorldRenderPass } from '../src/engine/core/worldDepth';

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


it('includes the real world-depth merge material with the compositor post jobs', () => {
  const composer = new EffectComposer();
  // Only clearDepth is captured by this pass's constructor; no WebGL is used in this job-inventory fixture.
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  Reflect.set(renderer, 'clearDepth', (): void => undefined);
  vi.spyOn(composer, 'getRenderer').mockReturnValue(renderer);
  const pass = new WorldRenderPass(new Scene(), new PerspectiveCamera(), composer);
  composer.passes.push(pass);
  const jobs = postJobs(composer, composer.inputBuffer);
  expect(jobs.flatMap(job => job.root.children).some(object => object instanceof Mesh && object.material === pass.mergeMaterial)).toBe(true);
  expect(jobs.find(job => job.root.children.some(object => object instanceof Mesh && object.material === pass.mergeMaterial))?.rt).toBe(composer.inputBuffer);
  pass.dispose(); composer.dispose();
});

it('releases temporary shadow program holders without disposing borrowed caster resources', () => {
  const scene = fixture(), custom = new MeshDepthMaterial(), first = scene.children[0];
  if (!(first instanceof Mesh)) throw new Error('Missing fixture caster');
  first.customDepthMaterial = custom;
  const borrowedMaterial = vi.spyOn(custom, 'dispose'), borrowedGeometry = vi.spyOn(first.geometry, 'dispose');
  const jobs = shadowJobs(scene, null), temporary = jobs.flatMap(job => job.root.children)
    .filter((object): object is Mesh => object instanceof Mesh).map(mesh => mesh.material)
    .filter((material): material is MeshDepthMaterial => material instanceof MeshDepthMaterial && material !== custom);
  const released = temporary.map(material => vi.spyOn(material, 'dispose'));
  for (const job of jobs) job.dispose?.();
  expect(released.length).toBeGreaterThan(0);
  for (const dispose of released) expect(dispose).toHaveBeenCalledOnce();
  expect(borrowedMaterial).not.toHaveBeenCalled(); expect(borrowedGeometry).not.toHaveBeenCalled();
  custom.dispose();
});


it('prepares enabled bloom without a threshold and skips the inactive AGX adaptation passes', () => {
  const composer = new EffectComposer(), bloom = new BloomEffect({ luminanceThreshold: 0, luminanceSmoothing: 0 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const pass = new EffectPass(new PerspectiveCamera(), bloom, tone);
  composer.passes.push(pass);
  try {
    const jobs = postJobs(composer, composer.inputBuffer);
    const materials = jobs.flatMap(job => job.root.children).filter((object): object is Mesh => object instanceof Mesh)
      .flatMap(object => Array.isArray(object.material) ? object.material : [object.material]);
    expect(bloom.luminanceMaterial.defines).not.toHaveProperty('THRESHOLD');
    expect(materials).toContain(bloom.luminanceMaterial);
    expect(materials.filter(material => material.name === 'LuminanceMaterial')).toEqual([bloom.luminanceMaterial]);
    expect(materials).not.toContain(tone.adaptiveLuminanceMaterial);
    for (const job of jobs) job.dispose?.();
  } finally { composer.dispose(); }
});


it('includes actual adaptive tone passes when enabled and omits a disabled composer pass', () => {
  const composer = new EffectComposer(), tone = new ToneMappingEffect({ mode: ToneMappingMode.REINHARD2_ADAPTIVE });
  const pass = new EffectPass(new PerspectiveCamera(), tone);
  composer.passes.push(pass);
  try {
    const jobs = postJobs(composer, composer.inputBuffer);
    const materials = jobs.flatMap(job => job.root.children).filter((object): object is Mesh => object instanceof Mesh)
      .flatMap(object => Array.isArray(object.material) ? object.material : [object.material]);
    expect(materials).toContain(tone.adaptiveLuminanceMaterial);
    expect(materials.filter(material => material.name === 'LuminanceMaterial')).toHaveLength(1);
    for (const job of jobs) job.dispose?.();
    pass.enabled = false;
    expect(postJobs(composer, composer.inputBuffer)).toEqual([]);
  } finally { composer.dispose(); }
});

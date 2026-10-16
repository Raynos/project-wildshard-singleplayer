import { expect, test } from 'vitest';
import { BloomEffect, EffectPass, Pass, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { PerspectiveCamera, ShaderMaterial, WebGLRenderTarget } from 'three';
import { postJobs, type CompileJob } from '../src/engine/render/precompile';

function preparedMaterials(jobs: readonly CompileJob[]): ShaderMaterial[] {
  return jobs.flatMap(job => job.root.children.flatMap(child => {
    const material: unknown = Reflect.get(child, 'material');
    return material instanceof ShaderMaterial ? [material] : [];
  }));
}

test('composer back-references cannot hide nested bloom preparation', () => {
  const bloom = new BloomEffect(), colour = new EffectPass(new PerspectiveCamera(), bloom);
  const composer: { passes: Pass[] } = { passes: [] };
  const world = Object.assign(new Pass('world'), { composer });
  composer.passes.push(world, colour);
  const target = new WebGLRenderTarget(1, 1);
  const jobs = postJobs(composer, target);
  const materials = preparedMaterials(jobs);
  expect(materials).toContain(bloom.luminanceMaterial);
  expect(materials.map(material => material.name)).toContain('DownsamplingMaterial');
  expect(materials.map(material => material.name)).toContain('UpsamplingMaterial');
  expect(new Set(materials).size).toBe(materials.length);
  expect(jobs.every(job => job.rt === target)).toBe(true);
  expect(composer.passes).toEqual([world, colour]);
  for (const job of jobs) job.dispose?.();
  colour.dispose(); world.dispose(); target.dispose();
});

test('preparation still excludes disabled passes and unused tone adaptation', () => {
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const colour = new EffectPass(new PerspectiveCamera(), tone);
  const disabled = new Pass('disabled'), skipped = new ShaderMaterial();
  disabled.fullscreenMaterial = skipped; disabled.enabled = false;
  const jobs = postJobs({ passes: [disabled, colour] }, null);
  const materials = preparedMaterials(jobs);
  expect(materials).not.toContain(skipped);
  expect(materials).toEqual([colour.fullscreenMaterial]);
  expect(jobs.every(job => job.rt === null)).toBe(true);
  expect(disabled.enabled).toBe(false);
  for (const job of jobs) job.dispose?.();
  colour.dispose(); disabled.dispose();
});

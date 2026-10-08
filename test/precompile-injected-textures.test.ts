import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import * as assets from '../src/engine/core/assets';
import * as treeSet from '../src/engine/world/forest/treeSet';
import { splatTerrainMaterial } from '../src/engine/world/Terrain';
import { PineTreeFactory } from '../src/shards/pine-hollow/world/treeFactory';
import { PINE_TREE_SET } from '../src/shards/pine-hollow/world/treeSet';
import { patchShader, copyShaderPatches, shaderPatchTextures, PATCH_ORDER } from '../src/engine/render/shaderPatches';
import { collectTextures, runPrecompile, sceneJobs, warmComposerFrame } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

function arrayTexture(size: number, layers: number): THREE.CompressedArrayTexture {
  return new THREE.CompressedArrayTexture([{ data: new Uint8Array(16), width: size, height: size }], size, size, layers, THREE.RGBA_ASTC_4x4_Format);
}

function rendererRecorder(commands: Record<string, unknown>): THREE.WebGLRenderer {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  return renderer;
}

it('discovers all six real terrain/bark injected arrays before compiling either material', async () => {
  const ground = { map: arrayTexture(1024, 4), normalMap: arrayTexture(1024, 4), armMap: arrayTexture(512, 4) };
  const bark = { map: arrayTexture(512, 5), normalMap: arrayTexture(512, 5), armMap: arrayTexture(512, 5) };
  vi.spyOn(assets, 'loadTexture').mockImplementation(() => Promise.resolve(new THREE.Texture()));
  vi.spyOn(assets, 'loadPBRArray').mockResolvedValue(bark);
  vi.spyOn(treeSet, 'loadTreeSetGeometry').mockResolvedValue(new Map(PINE_TREE_SET.map(spec => [spec.name, {
    trunk: new THREE.BufferGeometry(), trunkLo: new THREE.BufferGeometry(), hi: new THREE.BufferGeometry(),
    lo: new THREE.BufferGeometry(), twigs: new THREE.BufferGeometry(), far: new THREE.BufferGeometry(),
  }])));
  const factory = await new PineTreeFactory(rendererRecorder({ extensions: { has: () => false } }), { set: 'fixture' }).build();
  const terrain = splatTerrainMaterial(ground, { tints: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], boreal: null });
  const scene = new THREE.Scene(), geometry = new THREE.BufferGeometry();
  scene.add(new THREE.Mesh(geometry, terrain), new THREE.Mesh(geometry, factory.barkMaterial));
  const textures = collectTextures(sceneJobs(scene, null).jobs);
  expect(textures.filter(texture => texture instanceof THREE.CompressedArrayTexture)).toEqual([...Object.values(ground), ...Object.values(bark)]);
  expect(terrain.customProgramCacheKey()).toBe('terrain-splat');
  expect(factory.barkMaterial.customProgramCacheKey()).toBe('bark-set');
  const standard = THREE.ShaderLib.standard;
  for (const material of [terrain, factory.barkMaterial]) {
    const shader = { vertexShader: standard.vertexShader, fragmentShader: standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
    Reflect.apply(material.onBeforeCompile.bind(material), undefined, [shader, null]);
    const bound = Object.values(shader.uniforms).map((uniform): unknown => uniform.value);
    for (const texture of shaderPatchTextures(material)) expect(bound).toContain(texture);
  }
});

it('copies and removes borrowed texture declarations with active patches without changing keys or disposing textures', () => {
  const material = new THREE.MeshStandardMaterial(), copy = material.clone(), first = new THREE.Texture(), second = new THREE.Texture();
  const dispose = vi.spyOn(first, 'dispose'), callback = vi.fn<() => void>();
  const undo = patchShader(material, 'fixture.arrays', PATCH_ORDER.material, callback, { textures: [first, first, second], key: 'unchanged' });
  copyShaderPatches(material, copy);
  expect(shaderPatchTextures(copy)).toEqual([first, second]);
  expect(callback).not.toHaveBeenCalled();
  expect(copy.customProgramCacheKey()).toBe(material.customProgramCacheKey());
  undo(); expect(shaderPatchTextures(material)).toEqual([]); expect(shaderPatchTextures(copy)).toEqual([first, second]);
  patchShader(copy, 'fixture.replace', PATCH_ORDER.material, callback, { mode: 'replace' });
  expect(shaderPatchTextures(copy)).toEqual([]); expect(dispose).not.toHaveBeenCalled();
});

async function warmArrays(error: number, cancelAfterFirst = false): Promise<{ events: string[]; failure: unknown }> {
  const previous = scopeEnvironment(), events: string[] = [];
  let frame = 0, current = true, uploads = 0;
  installScopeEnvironment({ targetKind: () => 'other', frame: render => {
    queueMicrotask(() => { frame++; events.push(`paint:${frame}`); render(frame); }); return 1;
  }, cancelFrame: () => undefined });
  const renderer = rendererRecorder({ extensions: { has: () => false }, info: { programs: [] },
    getRenderTarget: () => null, setRenderTarget: () => undefined,
    initTexture: () => { uploads++; events.push(`upload:${frame}`); },
    getContext: () => ({ NO_ERROR: 0, getError: () => {
      events.push(`fence:${frame}`); if (cancelAfterFirst) current = false; return error;
    } }),
  });
  let failure: unknown;
  try {
    await warmComposerFrame({ render: () => { events.push(`composer:${frame}`); } }, renderer,
      () => runPrecompile(renderer, new THREE.PerspectiveCamera(), [], 0, undefined,
        Array.from({ length: 6 }, () => arrayTexture(4, 4)), () => current), () => current);
  } catch (caught) { failure = caught; }
  finally { installScopeEnvironment(previous); }
  expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(uploads);
  return { events, failure };
}

it('uploads each compressed array on its own painted slice and fences all six before the composer', async () => {
  const { events, failure } = await warmArrays(0);
  expect(failure).toBeUndefined();
  const uploads = events.filter(event => event.startsWith('upload:'));
  expect(uploads).toHaveLength(6); expect(new Set(uploads).size).toBe(6);
  for (const upload of uploads) expect(events[events.indexOf(upload) + 1]).toBe(upload.replace('upload:', 'fence:'));
  expect(events.at(-1)).toMatch(/^composer:/u);
  expect(events.at(-2)).toMatch(/^paint:/u);
});

it('stops before the next array or composer when the graphics fence reports an error', async () => {
  const { events, failure } = await warmArrays(1282);
  expect(String(failure)).toContain('Graphics error 1282');
  expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
  expect(events.some(event => event.startsWith('composer:'))).toBe(false);
});

it('cancels between isolated arrays when the entered owner leaves', async () => {
  const { events, failure } = await warmArrays(0, true);
  expect(String(failure)).toContain('Shader warm-up owner left');
  expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
  expect(events.some(event => event.startsWith('composer:'))).toBe(false);
});

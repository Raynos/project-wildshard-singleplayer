import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

// Debug ▸ Performance ▸ Split program keys (sp-o286): the split key is the stock key, and each part moves only with
// what it depends on: the material part with the material's version, the scene part with the render call's lights and
// output, the object part per draw.
test('split program keys equal the stock key and invalidate the right part', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  let target: THREE.WebGLRenderTarget | null = null;
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => target,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, material);
  const instances = new THREE.InstancedMesh(geometry, material, 4);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight();
  scene.add(mesh, instances);
  // the key with the row off and on, for the current draw; the two must always agree
  const both = (object: THREE.Object3D): string => {
    handler.setObject(object, material);
    handler.splitKeys = false; const stock = material.customProgramCacheKey();
    handler.splitKeys = true; const split = material.customProgramCacheKey();
    expect(split).toBe(stock);
    return split;
  };
  handler.renderStart(scene, camera); handler.updateLights([]);
  const first = both(mesh);
  expect(handler.materialKeyWalks).toBe(1);
  // an unchanged draw walks nothing
  for (let i = 0; i < 3; i++) expect(material.customProgramCacheKey()).toBe(first);
  expect(handler.materialKeyWalks).toBe(1);
  // object parts: receive-shadow and instancing change the key, never the material part
  mesh.receiveShadow = true;
  const received = both(mesh);
  expect(received).not.toBe(first);
  const instanced = both(instances);
  expect(instanced).not.toBe(received);
  expect(handler.materialKeyWalks).toBe(1);
  // output part: a render target switches the output transform within the render call (the row-off memo keeps its
  // first key for the whole render call, so only the split key is checked here)
  target = new THREE.WebGLRenderTarget(1, 1);
  const targeted = material.customProgramCacheKey();
  expect(targeted).not.toBe(received);
  expect(targeted).toContain(`${String(THREE.NoToneMapping)}:${THREE.ColorManagement.workingColorSpace}`);
  target = null;
  expect(both(mesh)).toBe(received);
  expect(handler.materialKeyWalks).toBe(1);
  handler.renderEnd();
  // scene part: the next render call (lights, scene context, output) is keyed afresh, still without a material walk
  handler.renderStart(scene, camera); handler.updateLights([sun]);
  Reflect.set(renderer, 'toneMapping', THREE.NoToneMapping);
  const plain = both(mesh);
  expect(plain).not.toBe(received);
  expect(handler.materialKeyWalks).toBe(1);
  handler.renderEnd();
  Reflect.set(renderer, 'toneMapping', THREE.ACESFilmicToneMapping);
  handler.renderStart(scene, camera); handler.updateLights([]);
  expect(both(mesh)).toBe(received);
  // material part: a material edit (its version) walks again, and a swapped node changes the key
  material.colorNode = compileGraph({ version: 1, kind: 'material', model: 'unlit', params: { colour: { type: 'vec3', value: [0, 1, 0] } },
    nodes: { colour: { op: 'param', param: 'colour' } }, stages: { surface: { colour: 'colour' } }, effectState: { fog: false } }).material.colorNode;
  material.needsUpdate = true;
  const edited = both(mesh);
  expect(handler.materialKeyWalks).toBe(2);
  expect(edited).not.toBe(received);
  handler.renderEnd();
});

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
  // output part: a render target switches the output transform within the render call, with the row off and on
  target = new THREE.WebGLRenderTarget(1, 1);
  const targeted = both(mesh);
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

// sp-o290: the row-off memo (dc4740b44) kept the first stock key for the whole render call, so a target bound inside
// one render call (or a light update) reused the previous target's output transform and could pick the wrong program.
// Its key must equal the one a render call that starts on that target computes (the pre-memo key, every draw fresh).
test('the row-off key memo follows a target bound inside one render call', () => {
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight();
  scene.add(mesh);
  const key = (): string => { handler.setObject(mesh, material); return material.customProgramCacheKey(); };
  const offscreen = new THREE.WebGLRenderTarget(1, 1);
  // the reference keys: each from a render call that starts on its target and lights
  handler.renderStart(scene, camera); handler.updateLights([]); const screenKey = key(); handler.renderEnd();
  target = offscreen;
  handler.renderStart(scene, camera); handler.updateLights([]); const targetKey = key(); handler.renderEnd();
  target = null;
  handler.renderStart(scene, camera); handler.updateLights([sun]); const litKey = key(); handler.renderEnd();
  expect(targetKey).not.toBe(screenKey);
  expect(targetKey).toContain(`${String(THREE.NoToneMapping)}:${THREE.ColorManagement.workingColorSpace}`);
  // one render call: screen, the target, the screen again, then a light update; every key matches its reference
  handler.renderStart(scene, camera); handler.updateLights([]);
  expect(key()).toBe(screenKey);
  target = offscreen;
  expect(key()).toBe(targetKey);
  expect(key()).toBe(targetKey);
  target = null;
  expect(key()).toBe(screenKey);
  handler.updateLights([sun]);
  expect(key()).toBe(litKey);
  // the renderer's output transform moving inside the call (a tone-mapping change) is keyed afresh too
  Reflect.set(renderer, 'toneMapping', THREE.NoToneMapping);
  expect(key()).not.toBe(litKey);
  handler.renderEnd();
});

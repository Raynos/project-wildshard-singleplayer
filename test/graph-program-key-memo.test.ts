import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { Scope } from '../src/engine/app/scope';
import { PATCH_ORDER, patchShader } from '../src/engine/render/shaderPatches';
import { NodeMaterial } from 'three/webgpu';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

// sp-o290: the program-key memo (dc4740b44) kept the first stock key for the whole render call, so a target bound inside
// one render call (or a light update) reused the previous target's output transform and could pick the wrong program.
// Its key must equal the one a render call that starts on that target computes (the pre-memo key, every draw fresh).
test('the program-key memo follows a target bound inside one render call', () => {
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

// The memo outlives a render call while the scene's hash (lights, environment, fog), the target and the output transform
// hold: the stock key's node walk runs once, not once per render call; a scene hash change keys afresh.
test('the program-key memo outlives render calls of an unchanged scene', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
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
  const walk = vi.spyOn(NodeMaterial.prototype, 'customProgramCacheKey');
  const call = (lights: THREE.Light[]): string => {
    handler.renderStart(scene, camera); handler.updateLights(lights); handler.setObject(mesh, material);
    const key = material.customProgramCacheKey(); handler.renderEnd(); return key;
  };
  const first = call([]);
  expect(call([])).toBe(first); expect(call([])).toBe(first);
  expect(walk).toHaveBeenCalledTimes(1);
  scene.fog = new THREE.Fog(0xffffff, 1, 10);
  const fogged = call([sun]);
  expect(fogged).not.toBe(first); expect(walk).toHaveBeenCalledTimes(2);
  expect(call([sun])).toBe(fogged); expect(walk).toHaveBeenCalledTimes(2);
  walk.mockRestore();
});

// A frame that draws a material into a target and to the screen keeps a memo for each: alternating them costs no walk.
test('the program-key memo keeps a key per bound target across alternating render calls', () => {
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(mesh);
  const offscreen = new THREE.WebGLRenderTarget(1, 1);
  const walk = vi.spyOn(NodeMaterial.prototype, 'customProgramCacheKey');
  const call = (into: THREE.WebGLRenderTarget | null): string => {
    target = into; handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    const key = material.customProgramCacheKey(); handler.renderEnd(); return key;
  };
  const screen = call(null), inTarget = call(offscreen);
  expect(inTarget).not.toBe(screen);
  for (let i = 0; i < 3; i++) { expect(call(offscreen)).toBe(inTarget); expect(call(null)).toBe(screen); }
  expect(walk).toHaveBeenCalledTimes(2);
  walk.mockRestore();
});


test('node binding retains a registered clip key and releases it with its owner', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  for (const [key, value] of Object.entries({
    extensions: { has: () => false, get: () => null }, getContext: (): object => ({}), getRenderTarget: (): THREE.WebGLRenderTarget | null => null,
    toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  })) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, material), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), owner = new Scope('node-clip');
  scene.add(mesh); handler.renderStart(scene, camera); handler.updateLights([]);
  try {
    handler.setObject(mesh, material); const plain = material.customProgramCacheKey(); let edge = 'a';
    patchShader(material, 'grid-cell-clip', PATCH_ORDER.view, shader => { shader.fragmentShader += '\n// cell boundary'; }, { key: key => `${key}|grid-cell-clip:${edge}`, scope: owner });
    handler.setObject(mesh, material); const clipped = material.customProgramCacheKey();
    expect(clipped).not.toBe(plain); expect(clipped).toContain('|grid-cell-clip');
    handler.setObject(mesh, material); expect(material.customProgramCacheKey()).toBe(clipped);
    edge = 'b'; handler.setObject(mesh, material); expect(material.customProgramCacheKey()).not.toBe(clipped);
    edge = 'a'; handler.setObject(mesh, material); expect(material.customProgramCacheKey()).toBe(clipped);
    owner.dispose(); handler.setObject(mesh, material); expect(material.customProgramCacheKey()).toBe(plain);
  } finally { owner.dispose(); handler.renderEnd(); geometry.dispose(); material.dispose(); }
});

import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
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

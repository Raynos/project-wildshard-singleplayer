import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { installAtmosphere } from '../src/engine/world/Atmosphere';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const sampled = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const handler = new EngineNodesHandler(), compiled = compileGraph(graph, { textures: () => sampled });
  const material = compiled.material.clone(); compiled.material.dispose();
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.Fog(0xaaaaaa, 1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(object, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}


test('vertex factors reach directional light and both engine fog blends', () => {
  installAtmosphere({ weather: true });
  const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
    factor: { op: 'attribute', name: 'aSeed', type: 'float' },
    dx: { op: 'dFdx', in: ['factor'] },
  }, stages: { 'vertex.scale': { sun: 'factor', fog: 'factor' }, surface: { colour: [1, 1, 1] } } };
  const shader = program(graph);
  expect(shader.vertexShader).toContain('wildshardGraphSunScale = clamp(');
  expect(shader.vertexShader).toContain('wildshardGraphFogScale = clamp(');
  expect(shader.fragmentShader.match(/wildshardGraphSunScale/g)?.length).toBeGreaterThan(1);
  expect(shader.fragmentShader.match(/wildshardGraphFogScale/g)?.length).toBeGreaterThan(2);
  const neutral = program({ ...graph, stages: { surface: { colour: [1, 1, 1] } } });
  expect(neutral.vertexShader).not.toContain('wildshardGraphSunScale');
  expect(neutral.fragmentShader).not.toContain('wildshardGraphFogScale');
  expect(validateGraph({ ...graph, model: 'unlit' }).ok).toBe(false);
  expect(validateGraph({ ...graph, stages: { 'vertex.scale': { fog: 'dx' } } }).ok).toBe(false);
});

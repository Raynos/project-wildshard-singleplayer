import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { vec3 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { ToonLook } from '../src/engine/render/families/toon';
import { graph as authorGraph } from '../src/sdk/materials';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, toon: ToonLook): THREE.WebGLProgramParametersWithUniforms {
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
  const handler = new EngineNodesHandler(), material = compileGraph(graph, { toon, textures: () => sampled }).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); const light = new THREE.DirectionalLight(0xffffff, 1); scene.add(light); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}

test('one toon material omits the caustic term while its siblings keep the shared water and bands', () => {
  const look = new ToonLook({ caustics: { level: 0, strength: 0.7 } });
  const ir: GraphIr = { version: 1, kind: 'material', model: 'toon', nodes: {}, stages: { surface: { colour: [0.2, 0.5, 0.8] } } };
  const base = program(ir, look), surface = program({ ...ir, toonCaustics: false }, look);
  const has = (shader: THREE.WebGLProgramParametersWithUniforms, value: unknown): boolean => Object.values(shader.uniforms).some(u => u.value === value);
  expect(has(base, look.uniforms.famToonWater.value)).toBe(true);
  expect(has(surface, look.uniforms.famToonWater.value)).toBe(false);
  expect(has(surface, look.uniforms.famToonFace.value)).toBe(true);
  look.set({ caustics: { level: 3, strength: 0.2 } });
  expect(has(base, look.uniforms.famToonWater.value)).toBe(true);
  expect(look.params.caustics.level).toBe(3);
  expect(authorGraph({ model: 'toon', toonCaustics: false, surface: { colour: vec3(1) } }).toonCaustics).toBe(false);
  expect(validateGraph({ ...ir, model: 'standard', toonCaustics: false }).ok).toBe(false);
  expect(validateGraph({ ...ir, toonCaustics: 'off' }).ok).toBe(false);
});

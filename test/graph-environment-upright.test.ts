import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { TextureNode } from 'three/webgpu';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** a lit graph's program under the engine's node handler, its scene lit by `environment` */
function program(environment: THREE.Texture): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {}, stages: { surface: { colour: [0.5, 0.5, 0.5], roughness: 1 } } };
  const handler = new EngineNodesHandler(), compiled = compileGraph(graph);
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1), object = new THREE.Mesh(geometry, compiled.material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.environment = environment;
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(compiled.material, object, parameters); return parameters; }
  finally { geometry.dispose(); compiled.material.dispose(); }
}

test('a classic PMREM environment lights node materials upright', () => {
  // the classic PMREMGenerator's output: a render target's texture in the cube-UV atlas layout, stored upright
  const target = new THREE.WebGLRenderTarget(768, 1024);
  target.texture.mapping = THREE.CubeUVReflectionMapping;
  try {
    const samplers = Object.values(program(target.texture).uniforms).filter((u): u is TextureNode => u instanceof TextureNode && u.value === target.texture);
    expect(samplers.length).toBeGreaterThan(0);
    // three's GLSL builder flips a render target's samples for WebGPURenderer's storage: none of these may
    for (const sampler of samplers) expect(Reflect.get(sampler, '_flipYUniform')).toBeNull();
  } finally { target.dispose(); }
});

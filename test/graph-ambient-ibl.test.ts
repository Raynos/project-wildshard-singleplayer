import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { PhysicalLightingModel, TextureNode } from 'three/webgpu';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** a lit graph's program under the engine's node handler, its scene lit by `environment` */
function program(environment: THREE.Texture, model: 'standard' | 'ambient' | 'toon'): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const graph: GraphIr = { version: 1, kind: 'material', model: model === 'ambient' ? 'standard' : model, nodes: {}, stages: { ...(model === 'ambient' ? { lighting: { sun: [0, 0, 0], sunSpecular: 1, ambient: [0.1, 0.2, 0.3] } } : {}), surface: { colour: [0.5, 0.5, 0.5], roughness: 1 } } };
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

test('toon ambient excludes IBL diffuse but keeps environment specular and restores the context', () => {
  const target = new THREE.WebGLRenderTarget(768, 1024);
  target.texture.mapping = THREE.CubeUVReflectionMapping;
  const seen: { context: object; irradiance: unknown }[] = [];
  const original: unknown = Reflect.get(PhysicalLightingModel.prototype, 'indirectSpecular');
  if (typeof original !== 'function') throw new Error('Missing physical specular calculation');
  const spy = vi.spyOn(PhysicalLightingModel.prototype, 'indirectSpecular').mockImplementation(function captureSpecular(this: PhysicalLightingModel, builder) {
    const context: unknown = builder.context;
    if (typeof context !== 'object' || context === null) throw new Error('Missing lighting context');
    seen.push({ context, irradiance: Reflect.get(context, 'iblIrradiance') });
    Reflect.apply(original, this, [builder]);
  });
  try {
    const standard = program(target.texture, 'standard');
    const authored = program(target.texture, 'ambient');
    for (const ordinary of seen.splice(0)) expect(Reflect.get(ordinary.context, 'iblIrradiance')).toBe(ordinary.irradiance);
    const toon = program(target.texture, 'toon');
    const replacement = seen.pop();
    if (replacement === undefined || typeof replacement.irradiance !== 'object' || replacement.irradiance === null) throw new Error('Missing replacement ambient');
    expect(replacement.irradiance).toMatchObject({ node: { value: new THREE.Vector3(0, 0, 0) } });
    expect(Reflect.get(replacement.context, 'iblIrradiance')).not.toBe(replacement.irradiance);
    // Both programs retain the real environment sampler: specular radiance survives.
    for (const shader of [standard, authored, toon]) expect(Object.values(shader.uniforms).some(u => u instanceof TextureNode && u.value === target.texture)).toBe(true);
  } finally { spy.mockRestore(); target.dispose(); }
});

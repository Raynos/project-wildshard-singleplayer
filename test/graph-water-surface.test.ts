import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { PhysicalLightingModel, TextureNode } from 'three/webgpu';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { WATER_LOOKS } from '../src/shards/pine-hollow/data/waterLook';
import { WATER_GRAPHS } from '../src/shards/pine-hollow/generators/waterGraphs';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** a lit graph's program under the engine's node handler, its scene lit by a PMREM-shaped environment */
function program(graph: GraphIr, attributes: Record<string, number> = {}): { shader: THREE.WebGLProgramParametersWithUniforms; environment: THREE.Texture } {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const target = new THREE.WebGLRenderTarget(768, 1024);
  target.texture.mapping = THREE.CubeUVReflectionMapping;
  const handler = new EngineNodesHandler(), compiled = compileGraph(graph, { trustedBudget: true });
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1);
  for (const [name, size] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: 4 * size }, () => 0.5), size));
  const object = new THREE.Mesh(geometry, compiled.material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.environment = target.texture;
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(compiled.material, object, parameters); return { shader: parameters, environment: target.texture }; }
  finally { geometry.dispose(); compiled.material.dispose(); }
}

test('an ambient that reads the environment owns the indirect term and a surface normal reaches the program', () => {
  const spy = vi.spyOn(PhysicalLightingModel.prototype, 'indirectSpecular');
  try {
    const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
      n: { op: 'normalize', in: [[0.1, 1, 0.2]] }, r: { op: 'radiance' }, e: { op: 'environmentIrradiance' }, i: { op: 'irradiance' },
      ambient: { op: 'add', in: ['r', 'e'] }, all: { op: 'add', in: ['ambient', 'i'] },
    }, stages: { surface: { colour: [0.5, 0.5, 0.5], normal: 'n' }, lighting: { sun: [0, 0, 0], sunSpecular: 1, ambient: 'all' } } };
    const { shader, environment } = program(graph);
    expect(spy).not.toHaveBeenCalled();
    expect(Object.values(shader.uniforms).some(u => u instanceof TextureNode && u.value === environment)).toBe(true);
    environment.dispose();
  } finally { spy.mockRestore(); }
  const unlit: unknown = { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1], normal: [0, 1, 0] } } };
  const refused = validateGraph(unlit);
  expect(refused.ok ? [] : refused.errors).toContain('stages.surface.normal: an unlit graph has no shading normal');
  const misplaced: unknown = { version: 1, kind: 'material', model: 'standard', nodes: { r: { op: 'radiance' } }, stages: { surface: { colour: 'r' } } };
  expect(validateGraph(misplaced).ok).toBe(false);
});

test("Pine's water graphs validate in their budget and build one lit, fogged, straight-alpha program", () => {
  for (const id of Object.values(WATER_LOOKS)) {
    const graph = WATER_GRAPHS[id];
    if (graph === undefined) throw new Error(`no water graph ${id}`);
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors).toEqual([]);
  }
  const pond = WATER_GRAPHS[WATER_LOOKS.pond];
  if (pond === undefined) throw new Error('no pond graph');
  const compiled = compileGraph(pond, { trustedBudget: true });
  try {
    expect(compiled.material.transparent).toBe(true);
    expect(compiled.material.depthWrite).toBe(false);
    compiled.setParam('rain', 0.7); compiled.setParam('topDown', 1); compiled.setParam('skyC', [10, -20, 3, 1]);
    // the skyline is sampled only in the lighting stage, which builds with the program: the lend waits for it
    const skyline = new THREE.DataTexture(new Uint8Array([10, 20, 30, 255]), 1, 1);
    expect(() => { compiled.setTexture('skyline', skyline); }).not.toThrow();
    skyline.dispose();
  } finally { compiled.material.dispose(); }
  const { shader, environment } = program(pond, { aWater: 4 });
  expect(shader.fragmentShader.length).toBeGreaterThan(0);
  environment.dispose();
});

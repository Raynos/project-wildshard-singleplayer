import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { TextureNode } from 'three/webgpu';
import { frontFacing } from 'three/tsl';
import { graph as authorGraph } from '../src/sdk/materials';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import paintedGraphs from '../src/shards/nalati-grasslands/data/painterlyGraphs.json' with { type: 'json' };
import scrollGraphs from '../src/shards/nine-dragon-stack/data/scrollGraph.json' with { type: 'json' };

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

test('explicit mip and gradient samples retain their live texture loan', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', effectState: { fog: false },
    params: { painting: { type: 'texture', value: 'painting', role: 'lent' } },
    nodes: { uv: { op: 'uv' }, dx: { op: 'dFdx', in: ['uv'] }, dy: { op: 'dFdy', in: ['uv'] },
      mip: { op: 'textureLod', param: 'painting', in: ['uv', 3.5] },
      grad: { op: 'textureGrad', param: 'painting', in: ['uv', 'dx', 'dy'] },
      mixed: { op: 'mix', in: ['mip', 'grad', .5] }, rgb: { op: 'swizzle', in: ['mixed'], mask: 'xyz' } },
    stages: { surface: { colour: 'rgb' } } };
  const compiled = compileGraph(graph), painting = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  try {
    const shader = program(compiled), version = compiled.material.version;
    expect(shader.fragmentShader).toContain('textureLod(');
    expect(shader.fragmentShader).toContain('textureGrad(');
    compiled.setTexture('painting', painting);
    const samplers = Object.entries(shader.uniforms).filter(([, uniform]) => uniform instanceof TextureNode && uniform.value === painting);
    expect(samplers.some(([name]) => shader.fragmentShader.includes(`textureLod( ${name},`))).toBe(true);
    expect(samplers.some(([name]) => shader.fragmentShader.includes(`textureGrad( ${name},`))).toBe(true);
    expect(compiled.material.version).toBe(version);
    expect(validateGraph({ ...graph, nodes: { ...graph.nodes, grad: { op: 'textureGrad', param: 'painting', in: ['uv', 1, 'dy'] } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); painting.dispose(); }
});

test('both painted sky users compile their declared sampling graphs', () => {
  for (const graph of [...Object.values(paintedGraphs), ...Object.values(scrollGraphs)]) {
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors).toEqual([]);
    if (!checked.ok) throw new Error('Painted graph refused');
    const compiled = compileGraph({ ...checked.graph, effectState: { ...checked.graph.effectState, fog: false } }, { trustedBudget: true });
    try {
      const shader = program(compiled);
      expect(shader.fragmentShader).not.toContain('undefined');
      expect(shader.fragmentShader.length).toBeGreaterThan(1000);
    } finally { compiled.material.dispose(); }
  }
});
function program(compiled: ReturnType<typeof compileGraph>): THREE.WebGLProgramParametersWithUniforms {
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
  const handler = new EngineNodesHandler(), material = compiled.material;
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
  finally { geometry.dispose(); sampled.dispose(); }
}


test('front-facing is fragment-only and admitted/lent textures sample both stages without losing retargeting', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', doubleSided: true,
    params: { cover: { type: 'texture', value: 'cover-slot', role: 'lent' }, albedo: { type: 'texture', value: 'albedo.ktx2', role: 'data' } },
    nodes: { uv: { op: 'uv' }, cover: { op: 'texture', param: 'cover', in: ['uv'] },
      paint: { op: 'texture', param: 'albedo', in: ['uv'] }, front: { op: 'frontFacing' },
      offset: { op: 'swizzle', mask: 'xyz', in: ['cover'] }, paintRgb: { op: 'swizzle', mask: 'xyz', in: ['paint'] },
      colour: { op: 'select', in: ['front', 'offset', 'paintRgb'] } },
    stages: { 'vertex.offset': { offset: 'offset' }, surface: { colour: 'colour' } } };
  const paint = new THREE.DataTexture(new Uint8Array([64, 128, 192, 255]), 1, 1), cover = new THREE.DataTexture(new Uint8Array([32, 64, 96, 255]), 1, 1);
  const compiled = compileGraph(graph, { textures: file => { expect(file).toBe('albedo.ktx2'); return paint; } });
  try {
    const checked = validateGraph(graph);
    expect(checked.ok).toBe(true);
    expect(checked.ok ? checked.cost.samplers : -1).toBe(2);
    const shader = program(compiled), version = compiled.material.version;
    expect(shader.vertexShader).toContain('textureLod(');
    expect(shader.fragmentShader).toContain('gl_FrontFacing');
    expect(shader.fragmentShader).toContain('texture(');
    compiled.setTexture('cover', cover);
    const coverSamplers = Object.entries(shader.uniforms).filter(([, u]) => u instanceof TextureNode && u.value === cover).map(([name]) => name);
    expect(coverSamplers.length).toBeGreaterThan(0);
    expect(coverSamplers.some(name => shader.vertexShader.includes(`textureLod( ${name},`))).toBe(true);
    expect(coverSamplers.some(name => shader.fragmentShader.includes(`texture( ${name},`))).toBe(true);
    expect(Object.values(shader.uniforms).some(u => u instanceof TextureNode && u.value === paint)).toBe(true);
    expect(compiled.material.version).toBe(version);
    expect(() => compiled.setTexture('albedo', cover)).toThrow();
    const bad = { ...graph, nodes: { ...graph.nodes, offset: { op: 'select', in: ['front', [0, 0, 0], [1, 1, 1]] } } };
    expect(validateGraph(bad).ok).toBe(false);
    expect(authorGraph({ model: 'unlit', doubleSided: true, surface: { discard: frontFacing } }).nodes).toMatchObject({ n0: { op: 'frontFacing' } });
  } finally { compiled.material.dispose(); paint.dispose(); cover.dispose(); }
});

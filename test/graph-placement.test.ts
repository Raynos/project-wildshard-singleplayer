import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UniformArrayNode } from 'three/webgpu';
import { GRAPH_ARRAY_MAX, validateGraph, type GraphIr } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
/** Compile the actual classic-renderer GLSL without a GPU/context. */
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
  const handler = new EngineNodesHandler(), material = compileGraph(graph, { textures: () => sampled }).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}


it('replaces the whole vertex with indexed uniform rows and keeps updates bounded', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    arrays: { islands: { type: 'vec3', value: [[1, 2, 3], [4, 5, 6]] } },
    nodes: { seed: { op: 'attribute', name: 'aSeed', type: 'float' }, row: { op: 'arrayElement', param: 'islands', in: ['seed'] } },
    stages: { 'vertex.position': { position: 'row' }, surface: { colour: [0.2, 0.5, 0.2] } },
  };
  const admitted = validateGraph(graph);
  if (!admitted.ok) throw new Error(admitted.errors.join('\n'));
  expect(admitted.graph.arrays?.['islands']?.value).toEqual(graph.arrays?.['islands']?.value);
  const compiled = compileGraph(graph), shader = program(graph);
  try {
    expect(shader.vertexShader).toContain('floor(');
    expect(shader.vertexShader).toContain('clamp(');
    const root = compiled.material.positionNode;
    if (root === null) throw new Error('Missing absolute position');
    const element: unknown = Reflect.get(root, 'node');
    if (typeof element !== 'object' || element === null) throw new Error('Missing indexed placement');
    const list: unknown = Reflect.get(element, 'node');
    if (!(list instanceof UniformArrayNode)) throw new Error('Placement did not read its uniform list');
    const values = [[7, 8, 9], [10, 11, 12]];
    compiled.setArrayParam('islands', values); values[0]?.fill(99);
    const row: unknown = list.array[0];
    expect(row).toBeInstanceOf(THREE.Vector3);
    if (!(row instanceof THREE.Vector3)) throw new Error('Expected vec3 storage');
    expect(row.x).toBe(7);
    const previous = list.array;
    expect(() => compiled.setArrayParam('islands', [[1, 2, 3]])).toThrow('fixed capacity');
    expect(() => compiled.setArrayParam('islands', [[1, 2], [3, 4]])).toThrow('finite vec3');
    expect(() => compiled.setArrayParam('islands', [[Number.NaN, 0, 0], [0, 0, 0]])).toThrow('finite vec3');
    expect(list.array).toBe(previous);
    expect(validateGraph({ ...graph, stages: { ...graph.stages, 'vertex.offset': { offset: [1, 0, 0] } } }).ok).toBe(false);
    expect(validateGraph({ ...graph, kind: 'post', stages: { 'vertex.position': { position: 'row' }, post: { colour: [1, 1, 1] } } }).ok).toBe(false);
    expect(validateGraph({ ...graph, arrays: { islands: { type: 'vec3', value: Array.from({ length: GRAPH_ARRAY_MAX + 1 }, () => [0, 0, 0]) } } }).ok).toBe(false);
    expect(validateGraph({ ...graph, arrays: { islands: { type: 'vec3', value: [[0, Infinity, 0]] } } }).ok).toBe(false);
    expect(validateGraph({ ...graph, arrays: { a: { type: 'float', value: Array.from({ length: 64 }, () => 0) }, b: { type: 'float', value: Array.from({ length: 64 }, () => 0) }, islands: { type: 'vec3', value: [[0, 0, 0]] } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); }
});


it('places independently sized camera-relative cards through the actual vertex compiler', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { distance: { type: 'float', value: 100 }, size: { type: 'vec2', value: [3, 8] } },
    nodes: { direction: { op: 'attribute', name: 'aDirection', type: 'vec3' }, distance: { op: 'param', param: 'distance' },
      vertex: { op: 'positionGeometry' }, xy: { op: 'swizzle', in: ['vertex'], mask: 'xy' },
      size: { op: 'param', param: 'size' }, local: { op: 'mul', in: ['xy', 'size'] },
      card: { op: 'cameraRelativeBillboard', in: ['direction', 'distance', 'local'] } },
    stages: { 'vertex.position': { position: 'card' }, surface: { colour: [1, 0.8, 0.5] } },
  };
  const compiled = compileGraph(graph);
  try {
    compiled.setParam('distance', 250); compiled.setParam('size', [5, 12]);
    const shader = program(graph);
    expect(shader.vertexShader).toContain('cameraPosition');
    expect(shader.vertexShader).toMatch(/positionLocal\s*=\s*\(\s*nodeUniform\d+\s*\*\s*vec4/u);
    expect(shader.vertexShader).toContain('cross(');
    expect(shader.vertexShader).toContain('aDirection');
    expect(shader.vertexShader).toMatch(/if\s*\(/u);
    const pole = { ...graph, nodes: { ...graph.nodes, direction: { op: 'const', value: [0, 1, 0] } } };
    expect(program(pole).vertexShader).toContain('cross(');
    expect(program({ ...pole, nodes: { ...pole.nodes, direction: { op: 'const', value: [0, 0, 0] } } }).vertexShader).toContain('cross(');
    expect(validateGraph({ ...graph, stages: { surface: { colour: 'card' } } }).ok).toBe(false);
    expect(validateGraph({ ...graph, nodes: { ...graph.nodes, distance: { op: 'const', value: [1, 2] } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); }
});

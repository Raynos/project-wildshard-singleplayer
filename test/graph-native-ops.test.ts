import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { GERSTNER_TERMS, WAVES, waveDisplace } from '../src/engine/world/waves';
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


test('fragment derivatives build a faceted normal and refuse vertex use', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {
    point: { op: 'positionWorld' }, dx: { op: 'dFdx', in: ['point'] }, dy: { op: 'dFdy', in: ['point'] },
    face: { op: 'cross', in: ['dx', 'dy'] }, normal: { op: 'normalize', in: ['face'] },
  }, stages: { surface: { colour: 'normal' } } };
  const shader = program(graph);
  expect(shader.fragmentShader).toContain('dFdx(');
  expect(shader.fragmentShader).toContain('dFdy(');
  expect(shader.fragmentShader).toContain('cross(');
  expect(validateGraph({ ...graph, stages: { 'vertex.offset': { offset: 'normal' } } }).ok).toBe(false);
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, face: { op: 'cross', in: [[1, 2], [3, 4]] } } }).ok).toBe(false);
});

test('Gerstner graph displacement shares the CPU wave model and builds real vertex GLSL', () => {
  for (const [x, z, time, damp] of [[0, 0, 0, 1], [12, -9, 3.2, 0.6], [-40, 51, 19, 0]]) {
    if (x === undefined || z === undefined || time === undefined || damp === undefined) throw new Error('Missing sample');
    const expected = { x: 0, y: 0, z: 0 };
    for (const [wx, wz, amplitude, length, speed, q] of WAVES) {
      const k = Math.PI * 2 / length, phase = k * (wx * x + wz * z - speed * time);
      const qa = (q / (k * amplitude * WAVES.length)) * amplitude;
      expected.x += wx * qa * Math.cos(phase); expected.y += amplitude * Math.sin(phase); expected.z += wz * qa * Math.cos(phase);
    }
    expected.x *= damp; expected.y *= damp; expected.z *= damp;
    expect(waveDisplace(x, z, time, damp, { x: 0, y: 0, z: 0 })).toEqual(expected);
  }
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {
    rest: { op: 'swizzle', in: ['point'], mask: 'xz' }, point: { op: 'positionLocal' },
    waves: { op: 'gerstner', in: ['rest', 3.2, 0.6] },
  }, stages: { 'vertex.offset': { offset: 'waves' }, surface: { colour: [0.1, 0.2, 0.3] } } };
  const shader = program(graph);
  expect(shader.vertexShader).toContain('sin('); expect(shader.vertexShader).toContain('cos(');
  expect(GERSTNER_TERMS).toHaveLength(WAVES.length);
  const valid = validateGraph(graph);
  if (!valid.ok) throw new Error(valid.errors.join('; '));
  expect(valid.cost.instructions).toBeGreaterThanOrEqual(120);
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, waves: { op: 'gerstner', in: ['point', 3.2, 0.6] } } }).ok).toBe(false);
});

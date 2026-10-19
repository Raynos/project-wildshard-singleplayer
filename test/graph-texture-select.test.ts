import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GraphIr } from '../src/format/materialGraph';
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


it('keeps costly texture arms outside divergent shader branches', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { mapA: { type: 'texture', value: 'a'.repeat(64) }, mapB: { type: 'texture', value: 'b'.repeat(64) } },
    nodes: { uv: { op: 'uv' }, condition: { op: 'lt', in: [0.2, 0.5] },
      a: { op: 'texture', param: 'mapA', in: ['uv'] }, b: { op: 'texture', param: 'mapB', in: ['uv'] },
      rgbA: { op: 'swizzle', in: ['a'], mask: 'xyz' }, rgbB: { op: 'swizzle', in: ['b'], mask: 'xyz' },
      costlyA: { op: 'pow', in: ['rgbA', 2] }, costlyB: { op: 'pow', in: ['rgbB', 3] },
      colour: { op: 'select', in: ['condition', 'costlyA', 'costlyB'] } },
    stages: { surface: { colour: 'colour' } },
  };
  const sampled = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const compiled = compileGraph(graph, { textures: () => sampled });
  try {
    expect(compiled.selects.branch).toBe(0);
    expect(compiled.selects.light).toBeGreaterThan(0);
    const shader = program(graph).fragmentShader;
    expect(shader).toContain('mix(');
    expect(shader).toContain('texture(');
    expect(shader).toMatch(/mix\([^;]*pow/u);
    const booleanArms: GraphIr = { ...graph, nodes: { ...graph.nodes,
      scalarA: { op: 'swizzle', in: ['costlyA'], mask: 'x' }, scalarB: { op: 'swizzle', in: ['costlyB'], mask: 'x' },
      testA: { op: 'lt', in: ['scalarA', 0.5] }, testB: { op: 'lt', in: ['scalarB', 0.5] },
      chosen: { op: 'select', in: ['condition', 'testA', 'testB'] },
      colour: { op: 'select', in: ['chosen', [0.2, 0.5, 0.2], [0.5, 0.2, 0.2]] } } };
    const booleanCompiled = compileGraph(booleanArms, { textures: () => sampled });
    try { expect(booleanCompiled.selects.branch).toBe(0); expect(program(booleanArms).fragmentShader).toContain('bool('); }
    finally { booleanCompiled.material.dispose(); }

  } finally { compiled.material.dispose(); sampled.dispose(); }
});

it('branches around rejected arithmetic inside a bounded loop', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { limit: { type: 'float', value: 2 } },
    nodes: { limit: { op: 'param', param: 'limit' },
      fog: { op: 'loop', count: 8, in: [[0, 0, 0]], body: { nodes: {
        i: { op: 'index' }, acc: { op: 'acc' }, condition: { op: 'lt', in: ['i', 'limit'] },
        p: { op: 'combine', in: ['i', 'i'] }, noise: { op: 'noise', in: ['p'] },
        colour: { op: 'mul', in: ['noise', [1, 1, 1]] },
        contribution: { op: 'add', in: ['acc', 'colour'] },
        chosen: { op: 'select', in: ['condition', 'contribution', 'acc'] },
      }, out: 'chosen' } } }, stages: { surface: { colour: 'fog' } } };
  const shader = program(graph).fragmentShader;
  expect(shader).toMatch(/for\s*\([^]*if\s*\(/u);
  expect(shader).toMatch(/if\s*\([^]*noise_float/u);
});

it('computes a reused branch result before its separate consumers', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { a: { type: 'float', value: 0.4 }, b: { type: 'float', value: 0.6 } },
    nodes: { a: { op: 'param', param: 'a' }, b: { op: 'param', param: 'b' },
      ca: { op: 'lt', in: ['a', 0.5] }, cb: { op: 'lt', in: ['b', 0.5] },
      uv: { op: 'uv' }, seed: { op: 'noise', in: ['uv'] },
      shared: { op: 'select', in: ['ca', 'seed', 0] },
      uvA: { op: 'add', in: ['uv', [0.2, 0.3]] }, uvB: { op: 'add', in: ['uv', [0.7, 0.8]] },
      na: { op: 'noise', in: ['uvA'] }, nb: { op: 'noise', in: ['uvB'] },
      va: { op: 'add', in: ['shared', 'na'] }, vb: { op: 'add', in: ['shared', 'nb'] },
      first: { op: 'select', in: ['ca', 'va', 0] }, second: { op: 'select', in: ['cb', 'vb', 0] },
      sum: { op: 'add', in: ['first', 'second'] }, colour: { op: 'mul', in: ['sum', [1, 1, 1]] },
    }, stages: { surface: { colour: 'colour' } } };
  const shader = program(graph).fragmentShader.split('void main()')[1] ?? '';
  expect(shader.match(/mx_perlin_noise_float_\d+\(/gu)).toHaveLength(3);
});

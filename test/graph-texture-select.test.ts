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

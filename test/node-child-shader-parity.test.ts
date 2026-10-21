import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import * as childTraversal from '../src/engine/render/nodes/nodeChildren';
import { ToonLook } from '../src/engine/render/families/toon';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function compile(model: 'unlit' | 'standard' | 'toon', instanced: boolean, snapshots: boolean) {
  const graph: GraphIr = { version: 1, kind: 'material', model,
    params: { bend: { type: 'float', value: 0.25 }, colour: { type: 'vec3', value: [0.2, 0.4, 0.6] } },
    nodes: { bend: { op: 'param', param: 'bend' }, colour: { op: 'param', param: 'colour' },
      wave: { op: 'sin', in: ['bend'] }, offset: { op: 'combine', in: [0, 'wave', 0] } },
    stages: { 'vertex.offset': { offset: 'offset', shadow: true }, surface: { colour: 'colour', roughness: 0.3 } } };
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const toon = new ToonLook({ faceEdge: [0.15, 0.3], shadowEdge: [0.6, 0.85] });
  const material = compileGraph(graph, { toon }).material, geometry = new THREE.PlaneGeometry();
  const object = instanced ? new THREE.InstancedMesh(geometry, material, 2) : new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), light = new THREE.DirectionalLight();
  scene.add(object, light);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer); handler.renderStart(scene, camera); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.setObject(object, material);
    const build = (): void => { handler.build(material, object, parameters); };
    const stock = snapshots ? undefined : vi.spyOn(childTraversal, 'withNodeChildSnapshots').mockImplementationOnce(work => { work(); });
    let ms: number;
    try { const start = performance.now(); build(); ms = performance.now() - start; }
    finally { stock?.mockRestore(); }
    return { vertex: parameters.vertexShader, fragment: parameters.fragmentShader, uniforms: Object.keys(parameters.uniforms), ms };
  } finally { handler.renderEnd(); geometry.dispose(); material.dispose(); }
}

for (const model of ['unlit', 'standard', 'toon'] as const) for (const instanced of [false, true]) {
  test(`${model} ${instanced ? 'instances' : 'mesh'} builds identical shaders and uniform declarations`, () => {
    // First use initializes shared camera nodes and can reorder stock uniform blocks.
    // Warm those globals before comparing independently built materials.
    compile(model, instanced, false);
    const before = compile(model, instanced, false), after = compile(model, instanced, true);
    expect(after.vertex).toBe(before.vertex); expect(after.fragment).toBe(before.fragment); expect(after.uniforms).toEqual(before.uniforms);
  });
}

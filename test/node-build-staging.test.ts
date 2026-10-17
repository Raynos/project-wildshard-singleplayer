import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

const GRAPH: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {},
  stages: { surface: { colour: [0.2, 0.3, 0.4], roughness: 0.4, occlusion: 0.8 } } };
const WARM: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0, 0] } } };

function stubRenderer(): THREE.WebGLRenderer {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  return renderer;
}

function parametersFor(material: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const parameters: object = { shaderID: undefined, isRawShaderMaterial: false, customProgramCacheKey: material.customProgramCacheKey(), instancing: false, skinning: false, fog: false };
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  return parameters;
}

/** the renderer's compile of `object` into `scene`: one render call, its lights, then the build of each node material */
function compileBuild(handler: EngineNodesHandler, scene: THREE.Scene, camera: THREE.Camera, object: THREE.Mesh): THREE.WebGLProgramParametersWithUniforms {
  handler.renderStart(object, camera, scene); handler.updateLights([]);
  try {
    if (!(object.material instanceof THREE.Material)) throw new Error('Missing material');
    handler.setObject(object, object.material);
    const parameters = parametersFor(object.material);
    handler.build(object.material, object, parameters);
    return parameters;
  } finally { handler.renderEnd(); }
}

function uniformNames(parameters: THREE.WebGLProgramParametersWithUniforms): string[] { return Object.keys(parameters.uniforms).sort(); }

test('a staged node build makes the same program as the synchronous build, in several steps', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), geometry = new THREE.PlaneGeometry(1, 1);
  const sync = new EngineNodesHandler(); sync.setRenderer(stubRenderer());
  const staged = new EngineNodesHandler(); staged.setRenderer(stubRenderer());
  const a = compileGraph(GRAPH), b = compileGraph(GRAPH), warm = compileGraph(WARM);
  try {
    const expected = compileBuild(sync, scene, camera, new THREE.Mesh(geometry, a.material));
    // the staged handler's first build is synchronous: it learns three's builder class from it
    compileBuild(staged, scene, camera, new THREE.Mesh(geometry, warm.material));
    const mesh = new THREE.Mesh(geometry, b.material);
    const step = staged.stageCompile(mesh, camera, scene, () => () => undefined);
    let steps = 0;
    while (step()) steps++;
    expect(steps).toBeGreaterThan(3);
    const msBefore = staged.buildMs;
    const got = compileBuild(staged, scene, camera, mesh);
    expect(staged.staging.used).toBe(1);
    expect(staged.staging.dropped).toBe(0);
    expect(got.vertexShader).toBe(expected.vertexShader);
    expect(got.fragmentShader).toBe(expected.fragmentShader);
    expect(uniformNames(got)).toEqual(uniformNames(expected));
    // the compile's own part is the tail only
    expect(staged.buildMs - msBefore).toBeLessThan(staged.staging.ms);
  } finally { geometry.dispose(); a.material.dispose(); b.material.dispose(); warm.material.dispose(); }
});

test('a staged build whose render state changed is rebuilt synchronously', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), geometry = new THREE.PlaneGeometry(1, 1);
  const handler = new EngineNodesHandler(); handler.setRenderer(stubRenderer());
  const warm = compileGraph(WARM), b = compileGraph(GRAPH);
  try {
    compileBuild(handler, scene, camera, new THREE.Mesh(geometry, warm.material));
    const mesh = new THREE.Mesh(geometry, b.material);
    const step = handler.stageCompile(mesh, camera, scene, () => () => undefined);
    while (step()) { /* stage it all */ }
    b.material.needsUpdate = true; // the material's version moves: the staged build no longer matches
    compileBuild(handler, scene, camera, mesh);
    expect(handler.staging.used).toBe(0);
    expect(handler.staging.dropped).toBe(1);
  } finally { geometry.dispose(); b.material.dispose(); warm.material.dispose(); }
});

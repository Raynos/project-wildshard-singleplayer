import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { materialNodeFogOf } from '../src/engine/render/fogPatches';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, fog: THREE.Fog, compiled?: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
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
  const handler = new EngineNodesHandler(), material = compiled ?? compileGraph(graph, { textures: () => sampled }).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = fog; scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}


// a shard's declared fog (O11): its colour × 0.5 + the engine's half, with a marker param
const FOG: GraphIr = { version: 1, kind: 'fog', params: { mark: { type: 'float', value: 0.4375 } },
  nodes: { i: { op: 'fogInput' }, e: { op: 'engineFogged' }, s: { op: 'fogScale' }, p: { op: 'positionWorld' }, c: { op: 'cameraPosition' },
    d: { op: 'length', in: ['p'] }, m: { op: 'param', param: 'mark' }, k: { op: 'mul', in: ['m', 's'] }, mx: { op: 'mix', in: ['i', 'e', 'k'] }, o: { op: 'add', in: ['mx', 'd'] } },
  stages: { fog: { colour: 'o' } } };
const SURFACE: GraphIr = { version: 1, kind: 'material', model: 'unlit', effectState: { fog: 'shard-fog' },
  nodes: { c: { op: 'const', value: [0.2, 0.3, 0.4] } }, stages: { surface: { colour: 'c' } } };

test('a material selecting a declared fog graph is fogged by it in the epilogue, sharing its params', () => {
  const fog = compileGraph(FOG);
  expect(fog.fog).not.toBeNull();
  expect(fog.material.visible).toBe(false);
  const patch = fog.fog;
  if (patch === null) throw new Error('fog graph without a patch');
  const asked: string[] = [];
  const material = compileGraph(SURFACE, { fog: (id) => { asked.push(id); return patch; } });
  expect(asked).toEqual(['shard-fog']);
  expect(material.material.fog).toBe(true);
  expect(materialNodeFogOf(material.material)?.node).toBe(patch);
  const shader = program(SURFACE, new THREE.Fog(0x123456, 1, 100), material.material);
  const mark = Object.values(shader.uniforms).find(value => value.value === 0.4375);
  if (mark === undefined) throw new Error('the fog graph param did not reach the selecting program');
  fog.setParam('mark', 0.25);
  expect(mark.value).toBe(0.25);
  expect(() => compileGraph(SURFACE)).toThrow(/fog resolver/u);
});

test('fog graphs validate apart: fog inputs only in a fog stage, a fog stage only in a fog graph, a selection by id', () => {
  expect(validateGraph(FOG).ok).toBe(true);
  expect(validateGraph(SURFACE).ok).toBe(true);
  const misplaced = validateGraph({ ...SURFACE, nodes: { c: { op: 'fogInput' } } });
  expect(misplaced.ok).toBe(false);
  expect(validateGraph({ ...SURFACE, stages: { surface: { colour: 'c' }, fog: { colour: 'c' } } }).ok).toBe(false);
  expect(validateGraph({ ...FOG, model: 'unlit' }).ok).toBe(false);
  expect(validateGraph({ ...SURFACE, effectState: { fog: 'Not An Id' } }).ok).toBe(false);
  expect(validateGraph({ ...SURFACE, effectState: { fog: true } }).ok).toBe(false);
});

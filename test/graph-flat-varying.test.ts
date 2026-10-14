import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { attribute, varying } from 'three/tsl';
import { graph as authorGraph } from '../src/sdk/materials';
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
  const handler = new EngineNodesHandler(), compiled = compileGraph(graph, { textures: () => sampled });
  const material = compiled.material.clone(); compiled.material.dispose();
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
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}


test('flat varyings preserve the provoking-vertex qualifier through validation, SDK authoring and both shaders', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {
    tint: { op: 'attribute', name: 'aDirection', type: 'vec3' },
    facet: { op: 'varying', in: ['tint'], interpolation: 'flat' },
  }, stages: { surface: { colour: 'facet' } } };
  const checked = validateGraph(graph);
  expect(checked.ok).toBe(true);
  expect(checked.ok ? checked.graph.nodes['facet']?.interpolation : null).toBe('flat');
  const shader = program(graph);
  const name = /flat\s+out\s+vec3\s+(\w+)/u.exec(shader.vertexShader)?.[1];
  expect(name).toBeDefined();
  expect(shader.fragmentShader).toMatch(new RegExp(`flat\\s+in\\s+vec3\\s+${String(name)}`,'u'));
  const smooth = program({ ...graph, nodes: { ...graph.nodes, facet: { op: 'varying', in: ['tint'] } } });
  expect(smooth.vertexShader).not.toContain('flat ');
  const authored = authorGraph({ model: 'unlit', surface: { colour: varying(attribute('aDirection', 'vec3')).setInterpolation('flat') } });
  expect(Object.values(authored.nodes).some(n => n.op === 'varying' && n.interpolation === 'flat')).toBe(true);
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, facet: { ...graph.nodes['facet'], interpolation: 'linear' } } }).ok).toBe(false);
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, tint: { ...graph.nodes['tint'], interpolation: 'flat' } } }).ok).toBe(false);
  expect(() => authorGraph({ surface: { colour: varying(attribute('aDirection', 'vec3')).setInterpolation('linear') } })).toThrow('interpolation');
});

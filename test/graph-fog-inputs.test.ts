import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { materialNodeFogOf, type NodeFogPatch } from '../src/engine/render/fogPatches';
import { noLookChunks, scopeLookChunks } from '../src/engine/render/regionLook';
import { fogUniforms } from '../src/engine/world/Atmosphere';
import { graph as authorGraph, graphInputs } from '../src/sdk/materials';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, fog: THREE.Fog, region?: NodeFogPatch): THREE.WebGLProgramParametersWithUniforms {
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
  scene.fog = fog; scene.add(object);
  const scope = new Scope('fog-region');
  if (region !== undefined) {
    const root = new THREE.Group(); root.position.set(40, 0, 60); root.add(object); scene.add(root);
    const scoped = scopeLookChunks(root, noLookChunks('fog-region'), scope, {}, { fog: { order: 300, install: () => { throw new Error('Sweep must not repeat the classic install'); }, node: region } });
    expect(scoped.sweep()).toBe(1);
    expect(materialNodeFogOf(material)?.node).toBe(region);
  } handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { scope.dispose(); expect(materialNodeFogOf(material)).toBeUndefined(); geometry.dispose(); material.dispose(); sampled.dispose(); }
}

test('atmosphere and ramp graph inputs borrow the live day owners and define a no-ramp default', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {
    dir: { op: 'atmosphereSunDirection' }, sun: { op: 'atmosphereSunColour' }, zenith: { op: 'fogZenithColour' },
    sky: { op: 'add', in: ['sun', 'zenith'] }, colour: { op: 'add', in: ['sky', 'dir'] },
  }, stages: { surface: { colour: 'colour' } } };
  const fog = new THREE.Fog(0x334455, 1, 100), zenith = { value: new THREE.Color(0.2, 0.3, 0.5) };
  const ramp: NodeFogPatch = { colourRamp: { start: { value: 1 }, end: { value: 100 }, near: { value: fog.color }, zenith } };
  const shader = program(ir, fog, ramp);
  const holds = (value: unknown): boolean => Object.values(shader.uniforms).some(u => u.value === value);
  expect(holds(fogUniforms.fogSunDir.value)).toBe(true); expect(holds(fogUniforms.fogSunColor.value)).toBe(true); expect(holds(zenith.value)).toBe(true);
  zenith.value.setRGB(0.4, 0.2, 0.1); expect(holds(zenith.value)).toBe(true);
  const fallback = program(ir, fog);
  expect(Object.values(fallback.uniforms).some(u => u.value === fog.color)).toBe(true);
  const authored = authorGraph({ model: 'unlit', surface: { colour: graphInputs.atmosphereSunColour.add(graphInputs.atmosphereSunDirection).add(graphInputs.fogZenithColour).add(graphInputs.fogColour) } });
  expect(Object.values(authored.nodes).map(n => n.op)).toEqual(expect.arrayContaining(['atmosphereSunColour', 'atmosphereSunDirection', 'fogZenithColour', 'fogColour']));
});

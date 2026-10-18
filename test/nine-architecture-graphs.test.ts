import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { architectureGraphs } from '../src/shards/nine-dragon-stack/generators/architectureGraphs';
import fog from '../src/shards/nine-dragon-stack/data/lookGraphs.json' with { type: 'json' };

import { lendLooks } from '../src/game/shardfile/lentLooks';
import { facadeUniforms, syncArchitecture } from '../src/shards/nine-dragon-stack/look/facadeMaterial';
import type { Shared } from '../src/shards/nine-dragon-stack/look/style';


vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function renderer(): THREE.WebGLRenderer {
  const result: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(result instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    getDrawingBufferSize: (target: THREE.Vector2) => target.set(400, 800), getViewport: (target: THREE.Vector4) => target.set(0, 0, 400, 800),
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(result, key, value);
  return result;
}

function build(graph: GraphIr, instanced: boolean): { vertex: string; fragment: string } {
  const fogGraph = compileGraph(fog['nine-silk-fog'], { trustedBudget: true });
  const compiled = compileGraph(graph, { trustedBudget: true, fog: () => { if (fogGraph.fog === null) throw new Error('Missing silk fog'); return fogGraph.fog; } });
  const geometry = new THREE.PlaneGeometry(1, 1);
  for (const [name, count] of Object.entries({ aFace: 4, aPat: 4, aMisc: 4, aOff: 2, aSpill: 3, aTan: 3, aWin: 4, aWall: 3 })) geometry.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * count), count));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  const mesh = instanced ? new THREE.InstancedMesh(geometry, compiled.material, 2) : new THREE.Mesh(geometry, compiled.material);
  if (mesh instanceof THREE.InstancedMesh) { mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(2, 3, 1)); mesh.setColorAt(0, new THREE.Color(1, 0.5, 0.2)); }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), handler = new EngineNodesHandler();
  scene.fog = new THREE.Fog(0x8899aa, 5, 300); scene.add(mesh); handler.setRenderer(renderer()); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.build(compiled.material, mesh, parameters);
    return { vertex: parameters.vertexShader, fragment: parameters.fragmentShader };
  } finally { handler.renderEnd(); geometry.dispose(); compiled.material.dispose(); fogGraph.material.dispose(); }
}

const graphs = architectureGraphs();
test('each existing material fits both caps and compiles its real instance channels', () => {
  for (const [id, graph] of Object.entries(graphs)) {
    expect(validateGraph(graph, { trustedBudget: true }).ok, id).toBe(true);
    expect(Object.keys(graph.nodes).length, id).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(JSON.stringify(graph)).length, id).toBeLessThanOrEqual(64000);
    const shaders = build(graph, true);
    expect(shaders.vertex, id).toContain('instanceMatrix');
    expect(shaders.vertex, id).toContain('instanceColor');
    expect(shaders.fragment, id).toContain('sampler3D');
    expect(shaders.fragment, id).not.toContain('NaN');
    expect(shaders.fragment, id).not.toContain('sRGBTransferOETF');
    if (id === 'nine-architecture-cut') expect(shaders.fragment).toContain('discard');
  }
});

test('the merged shell also compiles without instance attributes', () => {
  const graph = graphs['nine-facade'];
  if (graph === undefined) throw new Error('Missing facade graph');
  const shaders = build(graph, false);
  expect(shaders.vertex).not.toContain('instanceMatrix');
  expect(shaders.vertex).not.toContain('instanceColor');
});

test('volume sampling refuses wrong coordinates, dimensions and lent textures', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', params: { volume: { type: 'texture', role: 'lent', value: 'volume' } }, nodes: { sample: { op: 'texture3D', in: [[0.5, 0.5, 0.5]], param: 'volume' }, colour: { op: 'swizzle', in: ['sample'], mask: 'xyz' } }, stages: { surface: { colour: 'colour' } } };
  const compiled = compileGraph(graph), volume = new THREE.Data3DTexture(new Uint8Array([1, 2, 3, 255]), 1, 1, 1);
  expect(() => compiled.setTexture('volume', volume)).not.toThrow();
  expect(() => compiled.setTexture('volume', new THREE.Texture())).toThrow('3D texture');
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, sample: { op: 'texture3D', in: [[0.5, 0.5]], param: 'volume' } } }).ok).toBe(false);
  expect(validateGraph({ ...graph, nodes: { ...graph.nodes, two: { op: 'texture', in: [[0.5, 0.5]], param: 'volume' }, sum: { op: 'add', in: ['sample', 'two'] }, colour: { op: 'swizzle', in: ['sum'], mask: 'xyz' } } }).ok).toBe(false);
  volume.dispose(); compiled.material.dispose();
});


test('existing uniform handles feed initial colours, texture swaps and Explorer tuning', () => {
  const materials = new Map(Object.entries(graphs).map(([id]) => [id, new THREE.MeshBasicMaterial()]));
  const writes = new Map<string, number | readonly number[]>(), textures = new Map<string, THREE.Texture>(), cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials, bindMeshMap: () => new THREE.MeshBasicMaterial(),
    setParam: (id, name, value) => { writes.set(`${id}:${name}`, typeof value === 'number' ? value : [...value]); },
    setTexture: (id, name, texture) => { textures.set(`${id}:${name}`, texture); } });
  const volume = new THREE.Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1), replacement = volume.clone();
  const shared = { u: { uLinePx: { value: 2.1 }, uShade: { value: new THREE.Color(0.5, 0.6, 0.7) }, uLpVolA: { value: volume } } } as Shared;
  try {
    const catalogue = Object.fromEntries(Object.entries(graphs).map(([id, graph]) => [id, { family: 'graph' as const, graph }]));
    syncArchitecture(facadeUniforms(shared), catalogue);
    expect(writes.get('nine-facade:uFacadeWash')).toEqual(new THREE.Color(0xe0e3ef).toArray());
    expect(writes.get('nine-windows:uSky')).toEqual(new THREE.Color(0xbcc4d2).toArray());
    shared.u.uShade.value.setRGB(0.8, 0.9, 1); shared.u.uLinePx.value = 3; shared.u.uLpVolA.value = replacement;
    syncArchitecture(shared.u, catalogue);
    expect(writes.get('nine-architecture:uShade')).toEqual([0.8, 0.9, 1]);
    expect(writes.get('nine-facade:uLinePx')).toBe(3);
    expect(textures.get('nine-architecture:uLpVolA')).toBe(replacement);
  } finally { for (const cleanup of cleanups) cleanup(); for (const material of materials.values()) material.dispose(); volume.dispose(); replacement.dispose(); }
});

import { graphFileRules } from '../src/format/materials';
import product from '../src/shards/nine-dragon-stack/generators/product';
import { heldGraphFiles } from '../src/shards/nine-dragon-stack/generators/heldGraphFiles';
import { postRows } from '../src/shards/nine-dragon-stack/generators/postGraphs';
import { haloGraph } from '../src/shards/nine-dragon-stack/generators/haloGraph';
import { ScaledPostPass, prepareScaledPost } from '../src/game/looks/scaledPost';
import { postGraphLookOf } from '../src/game/looks/postGraphLook';
import { uniformsFrom } from '../src/game/plugin/shaderFamily';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { App } from '../src/engine/app/app';
import type { ScaledPostRow } from '../src/format/scaledPost';
import { postChainRows } from '../src/shards/nalati-grasslands/generators/postChain';
import { EffectComposer } from 'postprocessing';
import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { viewmodelGraphs } from '../src/shards/nine-dragon-stack/generators/viewmodelGraphs';
import { architectureGraphs } from '../src/shards/nine-dragon-stack/generators/architectureGraphs';
import fog from '../src/shards/nine-dragon-stack/data/lookGraphs.json' with { type: 'json' };

import { lendLooks, lendUniforms as lendGrade } from '../src/game/shardfile/lentLooks';
import { facadeUniforms, syncLooks } from '../src/shards/nine-dragon-stack/look/facadeMaterial';
import type { Shared } from '../src/shards/nine-dragon-stack/look/style';


vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function renderer(): THREE.WebGLRenderer {
  const result: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(result instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    setNodesHandler: () => undefined, getDrawingBufferSize: (target: THREE.Vector2) => target.set(400, 800), getViewport: (target: THREE.Vector4) => target.set(0, 0, 400, 800),
    extensions: { has: () => false, get: () => null }, getContext: () => ({ getParameter: () => 65536 }), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(result, key, value);
  return result;
}

function build(graph: GraphIr, instanced: boolean, skinned = false): { vertex: string; fragment: string } {
  const fogGraph = compileGraph(fog['nine-silk-fog'], { trustedBudget: true });
  const compiled = compileGraph(graph, { trustedBudget: true, fog: () => { if (fogGraph.fog === null) throw new Error('Missing silk fog'); return fogGraph.fog; } });
  const geometry = new THREE.PlaneGeometry(1, 1);
  for (const [name, count] of Object.entries({ aFace: 4, aPat: 4, aMisc: 4, aOff: 2, aSpill: 3, aTan: 3, aWin: 4, aWall: 3, aMat: 4, aNs: 3, aHullN: 3, aCloth: 4, aAge: 1, aUv: 2, aSide: 2, aOut: 1 })) geometry.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * count), count));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  if (skinned) {
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(geometry.getAttribute('position').count * 4), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: geometry.getAttribute('position').count * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  }
  const mesh = skinned ? new THREE.SkinnedMesh(geometry, compiled.material) : instanced ? new THREE.InstancedMesh(geometry, compiled.material, 2) : new THREE.Mesh(geometry, compiled.material);
  if (mesh instanceof THREE.SkinnedMesh) { const bone = new THREE.Bone(); mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); }
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
test('held material files declare their admitted texture dependencies', () => {
  expect(graphFileRules(product, hash => heldGraphFiles.assets.get(hash))).toEqual([]);
});
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
    const catalogue = Object.fromEntries(Object.entries({ ...graphs, 'nine-halo': haloGraph() }).map(([id, graph]) => [id, { family: 'graph' as const, graph }]));
    syncLooks(facadeUniforms(shared), {}, catalogue);
    expect(writes.get('nine-facade:uFacadeWash')).toEqual(new THREE.Color(0xe0e3ef).toArray());
    expect(writes.get('nine-windows:uSky')).toEqual(new THREE.Color(0xbcc4d2).toArray());
    shared.u.uShade.value.setRGB(0.8, 0.9, 1); shared.u.uLinePx.value = 3; shared.u.uLpVolA.value = replacement;
    syncLooks(shared.u, {}, catalogue);
    expect(writes.get('nine-architecture:uShade')).toEqual([0.8, 0.9, 1]);
    expect(writes.get('nine-facade:uLinePx')).toBe(3);
    expect(textures.get('nine-architecture:uLpVolA')).toBe(replacement);
  } finally { for (const cleanup of cleanups) cleanup(); for (const material of materials.values()) material.dispose(); volume.dispose(); replacement.dispose(); }
});


test('held toon and hull graphs compile rigid and skinned without adding draws', () => {
  for (const [id, graph] of Object.entries(viewmodelGraphs())) {
    expect(Object.keys(graph.nodes).length, id).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(JSON.stringify(graph)).length, id).toBeLessThanOrEqual(64000);
    expect(graph.stages.outline, id).toBeUndefined();
    for (const skinned of [false, true]) {
      let shader: ReturnType<typeof build>;
      try { shader = build(graph, false, skinned); } catch (cause) { throw new Error(`${id} skinned=${skinned}`, { cause }); }
      expect(shader.fragment, id).not.toContain('sRGBTransferOETF');
      expect(shader.vertex.includes('skinWeight'), id).toBe(skinned);
      if (id === 'nine-vm-body' && skinned) expect(shader.vertex).toContain('aNs');
      if (id.includes('cloth')) expect(shader.vertex).toContain('aCloth');
      if (id === 'nine-vm-hull') expect(shader.vertex).toContain('aHullN');
    }
  }
});


test('scaled post graphs retain the existing draws, target scales and sampler bounds', () => {
  const rows = postRows();
  expect([rows.bleed.draws.length, rows.reflect.draws.length, rows.haze.draws.length]).toEqual([5, 2, 2]);
  for (const row of Object.values(rows)) for (const program of Object.values(row.programs)) {
    expect(program.graph.budget?.nodes).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(JSON.stringify(program.graph)).length).toBeLessThanOrEqual(64000);
    const shader = build(program.graph, false);
    expect(shader.fragment).not.toContain('NaN');
  }
});

test('a second shard fixture drives resized post targets and skips gated outputs', async () => {
  const render = renderer();
  await prepareScaledPost(render);
  const scene = new THREE.WebGLRenderTarget(800, 1600), camera = new THREE.PerspectiveCamera();
  const fixture: ScaledPostRow = { name: 'FixturePost', programs: { copy: { graph: { version: 1, kind: 'post', nodes: { uv: { op: 'screenUV' }, colour: { op: 'texture', in: ['uv'], param: 'source' }, rgb: { op: 'swizzle', in: ['colour'], mask: 'xyz' } }, params: { source: { type: 'texture', role: 'lent', value: 'source' } }, stages: { post: { colour: 'rgb', alpha: .4 } } } } },
    targets: { small: { name: 'Fixture.small', of: 'input', scale: .5, filter: 'linear' }, quarter: { name: 'Fixture.quarter', of: 'small', scale: .5, filter: 'nearest' } },
    draws: [{ program: 'copy', to: 'small', textures: { source: 'input' } }, { program: 'copy', to: 'quarter', textures: { source: 'small' } }], settings: { gain: 1 }, when: 'gain', outputs: { final: 'quarter' }, drawnOnly: true };
  const pass = new ScaledPostPass(fixture, { renderer: render, camera }), draws: [number, number][] = [];
  Reflect.set(render, 'setRenderTarget', (target: THREE.WebGLRenderTarget) => { draws.push([target.width, target.height]); });
  Reflect.set(render, 'render', () => undefined);
  try {
    pass.setSize(800, 1600); pass.render(render, scene);
    expect(draws).toEqual([[400, 800], [200, 400]]);
    expect(pass.output('final')?.image).toMatchObject({ width: 200, height: 400 });
    pass.set({ gain: 0 }); pass.render(render, scene); expect(pass.output('final')).toBeNull();
    pass.set({ gain: 1 }); pass.setSize(400, 800); draws.length = 0; pass.render(render, scene);
    expect(draws).toEqual([[200, 400], [100, 200]]);
    expect(() => new ScaledPostPass({ ...fixture, targets: { bad: { name: 'cycle', of: 'bad', scale: .5, filter: 'linear' } } }, { renderer: render, camera })).toThrow('target');
  } finally { pass.dispose(); scene.dispose(); }
});


test('held draw rows compile aliased GLB buffers and ribbon channels', () => {
  for (const [id, graph] of Object.entries(viewmodelGraphs()).filter(([key]) => key.startsWith('nine-vm-rig-') || key === 'nine-vm-edge' || key === 'nine-vm-trail')) {
    expect(validateGraph(graph, { trustedBudget: true }).ok, id).toBe(true);
    const shaders = build(graph, false, id.startsWith('nine-vm-rig-'));
    expect(shaders.fragment, id).not.toContain('NaN');
    if (id.startsWith('nine-vm-rig-')) expect(shaders.vertex + shaders.fragment, id).toContain('aMat');
    if (id === 'nine-vm-trail') expect(shaders.vertex, id).toContain('aAge');
    if (id === 'nine-vm-edge') expect(shaders.vertex, id).toContain('aTan');
  }
});


test('Nalati grades on the post-graph look: scene pass, desktop bloom side, the grade graph and its display', async () => {
  const camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene(), render = renderer(), rows = postChainRows();
  await prepareScaledPost(render);
  const grade = rows.postGraph.passes['grade']?.programs['grade']?.graph;
  if (grade === undefined) throw new Error('Missing grade graph');
  expect(validateGraph(grade, { trustedBudget: true }).ok).toBe(true);
  expect(build(grade, false).fragment).not.toContain('NaN');
  const levelScope = new Scope('nalati-grade');
  lendGrade(levelScope, 'nalati-grade', uniformsFrom(rows.uniforms));
  const look = postGraphLookOf('nalati-grasslands', rows.postGraph);
  if (look.mode !== 'replace') throw new Error('Nalati composes its own chain');
  const app: unknown = Object.create(App.prototype);
  if (!(app instanceof App)) throw new Error('Missing app');
  Reflect.set(app, 'events', new Events());
  const chain = (tier: 'phone' | 'desktop'): string[] => look.compose({ app, scope: levelScope, debug: { expose: () => undefined }, renderer: render, scene, camera, composer: new EffectComposer(), tier }).chain.map(pass => pass.name);
  try {
    expect(chain('desktop')).toEqual(['RenderPass', 'PostGraphBloom', 'PostGraphInputs', 'GradeV2Graph', 'EffectPass']);
    expect(chain('phone')).toEqual(['RenderPass', 'PostGraphInputs', 'GradeV2Graph', 'EffectPass']);
    expect(look.cell?.replaces).toBe('chain');
    // the grid cell carries the same chain, its desktop bloom included
    const cell = (tier: 'phone' | 'desktop'): string[] => (look.cell?.build({ root: new THREE.Group(), camera, renderer: render, tier, scope: levelScope }).passes ?? []).map(pass => pass.name);
    expect(cell('desktop')).toEqual(['PostGraphPoseView', 'PostGraphBloom', 'PostGraphInputs', 'GradeV2Graph']);
    expect(cell('phone')).toEqual(['PostGraphPoseView', 'PostGraphInputs', 'GradeV2Graph']);
  } finally { levelScope.dispose(); }
});

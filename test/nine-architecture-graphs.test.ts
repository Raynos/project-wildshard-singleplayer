import { graphFileRules } from '../src/format/materials';
import product from '../src/shards/nine-dragon-stack/generators/product';
import { heldGraphFiles } from '../src/shards/nine-dragon-stack/generators/heldGraphFiles';
import { postRows } from '../src/shards/nine-dragon-stack/generators/postGraphs';
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

import { lendUniforms as lendGrade } from '../src/game/shardfile/lentLooks';
import { NINE_FRAME_CHANNELS, NINE_FRAME_GROUP, NINE_LOOK_TEXTURES } from '../src/shards/nine-dragon-stack/generators/frameChannels';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { graphParamRoots } from '../src/game/looks/graphDaySky';
import sharedRows from '../src/shards/nine-dragon-stack/data/sharedUniforms.json' with { type: 'json' };
import paint from '../src/shards/nine-dragon-stack/data/paint.json' with { type: 'json' };
import light from '../src/shards/nine-dragon-stack/data/light.json' with { type: 'json' };


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

test('the look channel rows give each lent look its shared params every frame, the facade washes and the silk weave', () => {
  // the live shared rows as the world makes them (a number, a vector, a colour, a vector or colour array)
  const bag: Record<string, THREE.IUniform> = {};
  for (const [name, row] of Object.entries({ ...sharedRows, ...paint.uniforms, ...light.volume, ...light.haloUniforms, bandDepth: 1 })) {
    const value: unknown = typeof row === 'number' ? row : 'rgb' in row ? new THREE.Color(row.rgb) : 'v4s' in row ? row.v4s.map(([x, y, z, w]) => new THREE.Vector4(x, y, z, w))
      : 'rgbs' in row ? row.rgbs.map(hex => new THREE.Color(hex)) : 'v2' in row ? new THREE.Vector2(row.v2[0], row.v2[1])
      : 'v3' in row ? new THREE.Vector3(row.v3[0], row.v3[1], row.v3[2]) : 'v4' in row ? new THREE.Vector4(row.v4[0], row.v4[1], row.v4[2], row.v4[3]) : null;
    bag[name] = { value };
  }
  const shade = new THREE.Color(), linePx = { value: 2.1 };
  bag['uShade'] = { value: shade }; bag['uLinePx'] = linePx;
  const looks = [...new Set(NINE_FRAME_CHANNELS.flatMap(program => program.numeric?.outputs.map(out => out.target) ?? []))].filter(target => target !== 'bag');
  const lent = graphParamRoots(NINE_FRAME_CHANNELS, NINE_FRAME_GROUP, looks), own = graphParamRoots(NINE_FRAME_CHANNELS, NINE_FRAME_GROUP, ['bag']);
  const view = { eyeX: 1, eyeY: 130, eyeZ: 2, near: 0.1, p00: 1.5, p11: 2, rootX: 10, rootY: 0, rootZ: -4 };
  const lane = installChannelPrograms(NINE_FRAME_CHANNELS, NINE_FRAME_GROUP, new Map<string, unknown>([['view', view], ['uniforms', bag], ...lent.roots, ...own.roots]));
  const writes = new Map<string, number | readonly number[]>();
  const frame = (): void => {
    lane.evaluate({ time: 5, delta: 0.016, values: {} });
    lent.push({ setParam: (id, name, value) => { writes.set(`${id}:${name}`, typeof value === 'number' ? value : [...value]); } });
  };
  frame();
  const close = (key: string, to: readonly number[]): void => {
    const got = writes.get(key), parts = typeof got === 'object' ? got : [];
    expect(parts.length, key).toBe(to.length);
    to.forEach((part, i) => { expect(parts[i], key).toBeCloseTo(part, 6); });
  };
  close('nine-facade:uFacadeWash', new THREE.Color(0xe0e3ef).toArray());
  close('nine-windows:uSky', new THREE.Color(0xbcc4d2).toArray());
  close('nine-halo:rootAt', [10, 0, -4]);
  const depths = [...writes].filter(([key]) => key.endsWith(':bandDepth'));
  expect(depths.length).toBeGreaterThan(0);
  for (const [key, value] of depths) expect(value, key).toBeCloseTo(1, 6);
  shade.setRGB(0.8, 0.9, 1); linePx.value = 3; frame();
  close('nine-architecture:uShade', [0.8, 0.9, 1]);
  expect(writes.get('nine-facade:uLinePx')).toBe(3);
  // each write is a param its own look declares (the fog's colour only the silk fog's)
  for (const key of writes.keys()) {
    const [id = '', param = ''] = key.split(':'), entry: unknown = product.look.materials[id];
    const graph: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'graph') : null;
    const params: unknown = typeof graph === 'object' && graph !== null ? Reflect.get(graph, 'params') : null;
    expect(typeof params === 'object' && params !== null ? Object.keys(params) : [], key).toContain(param);
  }
  expect([...writes.keys()]).toContain('nine-silk-fog:fogBaseCol');
  expect([...writes.keys()]).not.toContain('nine-streaks:fogBaseCol');
  expect(writes.get('nine-architecture:uLpMax')).toBe(0);
  expect(NINE_LOOK_TEXTURES).toContainEqual({ look: 'nine-architecture', param: 'uSilk', uniform: 'uSilk' });
  expect(NINE_LOOK_TEXTURES).toContainEqual({ look: 'nine-windows', param: 'uLpVolB', uniform: 'uLpVolB' });
});

import type { MaterialEntry } from '../src/format/materials';
import { unzlibSync } from 'fflate';
import { parseGrappleFilament } from '@wildshard/format/grapple';
import filamentRows from '../src/shards/nine-dragon-stack/data/filament.json' with { type: 'json' };
import paintArray from '../src/shards/nine-dragon-stack/data/paintArray.generated.json' with { type: 'json' };
import { burstGraphs } from '../src/shards/nine-dragon-stack/generators/burstGraphs';
import { effectField } from '../src/engine/fx/effectField';
import burstRows from '../src/shards/nine-dragon-stack/data/burstFields.json' with { type: 'json' };
import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { streakGraph } from '../src/shards/nine-dragon-stack/generators/streakGraph';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { buildStreaks, stairStreaks } from '../src/shards/nine-dragon-stack/look/streaks';
import type { Shared } from '../src/shards/nine-dragon-stack/look/style';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

test('wet receivers compile within both caps and retain their plane channels', () => {
  const graph = streakGraph();
  expect(graph.budget?.nodes).toBeLessThanOrEqual(4096);
  expect(new TextEncoder().encode(JSON.stringify(graph)).length).toBeLessThanOrEqual(64000);
  const compiled = compileGraph(graph, { trustedBudget: true }), cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials: new Map([['nine-streaks', compiled.material]]), setParam: (_id, name, value) => { compiled.setParam(name, value); }, setTexture: (_id, name, texture) => { compiled.setTexture(name, texture); },
    bindMeshMap: () => compiled.material });
  const shared = { u: { uGroundY: { value: 124 } } } as Shared;
  const emitter = { at: new THREE.Vector3(1, 130, 2), color: new THREE.Color(1, 0.5, 0.2), w: 1, h: 2, power: 2, spill: 1 };
  const hole = new THREE.Vector4(-5, -5, 5, 5), square = buildStreaks(shared, [emitter], hole);
  const stairs = stairStreaks(shared, [emitter], { flights: [{ x0: 2, x1: 8, y0: 124 }], landings: [{ x0: 8, x1: 10, y: 128 }], rise: 0.2, run: 0.3, z0: -2, z1: 2 });
  expect(stairs).toHaveLength(2);
  expect(square.geometry.getAttribute('aHole').getX(0)).toBe(-5);
  expect(stairs[0]?.geometry.getAttribute('aPlaneN').getX(0)).toBeLessThan(0);
  expect(stairs[0]?.geometry.getAttribute('aLift').getX(0)).toBeCloseTo(0.084);
  expect(compiled.material.blendSrcAlpha).toBe(THREE.ZeroFactor);
  expect(compiled.material.blendDstAlpha).toBe(THREE.OneFactor);
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(square); handler.setRenderer(renderer); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.build(compiled.material, square, parameters);
    expect(parameters.vertexShader).toContain('aPlaneN');
    expect(parameters.fragmentShader).toContain('discard');
    expect(parameters.fragmentShader).not.toContain('sRGBTransferOETF');
  } finally {
    handler.renderEnd(); for (const mesh of [square, ...stairs]) mesh.geometry.dispose(); compiled.material.dispose();
    for (const cleanup of cleanups) cleanup();
  }
});


test('grapple bursts use the field clock and hide at their declared lifetimes', () => {
  const graphs = burstGraphs();
  for (const [id, row] of Object.entries(burstRows)) {
    const graph = graphs[`nine-grapple-${id}`];
    if (graph === undefined) throw new Error('Missing grapple effect graph');
    if (row.shape !== 'flake' && row.shape !== 'streak') throw new Error('Unexpected burst shape');
    const compiled = compileGraph(graph, { trustedBudget: true }), field = effectField({ ...row, shape: row.shape }, compiled.material);
    try {
      expect(field.object.visible).toBe(false);
      field.burst(new THREE.Vector3(2, 3, 4), new THREE.Vector3(0, 1, 0), 0.125);
      expect(field.object.position.toArray()).toEqual([2, 3, 4]);
      expect(field.geometry.getAttribute('aBurst').getX(0)).toBe(0);
      field.update(row.life / 2);
      expect(field.object.visible).toBe(true);
      expect(field.geometry.getAttribute('aBurst').getX(0)).toBeCloseTo(row.life / 2);
      field.update(row.life);
      expect(field.object.visible).toBe(false);
      expect(graph.budget?.nodes).toBeLessThanOrEqual(4096);
      expect(JSON.stringify(graph).length).toBeLessThanOrEqual(64000);
    } finally { field.geometry.dispose(); compiled.material.dispose(); }
  }
});

test('halo discs compile with additive alpha preservation inside the existing caps', async () => {
  const { haloGraph } = await import('../src/shards/nine-dragon-stack/generators/haloGraph');
  const graph = haloGraph(), compiled = compileGraph(graph, { trustedBudget: true });
  expect(graph.budget?.nodes).toBeLessThanOrEqual(4096);
  expect(new TextEncoder().encode(JSON.stringify(graph)).length).toBeLessThanOrEqual(64000);
  const cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials: new Map([['nine-halo', compiled.material]]),
    setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => compiled.material });
  const { buildHalos } = await import('../src/shards/nine-dragon-stack/look/light/halos');
  const shared = { u: { uHalo: { value: new THREE.Vector4(2, 1.2, 5, 0.12) } } } as Shared;
  const halos = buildHalos(shared, { lanterns: [], shops: [], signs: [] });
  expect(halos.mesh.material.depthWrite).toBe(false);
  expect(halos.mesh.material.blendSrcAlpha).toBe(THREE.ZeroFactor);
  expect(halos.mesh.material.blendDstAlpha).toBe(THREE.OneFactor);
  halos.mesh.geometry.dispose(); for (const cleanup of cleanups) cleanup();
  expect(graph.params?.['uHalo']?.value).toEqual([2, 1.2, 5, 0.12]);
  expect(Object.values(graph.nodes).filter(node => node.op === 'attribute').map(node => node.name).sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual(['aAt', 'aCol', 'aCorner', 'aR']);
  expect(Object.values(graph.nodes).some(node => node.op === 'viewDepth')).toBe(true);
  compiled.material.dispose();
});


test('paint chunks cover every layer exactly with a neutral unmasked alpha', () => {
  for (const row of Object.values(paintArray)) {
    const ends = Array.from({ length: row.layers }, () => 0);
    for (const part of row.parts) {
      const bytes = unzlibSync(Uint8Array.from(atob(part.packed), char => char.codePointAt(0) ?? 0));
      expect(part.offset).toBe(ends[part.layer]);
      expect(bytes.length).toBe(Math.min(196608, row.size * row.size * 4 - part.offset));
      ends[part.layer] = part.offset + bytes.length;
      if ([2, 3, 4, 5, 6, 7].includes(part.layer)) {
        for (let i = 3; i < bytes.length; i += 4) if (bytes[i] !== 128) throw new Error('Unmasked paint alpha changed');
      }
    }
    expect(ends).toEqual(Array.from({ length: row.layers }, () => row.size * row.size * 4));
  }
});

test('filament graph binds the simulated rope and preserves target alpha', async () => {
  const { filamentGraph } = await import('../src/shards/nine-dragon-stack/generators/filamentGraph');
  const { Filament, Rope } = await import('../src/game/grapple/ribbon');
  const graph = filamentGraph(), compiled = compileGraph(graph, { trustedBudget: true }), cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials: new Map([['nine-filament', compiled.material]]),
    setParam: (_id, name, value) => { compiled.setParam(name, value); }, setTexture: () => undefined, bindMeshMap: () => compiled.material });
  const { filamentGeometry } = await import('../src/shards/nine-dragon-stack/generators/filamentGeometry');
  const rope = new Rope(), line = new Filament(rope.n, filamentGeometry(rope.n), 'nine-filament', parseGrappleFilament(filamentRows));
  rope.reset(new THREE.Vector3(0, 1, -2), new THREE.Vector3(4, 2, -8));
  line.u.uRes.value.set(768, 1366); line.u.uProjection.value.set(1.5, 1.8); line.update(rope);
  const position = line.mesh.geometry.getAttribute('position'), previous = line.mesh.geometry.getAttribute('aPrev');
  expect(position.count).toBe(rope.n * 2);
  expect(position.getX(0)).toBe(rope.p[0]); expect(previous.getX(0)).toBe(rope.p[0]);
  expect(position.getX(position.count - 1)).toBe(rope.p[rope.p.length - 3]);
  expect(compiled.material.blendSrcAlpha).toBe(THREE.ZeroFactor);
  expect(compiled.material.blendDstAlpha).toBe(THREE.OneFactor);
  expect(graph.budget?.nodes).toBeLessThanOrEqual(4096);
  expect(new TextEncoder().encode(JSON.stringify(graph)).length).toBeLessThanOrEqual(64000);
  line.mesh.geometry.dispose(); compiled.material.dispose(); for (const cleanup of cleanups) cleanup();
});


test('fog writes follow each admitted graph declaration while unknown params remain strict', async () => {
  const { setDeclaredGraphParam } = await import('../src/shards/nine-dragon-stack/look/facadeMaterial');
  const { haloGraph } = await import('../src/shards/nine-dragon-stack/generators/haloGraph');
  const { default: authored } = await import('../src/shards/nine-dragon-stack/data/lookGraphs.json');
  const { validateGraph } = await import('../src/format/materialGraph');
  const fog = validateGraph(authored['nine-silk-fog'], { trustedBudget: true });
  if (!fog.ok) throw new Error(fog.errors.join('\n'));
  const catalogue = { 'nine-silk-fog': { family: 'graph', graph: fog.graph },
    'nine-streaks': { family: 'graph', graph: streakGraph() }, 'nine-halo': { family: 'graph', graph: haloGraph() } } satisfies Record<string, MaterialEntry>;
  const graphs = new Map(Object.entries(catalogue).map(([id, row]) => [id, compileGraph(row.graph, { trustedBudget: true })]));
  const writes: string[] = [], cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials: new Map([...graphs].map(([id, graph]) => [id, graph.material])),
    setParam: (id, name, value) => { graphs.get(id)?.setParam(name, value); writes.push(`${id}:${name}`); }, setTexture: () => undefined, bindMeshMap: () => new THREE.MeshBasicMaterial() });
  try {
    for (const id of Object.keys(catalogue)) for (const [name, param] of Object.entries(fog.graph.params ?? {})) {
      if (typeof param.value === 'string') throw new Error('Unexpected fog texture');
      setDeclaredGraphParam(id, name, param.value, catalogue);
    }
    expect(writes.filter(name => name.endsWith(':fogBaseCol'))).toEqual(['nine-silk-fog:fogBaseCol']);
    expect(writes).toContain('nine-streaks:rootAt');
    expect(writes).toContain('nine-halo:rootAt');
    expect(() => graphs.get('nine-streaks')?.setParam('fogBaseCol', [0, 0, 0])).toThrow('no param');
  } finally { for (const cleanup of cleanups) cleanup(); for (const graph of graphs.values()) graph.material.dispose(); }
});

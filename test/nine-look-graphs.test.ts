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
import { buildStreaks, stairStreaks } from '../src/shards/nine-dragon-stack/generators/receiverCards';
import { cardScene } from '../src/shards/nine-dragon-stack/generators/presentation';
import { createSceneBuffers } from '../src/game/shardfile/sceneBuffers';
import { Scope } from '../src/engine/app/scope';
import { lightVolumeBlobs, lightVolumeRows } from '../src/shards/nine-dragon-stack/generators/lightVolumes';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

test('every admitted volume variant resolves its shared lossless voxel payload', () => {
  const blobs = lightVolumeBlobs(), names = new Map(blobs.map(blob => [blob.file.name, blob]));
  expect(new Set(blobs.map(blob => blob.file.hash)).size).toBe(blobs.length);
  const rows = Object.values(lightVolumeRows());
  expect(rows).toHaveLength(8);
  for (const row of rows) {
    const payload = names.get(row.file); if (payload === undefined) throw new Error('Missing volume payload');
    expect(unzlibSync(payload.bytes).length).toBe(row.size.reduce((product: number, value: number) => product * value, 4));
  }
});

test('wet receivers compile within both caps and retain their plane channels', () => {
  const graph = streakGraph();
  expect(graph.budget?.nodes).toBeLessThanOrEqual(4096);
  expect(new TextEncoder().encode(JSON.stringify(graph)).length).toBeLessThanOrEqual(64000);
  const compiled = compileGraph(graph, { trustedBudget: true }), cleanups: (() => void)[] = [];
  lendLooks({ onDispose: run => { cleanups.push(run); } }, { materials: new Map([['nine-streaks', compiled.material]]), setParam: (_id, name, value) => { compiled.setParam(name, value); }, setTexture: (_id, name, texture) => { compiled.setTexture(name, texture); },
    bindMeshMap: () => compiled.material });
  const emitter = { at: new THREE.Vector3(1, 130, 2), color: new THREE.Color(1, 0.5, 0.2), w: 1, h: 2, power: 2, spill: 1 };
  const hole = new THREE.Vector4(-5, -5, 5, 5), square = buildStreaks(124, [emitter], hole);
  const stairs = stairStreaks([emitter], { flights: [{ x0: 2, x1: 8, y0: 124 }], landings: [{ x0: 8, x1: 10, y: 128 }], rise: 0.2, run: 0.3, z0: -2, z1: 2 });
  Object.assign(compiled.material, { blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  square.material = compiled.material;
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
  const { buildHalos } = await import('../src/shards/nine-dragon-stack/generators/haloCards');
  const source = buildHalos({ lanterns: [{ at: new THREE.Vector3(1, 130, 2), color: new THREE.Color(1, 0.5, 0.2), w: 0.5, h: 0.5, power: 1, spill: 1 }], shops: [], signs: [] });
  const owner = new Scope('halo-test');
  const halos = createSceneBuffers(cardScene([source], 'halos'), compiled.material, owner);
  const mesh = halos.children[0];
  if (!(mesh instanceof THREE.Mesh) || !(mesh.geometry instanceof THREE.InstancedBufferGeometry)) throw new Error('Halo draw missing');
  expect(mesh.geometry.getAttribute('aAt').getX(0)).toBe(1);
  expect(mesh.geometry.instanceCount).toBe(1);
  owner.dispose(); for (const cleanup of cleanups) cleanup();
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

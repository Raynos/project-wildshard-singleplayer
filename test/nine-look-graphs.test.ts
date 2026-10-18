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

import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { modelContext } from '../src/engine/models/model';
import { rebindGeometry } from '../src/engine/app/cachedAssets';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function renderer(): THREE.WebGLRenderer {
  const r: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(r instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(r, key, value);
  return r;
}

test('a GPU rebind reaches the renderer but keeps a memo; a real dispose still retires it', () => {
  const ctx = modelContext(null), geometry = new THREE.BoxGeometry();
  let makes = 0, events = 0;
  geometry.addEventListener('dispose', () => { events++; });
  const make = (): { geometry: THREE.BufferGeometry } => { makes++; return { geometry }; };
  const first = ctx.once('views', make);
  rebindGeometry(geometry);
  expect(events).toBe(1);
  expect(ctx.once('views', make)).toBe(first);
  expect(makes).toBe(1);
  geometry.dispose();
  expect(events).toBe(2);
  expect(ctx.once('views', make)).not.toBe(first);
  expect(makes).toBe(2);
});

test('a graph build with unchanged bindings keeps the drawn geometry and its memo (Pine ground cover)', async () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
    origin: { op: 'objectOrigin' }, carried: { op: 'varying', in: ['origin'] },
  }, stages: { surface: { colour: 'carried' } } };
  const compiled = compileGraph(ir), geometry = new THREE.BoxGeometry(), mesh = new THREE.Mesh(geometry, compiled.material);
  const ctx = modelContext(null), field = ctx.once('field', () => ({ geometry, material: compiled.material }));
  let rebinds = 0;
  geometry.addEventListener('dispose', () => { rebinds++; });
  const handler = new EngineNodesHandler();
  handler.setRenderer(renderer());
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(mesh, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(compiled.material, mesh, parameters); } finally { handler.renderEnd(); }
  await Promise.resolve();
  expect(rebinds).toBe(0);
  expect(ctx.once('field', () => { throw new Error('[field] not built'); })).toBe(field);
});

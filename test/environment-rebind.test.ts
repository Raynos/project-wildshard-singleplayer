import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { ToonLook } from '../src/engine/render/families/toon';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** a classic PMREM environment of one atlas height */
function pmrem(height: number): THREE.Texture {
  const texture = new THREE.Texture({ width: 768, height });
  texture.mapping = THREE.CubeUVReflectionMapping;
  return texture;
}
const field = (owner: object, key: string): unknown => Reflect.get(owner, key);
const call = (owner: object, key: string, args: unknown[]): unknown => {
  const fn = field(owner, key);
  if (typeof fn !== 'function') throw new Error(`Missing ${key}`);
  return Reflect.apply(fn, owner, args);
};

test('a toon build reads the scene PMREM, and a new PMREM of its size rebinds its uniforms without a build', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const ir: GraphIr = { version: 1, kind: 'material', model: 'toon', nodes: {}, stages: { surface: { colour: [0.2, 0.5, 0.8] } } };
  const handler = new EngineNodesHandler(), material = compileGraph(ir, { toon: new ToonLook({}) }).material;
  handler.setRenderer(renderer);
  const object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), light = new THREE.DirectionalLight(0xffffff, 1);
  const before = pmrem(1024), after = pmrem(1024);
  scene.add(object, light); scene.environment = before;
  handler.renderStart(scene, camera); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  // a scene-shaped program's key (the renderer files it before the build); only its scene-shape mark matters here
  parameters.customProgramCacheKey = 'graph|scene:shape:toon';
  handler.build(material, object, parameters);
  const values = (record: Record<string, unknown>): unknown[] => Object.values(record).map(u => typeof u === 'object' && u !== null ? field(u, 'value') : undefined);
  expect(values(parameters.uniforms)).toContain(before);

  const pending = field(handler, 'pendingBuilds'), builds: unknown = pending instanceof WeakMap ? pending.get(material) : undefined;
  const build: unknown = Array.isArray(builds) ? builds[0] : undefined;
  if (typeof build !== 'object' || build === null) throw new Error('Missing pending build');
  const binding = field(build, 'binding');
  if (typeof binding !== 'object' || binding === null) throw new Error('Missing scene binding');
  expect(field(field(binding, 'inputs') as object, 'reads')).toEqual({ fog: true, environment: true });
  const program = { getUniforms: () => ({ seq: [] }) };
  const cache = field(handler, 'programCache');
  if (!(cache instanceof Map)) throw new Error('Missing program cache');
  cache.set(material, new Map([[program, { uniformsGroups: [], uniforms: parameters.uniforms, uniformsList: [], updateNodes: field(build, 'updateNodes') }]]));

  scene.environment = after; handler.renderStart(scene, camera); handler.updateLights([light]);
  expect(call(handler, 'rebindEnvironment', [material, program, binding])).toBe(true);
  const programs: unknown = cache.get(material), entry: unknown = programs instanceof Map ? programs.get(program) : undefined;
  if (typeof entry !== 'object' || entry === null) throw new Error('Missing program entry');
  const rebound = field(entry, 'uniforms');
  if (typeof rebound !== 'object' || rebound === null) throw new Error('Missing rebound uniforms');
  expect(values(rebound as Record<string, unknown>)).toContain(after);
  expect(values(rebound as Record<string, unknown>)).not.toContain(before);
  expect(handler.environmentRebinds).toBe(1);
  // the old environment's own node, which other programs may still bind, keeps its atlas
  const environments = field(handler, 'environments'), oldNode: unknown = environments instanceof WeakMap ? environments.get(before) : undefined;
  if (typeof oldNode !== 'object' || oldNode === null) throw new Error('Missing old environment node');
  expect(field(field(oldNode, '_texture') as object, 'value')).toBe(before);

  // another atlas size keeps the full refresh
  scene.environment = pmrem(512); handler.renderStart(scene, camera); handler.updateLights([light]);
  const refreshed = { ...binding, inputs: { ...(field(binding, 'inputs') as object), environment: new WeakRef(after) } };
  expect(call(handler, 'rebindEnvironment', [material, program, refreshed])).toBe(false);
});

import { afterAll, afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { compileGraph } from '../src/engine/render/graph/compile';
import { bindGraphMeshMap } from '../src/engine/render/graphBackend';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { overrideSetting } from '../src/engine/ui/Settings';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
afterEach(() => { overrideSetting('shaderReuse', null); });

const GRAPH: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {},
  stages: { surface: { colour: [0.2, 0.3, 0.4], roughness: 0.4, occlusion: 0.8 } } };

function stubRenderer(): THREE.WebGLRenderer {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  return renderer;
}

/** Build two borrowed-map variants of one graph on one handler, as a grid entry's warm-up does. */
function buildPair(a: THREE.MeshStandardMaterial, b: THREE.MeshStandardMaterial): { first: THREE.WebGLProgramParametersWithUniforms; second: THREE.WebGLProgramParametersWithUniforms; handler: EngineNodesHandler } {
  const handler = new EngineNodesHandler(), compiled = compileGraph(GRAPH), scope = new Scope('reuse');
  handler.setRenderer(stubRenderer());
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), geometry = new THREE.PlaneGeometry(1, 1);
  const build = (source: THREE.Material): THREE.WebGLProgramParametersWithUniforms => {
    const material = bindGraphMeshMap(compiled.material, source, scope), object = new THREE.Mesh(geometry, material);
    // the renderer hands the build one parameter object per (material, key); its primitive fields match for equal programs
    const parameters: object = { shaderID: undefined, isRawShaderMaterial: false, customProgramCacheKey: material.customProgramCacheKey(),
      map: false, normalMap: true, roughnessMap: true, aoMap: true, instancing: false, skinning: false, fog: false };
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.renderStart(scene, camera); handler.updateLights([]);
    try { handler.build(material, object, parameters); } finally { handler.renderEnd(); }
    return parameters;
  };
  try { return { first: build(a), second: build(b), handler }; }
  finally { geometry.dispose(); scope.dispose(); compiled.material.dispose(); }
}

const holds = (parameters: THREE.WebGLProgramParametersWithUniforms, texture: THREE.Texture): boolean =>
  Object.values(parameters.uniforms).some(uniform => uniform.value === texture);

test('a variant that differs only in per-draw maps reuses the build and binds its own maps', () => {
  overrideSetting('shaderReuse', 'on');
  const roughness = new THREE.DataTexture(), ao = new THREE.DataTexture(), normalA = new THREE.DataTexture(), normalB = new THREE.DataTexture();
  const a = new THREE.MeshStandardMaterial({ normalMap: normalA, roughnessMap: roughness, aoMap: ao });
  const b = new THREE.MeshStandardMaterial({ normalMap: normalB, roughnessMap: roughness, aoMap: ao });
  const { first, second, handler } = buildPair(a, b);
  expect(handler.buildStats.reused).toBe(1);
  expect(handler.buildStats.repeats).toBe(1);
  expect(second.vertexShader).toBe(first.vertexShader);
  expect(second.fragmentShader).toBe(first.fragmentShader);
  // the shared reference nodes were updated from the second material on its first node update
  expect(holds(second, normalB)).toBe(true);
  expect(holds(second, roughness)).toBe(true);
  expect(second.uniforms).not.toBe(first.uniforms);
});

test('reuse produces the same program as a full build', () => {
  const roughness = new THREE.DataTexture(), ao = new THREE.DataTexture();
  const make = (): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] => [
    new THREE.MeshStandardMaterial({ normalMap: new THREE.DataTexture(), roughnessMap: roughness, aoMap: ao }),
    new THREE.MeshStandardMaterial({ normalMap: new THREE.DataTexture(), roughnessMap: roughness, aoMap: ao })];
  const full = buildPair(...make());
  expect(full.handler.buildStats.reused).toBe(0);
  overrideSetting('shaderReuse', 'on');
  const reused = buildPair(...make());
  expect(reused.handler.buildStats.reused).toBe(1);
  expect(reused.second.fragmentShader).toBe(full.second.fragmentShader);
  expect(reused.second.vertexShader).toBe(full.second.vertexShader);
  expect(Object.keys(reused.second.uniforms).sort()).toEqual(Object.keys(full.second.uniforms).sort());
});

test('a map the graph samples by value is never shared across variants', () => {
  overrideSetting('shaderReuse', 'on');
  const ao = new THREE.DataTexture(), normal = new THREE.DataTexture(), roughA = new THREE.DataTexture(), roughB = new THREE.DataTexture();
  const a = new THREE.MeshStandardMaterial({ normalMap: normal, roughnessMap: roughA, aoMap: ao });
  const b = new THREE.MeshStandardMaterial({ normalMap: normal, roughnessMap: roughB, aoMap: ao });
  const { second, handler } = buildPair(a, b);
  expect(handler.buildStats.reused).toBe(0);
  expect(handler.buildStats.repeats).toBe(1);
  expect(holds(second, roughB)).toBe(true);
  expect(holds(second, roughA)).toBe(false);
});

test('off by default: every variant runs its own build', () => {
  const texture = new THREE.DataTexture();
  const { handler } = buildPair(new THREE.MeshStandardMaterial({ normalMap: new THREE.DataTexture(), roughnessMap: texture, aoMap: texture }),
    new THREE.MeshStandardMaterial({ normalMap: new THREE.DataTexture(), roughnessMap: texture, aoMap: texture }));
  expect(handler.buildStats).toMatchObject({ builds: 2, reused: 0, repeats: 1 });
});

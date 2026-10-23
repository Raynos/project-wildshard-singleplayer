import { afterAll, afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { TextureNode } from 'three/webgpu';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { isDev, setDev } from '../src/engine/core/devMode';
import type { GraphIr } from '@wildshard/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
const developer = isDev();
afterEach(() => { setDev(developer); });
afterAll(() => { vi.unstubAllGlobals(); });

// P0: ground cover's kinds share one program, and each still paid a full node build. A material whose program key an
// earlier material's build already made reuses that build's code with its own uniforms.
const GRAPH = (k: number, op: 'mul' | 'add' = 'mul'): GraphIr => ({ version: 1, kind: 'material', model: 'unlit', effectState: { fog: false },
  params: { k: { type: 'float', value: k }, painting: { type: 'texture', value: 'painting', role: 'lent' } },
  nodes: { uv: { op: 'uv' }, tap: { op: 'texture', param: 'painting', in: ['uv'] }, rgb: { op: 'swizzle', in: ['tap'], mask: 'xyz' },
    k: { op: 'param', param: 'k' }, out: { op, in: ['rgb', 'k'] } },
  stages: { surface: { colour: 'out' } } });

function harness(): { handler: EngineNodesHandler; build: (material: THREE.Material) => THREE.WebGLProgramParametersWithUniforms; done: () => void } {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight();
  scene.add(sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const build = (material: THREE.Material): THREE.WebGLProgramParametersWithUniforms => {
    const mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
    handler.setObject(mesh, material);
    const parameters: object = { precision: 'highp', customProgramCacheKey: material.customProgramCacheKey() };
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.build(material, mesh, parameters);
    return parameters;
  };
  return { handler, build, done: () => { handler.renderEnd(); geometry.dispose(); } };
}
const named = (parameters: THREE.WebGLProgramParametersWithUniforms, value: unknown): string[] =>
  Object.entries(parameters.uniforms).filter(([, uniform]) => uniform.value === value).map(([name]) => name);

test('an equal program reuses the first build with its own params and textures', () => {
  setDev(true);
  const { handler, build, done } = harness();
  const a = compileGraph(GRAPH(0.25)), b = compileGraph(GRAPH(0.75));
  const ta = new THREE.DataTexture(new Uint8Array(4), 1, 1), tb = new THREE.DataTexture(new Uint8Array(4), 1, 1), tb2 = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  a.setTexture('painting', ta); b.setTexture('painting', tb);
  try {
    const first = build(a.material), second = build(b.material);
    expect(handler.reuses).toBe(1);
    expect(second.vertexShader).toBe(first.vertexShader);
    expect(second.fragmentShader).toBe(first.fragmentShader);
    const [k] = named(first, 0.25), [sampler] = named(first, ta);
    if (k === undefined || sampler === undefined) throw new Error('Missing first build uniforms');
    expect(Reflect.get(second.uniforms[k] ?? {}, 'value')).toBe(0.75);
    expect(second.uniforms[sampler]).toBeInstanceOf(TextureNode);
    expect(Reflect.get(second.uniforms[sampler] ?? {}, 'value')).toBe(tb);
    // a lent texture moved after the build reaches the reused program, never the first material's
    b.setTexture('painting', tb2);
    expect(Reflect.get(second.uniforms[sampler] ?? {}, 'value')).toBe(tb2);
    expect(Reflect.get(first.uniforms[sampler] ?? {}, 'value')).toBe(ta);
    b.setParam('k', 0.5);
    expect(Reflect.get(second.uniforms[k] ?? {}, 'value')).toBe(0.5);
    expect(Reflect.get(first.uniforms[k] ?? {}, 'value')).toBe(0.25);
  } finally { done(); a.material.dispose(); b.material.dispose(); ta.dispose(); tb.dispose(); tb2.dispose(); }
});

test('a graph of another shape (one operator differs) builds in full', () => {
  setDev(true);
  const { handler, build, done } = harness();
  const a = compileGraph(GRAPH(0.25)), b = compileGraph(GRAPH(0.25, 'add'));
  try {
    const first = build(a.material), second = build(b.material);
    expect(handler.reuses).toBe(0);
    expect(second.fragmentShader).not.toBe(first.fragmentShader);
  } finally { done(); a.material.dispose(); b.material.dispose(); }
});

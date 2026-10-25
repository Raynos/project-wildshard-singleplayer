import { afterAll, afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from './compile';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';
import { isDev, setDev } from '../../core/devMode';
import type { GraphIr } from '@wildshard/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
const developer = isDev();
afterEach(() => { setDev(developer); });
afterAll(() => { vi.unstubAllGlobals(); });

// P0 grid entry: equal graphs (ground cover's kinds) still linked a GL program each, because three keys a program by its
// material's node ids. The key leads with the graph's shape, so equal graphs key one program.
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

test('equal graphs key one program; another shape keys its own', () => {
  setDev(true);
  {
    const { handler, build, done } = harness();
    const a = compileGraph(GRAPH(0.25)), b = compileGraph(GRAPH(0.75)), c = compileGraph(GRAPH(0.25, 'add'));
    try {
      const first = build(a.material), second = build(b.material), other = build(c.material);
      expect(second.customProgramCacheKey).toBe(first.customProgramCacheKey);
      expect(other.customProgramCacheKey).not.toBe(first.customProgramCacheKey);
      // node reuse pairs the equal graphs, and the shared key stands for one program's code
      expect(handler.reuses).toBe(1);
      expect(second.fragmentShader).toBe(first.fragmentShader);
      expect(second.vertexShader).toBe(first.vertexShader);
    } finally { done(); a.material.dispose(); b.material.dispose(); c.material.dispose(); }
  }
});

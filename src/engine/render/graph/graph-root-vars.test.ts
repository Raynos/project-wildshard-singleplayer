import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from './compile';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function fragment(compiled: ReturnType<typeof compileGraph>): string {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), material = compiled.material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aKind', new THREE.Float32BufferAttribute([0, 1, 0, 1], 1));
  const object = new THREE.Mesh(geometry, material), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters.fragmentShader; }
  finally { geometry.dispose(); handler.renderEnd(); }
}

test('a world normal first read inside a branch is assigned at the top of main, before every branch', () => {
  // D204: Nine's kit read the normal first in its leaf kind's branch; three's normalWorldGeometry is a `toVar`, so its
  // assignment stayed in that branch and the wash's lit term outside it read zero (the stone shaded as unlit)
  const noise = (from: string, k: number): Record<string, { op: string; in: (string | number | number[])[] }> => ({
    [`s${k}`]: { op: 'mul', in: [from, k + 1.5] }, [`n${k}`]: { op: 'noise', in: [`s${k}`] } });
  const leaf = { ...noise('nw', 0), ...noise('nw', 1), ...noise('nw', 2), ...noise('nw', 3), ...noise('nw', 4), ...noise('nw', 5) };
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {
    kind: { op: 'attribute', name: 'aKind', type: 'float' }, isLeaf: { op: 'gt', in: ['kind', 0.5] },
    nw: { op: 'normalWorld' }, ...leaf,
    a01: { op: 'add', in: ['n0', 'n1'] }, a23: { op: 'add', in: ['n2', 'n3'] }, a45: { op: 'add', in: ['n4', 'n5'] },
    a0123: { op: 'add', in: ['a01', 'a23'] }, costly: { op: 'add', in: ['a0123', 'a45'] },
    pick: { op: 'select', in: ['isLeaf', 'costly', 0] },
    lit: { op: 'dot', in: ['nw', [0.35, 0.86, 0.38]] }, sum: { op: 'add', in: ['pick', 'lit'] },
    colour: { op: 'combine', in: ['sum', 'sum', 'sum'] } }, stages: { surface: { colour: 'colour' } }, effectState: { fog: false } });
  const shader = fragment(compiled), main = shader.slice(shader.indexOf('void main()'));
  const assign = main.search(/\bnormalWorldGeometry = /u), branch = main.search(/\bif \(/u);
  expect(branch).toBeGreaterThan(-1);
  expect(assign).toBeGreaterThan(-1);
  expect(assign).toBeLessThan(branch);
});

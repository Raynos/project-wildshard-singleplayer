import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from './compile';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';
import { isDev, setDev } from '../../core/devMode';
import { loadGraphBackend } from '../graphBackend';
import { collectTextures, sceneJobs } from '../precompile';

class LinkedProgram { readonly label = 'linked'; }
class Buffers {
  readonly ACTIVE_UNIFORMS = 0x8b86;
  getParameter(): number { return 24; }
  getProgramParameter(): number { return 0; }
  getActiveUniform(): WebGLActiveInfo | null { return null; }
  getUniformLocation(): WebGLUniformLocation | null { return null; }
}
vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
vi.stubGlobal('WebGLProgram', LinkedProgram);
vi.stubGlobal('WebGL2RenderingContext', Buffers);
// These cases cover a graph material's program pairing (prepareProgram / onUpdateProgram); the plain uniforms each draw
// sends have their own tests (node-plain-uniforms*.test.ts).
const developerBefore = isDev();
beforeAll(() => { setDev(true); });
afterAll(() => { vi.unstubAllGlobals(); setDev(developerBefore); });

test('a live draw pairs every acquired variant with its own uniforms', async () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const gl = new Buffers(), programs = new Map<string, object>();
  const properties: { programs: typeof programs; currentProgram?: object; uniforms?: object; uniformsList?: unknown } = { programs };
  for (const [key, value] of Object.entries({
    extensions: { has: () => false, get: () => null }, getContext: (): Buffers => gl, getRenderTarget: (): THREE.WebGLRenderTarget | null => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => properties, has: () => true },
    setNodesHandler: (handler: EngineNodesHandler): void => { handler.setRenderer(renderer); },
  })) Reflect.set(renderer, key, value);
  const handler = await loadGraphBackend(renderer);
  const sample = new THREE.DataTexture(new Uint8Array([64, 128, 192, 255]), 1, 1);
  const replacement = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    params: { sample: { type: 'texture', value: 'sample-slot', role: 'lent' } },
    nodes: { uv: { op: 'uv' }, sample: { op: 'texture', param: 'sample', in: ['uv'] }, rgb: { op: 'swizzle', in: ['sample'], mask: 'xyz' } },
    stages: { surface: { colour: 'rgb' } }, effectState: { fog: false } });
  compiled.setTexture('sample', sample);
  const material = compiled.material;
  const geometry = new THREE.PlaneGeometry(), camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
  const compile = (name: string) => {
    handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    const parameters: object = {};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.build(material, mesh, parameters); handler.renderEnd();
    const getUniforms = vi.fn(() => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })), setValue: (): void => undefined }));
    const program = { program: new LinkedProgram(), getUniforms };
    programs.set(name, program);
    return { program, uniforms: parameters.uniforms, getUniforms };
  };
  try {
    const road = compile('road'), future = compile('future'), later = compile('later');
    const jobs = sceneJobs(scene, null).jobs;
    expect(collectTextures(jobs)).toEqual([]);
    properties.currentProgram = road.program;
    handler.onUpdateProgram(material, road.program, properties);
    const uniforms = properties.uniforms, list = properties.uniformsList;
    compiled.setTexture('sample', replacement);
    expect(collectTextures(jobs)).toEqual([]);
    compiled.setTexture('sample', sample);
    handler.prepareProgram(material, future.program);
    expect(properties.currentProgram).toBe(road.program); expect(properties.uniforms).toBe(uniforms);
    expect(properties.uniformsList).toBe(list);
    handler.onUpdateProgram(material, future.program, properties);
    expect(properties.uniforms).toBe(future.uniforms);
    handler.prepareProgram(material, later.program); handler.onUpdateProgram(material, later.program, properties);
    expect(properties.uniforms).toBe(later.uniforms);
  } finally { material.dispose(); geometry.dispose(); sample.dispose(); replacement.dispose(); }
});

test('a shared material pairs its precompiled composer program after an environment draw', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const gl = new Buffers(), programs = new Map<string, object>();
  const properties: { programs: typeof programs; currentProgram?: object; uniforms?: object; uniformsList?: unknown } = { programs };
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => gl, getRenderTarget: () => new THREE.WebGLRenderTarget(1, 1),
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => properties, has: () => true },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    params: { colour: { type: 'vec3', value: [1, 0, 0] } }, nodes: { colour: { op: 'param', param: 'colour' } },
    stages: { surface: { colour: 'colour' } }, effectState: { fog: false } }).material;
  const geometry = new THREE.PlaneGeometry(), camera = new THREE.PerspectiveCamera();
  const env = new THREE.Scene(), main = new THREE.Scene(), envMesh = new THREE.Mesh(geometry, material), mainMesh = new THREE.Mesh(geometry, material);
  env.add(envMesh); main.add(mainMesh);
  function compile(scene: THREE.Scene, mesh: THREE.Mesh, name: string): { readonly program: { readonly program: WebGLProgram }; readonly linked: WebGLProgram; readonly uniforms: object } {
    handler.renderStart(scene, camera); handler.updateLights(scene === env ? [] : [new THREE.DirectionalLight()]); handler.setObject(mesh, material);
    const parameters: object = {};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.build(material, mesh, parameters);
    expect(parameters.vertexShader).toContain('uniform highp mat4 modelMatrix;');
    const blocks = [...parameters.vertexShader.matchAll(/uniform\s+\w+\s*\{([^{}]*)\};/gu)];
    expect(blocks.every(block => !block[1]?.includes('modelMatrix'))).toBe(true);
    const retained: unknown = Reflect.get(material, '_latestBuilder');
    if (typeof retained !== 'object' || retained === null) throw new Error('Missing cold fallback');
    expect(Object.keys(retained).sort()).toEqual(['uniformGroups', 'uniforms', 'updateNodes']);
    const pending: unknown = Reflect.get(handler, 'pendingBuilds');
    if (!(pending instanceof WeakMap)) throw new Error('Missing pending builds');
    const waiting: unknown = pending.get(material);
    if (!Array.isArray(waiting)) throw new Error('Missing cold build');
    expect(waiting.every((entry: unknown) => typeof entry === 'object' && entry !== null && !Reflect.has(entry, 'builder'))).toBe(true);
    const linked = new LinkedProgram(), program = { program: linked, getUniforms: () => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })), setValue: (): void => undefined }) };
    programs.set(name, program); properties.currentProgram = program; properties.uniforms = parameters.uniforms; properties.uniformsList = null;
    return { program, linked, uniforms: parameters.uniforms };
  }
  const before = compile(env, envMesh, 'env');
  handler.onUpdateProgram(material, before.program, properties);
  expect(Reflect.get(material, '_latestBuilder')).toBeUndefined();
  material.onBeforeRender(renderer, env, camera, geometry, envMesh, new THREE.Group()); handler.renderEnd();
  const after = compile(main, mainMesh, 'composer');
  // renderer.compile has selected the program but does not issue onUpdateProgram.
  handler.prepareProgram(material, after.program);
  handler.prepareProgram(material, after.program);
  expect(properties.currentProgram).toBe(after.program); expect(properties.uniforms).toBe(after.uniforms);
  material.onBeforeRender(renderer, main, camera, geometry, mainMesh, new THREE.Group()); handler.renderEnd();
  expect(Reflect.get(material, '_latestBuilder')).toBeUndefined();
  for (let i = 0; i < 3; i++) {
    handler.renderStart(env, camera); handler.setObject(envMesh, material); properties.currentProgram = before.program;
    properties.uniforms = after.uniforms; properties.uniformsList = null;
    material.onBeforeRender(renderer, env, camera, geometry, envMesh, new THREE.Group()); handler.renderEnd();
    expect(properties.uniforms).toBe(before.uniforms);
    handler.renderStart(main, camera); handler.setObject(mainMesh, material); properties.currentProgram = after.program;
    properties.uniforms = before.uniforms; properties.uniformsList = null;
    material.onBeforeRender(renderer, main, camera, geometry, mainMesh, new THREE.Group()); handler.renderEnd();
    expect(properties.uniforms).toBe(after.uniforms);
  }
  expect(handler.builds).toBe(2);
  material.dispose(); geometry.dispose();
});


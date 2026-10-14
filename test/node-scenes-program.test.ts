import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

class LinkedProgram { readonly label = 'linked'; }
class Buffers {
  readonly MAX_UNIFORM_BUFFER_BINDINGS = 35375;
  readonly UNIFORM_BUFFER = 35345;
  readonly DYNAMIC_DRAW = 35048;
  readonly INVALID_INDEX = 4294967295;
  readonly indices = new Map<WebGLProgram, Map<string, number>>();
  readonly points = new Map<WebGLProgram, Map<number, number>>();
  readonly bound = new Map<number, WebGLBuffer | null>();
  readonly live = new Set<WebGLBuffer>();
  private uploadBuffer: WebGLBuffer | null = null;
  private readonly sizes = new Map<WebGLBuffer, number>();
  writes = 0;
  getParameter(): number { return 24; }
  createBuffer(): WebGLBuffer { const buffer = {}; this.live.add(buffer); return buffer; }
  deleteBuffer(buffer: WebGLBuffer): void { this.live.delete(buffer); }
  bindBuffer(_target: number, buffer: WebGLBuffer | null): void { this.uploadBuffer = buffer; }
  bufferData(_target: number, size: number): void {
    if (this.uploadBuffer === null) throw new Error('Allocation needs a bound buffer'); this.sizes.set(this.uploadBuffer, size);
  }
  bufferSubData(_target: number, offset: number, data: Float32Array): void {
    if (this.uploadBuffer === null || offset + data.byteLength > (this.sizes.get(this.uploadBuffer) ?? 0)) throw new Error('Uniform upload exceeds its bound allocation');
    this.writes++;
  }
  bindBufferBase(_target: number, point: number, buffer: WebGLBuffer | null): void { this.bound.set(point, buffer); }
  getUniformBlockIndex(program: WebGLProgram, name: string): number {
    let names = this.indices.get(program); if (names === undefined) { names = new Map(); this.indices.set(program, names); }
    let index = names.get(name); if (index === undefined) { index = names.size; names.set(name, index); } return index;
  }
  uniformBlockBinding(program: WebGLProgram, index: number, point: number): void {
    let points = this.points.get(program); if (points === undefined) { points = new Map(); this.points.set(program, points); } points.set(index, point);
  }
  ready(program: WebGLProgram): boolean {
    const points = this.points.get(program);
    return points !== undefined && points.size > 0 && [...points.values()].every(point => { const buffer = this.bound.get(point); return buffer !== undefined && buffer !== null && this.live.has(buffer); });
  }
}
vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
vi.stubGlobal('WebGLProgram', LinkedProgram);
vi.stubGlobal('WebGL2RenderingContext', Buffers);
afterAll(() => { vi.unstubAllGlobals(); });

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
  function compile(scene: THREE.Scene, mesh: THREE.Mesh, name: string): { readonly program: object; readonly linked: WebGLProgram; readonly uniforms: object } {
    handler.renderStart(scene, camera); handler.updateLights(scene === env ? [] : [new THREE.DirectionalLight()]); handler.setObject(mesh, material);
    const parameters: object = {};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.build(material, mesh, parameters);
    const linked = new LinkedProgram(), program = { program: linked, getUniforms: () => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })) }) };
    programs.set(name, program); properties.currentProgram = program; properties.uniforms = parameters.uniforms; properties.uniformsList = null;
    return { program, linked, uniforms: parameters.uniforms };
  }
  const before = compile(env, envMesh, 'env');
  handler.onUpdateProgram(material, before.program, properties);
  material.onBeforeRender(renderer, env, camera, geometry, envMesh, new THREE.Group()); handler.renderEnd();
  expect(gl.ready(before.linked)).toBe(true);
  const after = compile(main, mainMesh, 'composer');
  // renderer.compile has selected the program but does not issue onUpdateProgram.
  expect(gl.ready(after.linked)).toBe(false);
  material.onBeforeRender(renderer, main, camera, geometry, mainMesh, new THREE.Group()); handler.renderEnd();
  expect(gl.ready(after.linked)).toBe(true);
  for (let i = 0; i < 3; i++) {
    handler.renderStart(env, camera); handler.setObject(envMesh, material); properties.currentProgram = before.program;
    properties.uniforms = after.uniforms; properties.uniformsList = null;
    material.onBeforeRender(renderer, env, camera, geometry, envMesh, new THREE.Group()); handler.renderEnd();
    expect(gl.ready(before.linked)).toBe(true); expect(properties.uniforms).toBe(before.uniforms);
    handler.renderStart(main, camera); handler.setObject(mainMesh, material); properties.currentProgram = after.program;
    properties.uniforms = before.uniforms; properties.uniformsList = null;
    material.onBeforeRender(renderer, main, camera, geometry, mainMesh, new THREE.Group()); handler.renderEnd();
    expect(gl.ready(after.linked)).toBe(true); expect(properties.uniforms).toBe(after.uniforms);
  }
  expect(handler.builds).toBe(2); expect(gl.writes).toBeGreaterThan(0);
  material.dispose(); geometry.dispose(); expect(gl.live.size).toBe(0);
});

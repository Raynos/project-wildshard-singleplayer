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
  readonly declared = new Map<WebGLProgram, ReadonlySet<string>>();
  missing = 0;
  writes = 0;
  getParameter(parameter: number): number { return parameter === this.MAX_UNIFORM_BUFFER_BINDINGS ? 24 : 65536; }
  createBuffer(): WebGLBuffer { const buffer = {}; this.live.add(buffer); return buffer; }
  deleteBuffer(buffer: WebGLBuffer): void { this.live.delete(buffer); }
  bindBuffer(_target: number, buffer: WebGLBuffer | null): void { this.uploadBuffer = buffer; }
  bufferData(_target: number, size: number): void {
    if (this.uploadBuffer === null) throw new Error('Allocation needs a bound buffer'); this.sizes.set(this.uploadBuffer, size);
  }
  bufferSubData(_target: number, offset: number, data: Float32Array, start = 0, length = data.length - start): void {
    if (this.uploadBuffer === null || offset + length * data.BYTES_PER_ELEMENT > (this.sizes.get(this.uploadBuffer) ?? 0)) throw new Error('Uniform upload exceeds its bound allocation');
    this.writes++;
  }
  bindBufferBase(_target: number, point: number, buffer: WebGLBuffer | null): void { this.bound.set(point, buffer); }
  getUniformBlockIndex(program: WebGLProgram, name: string): number {
    if (this.declared.has(program) && this.declared.get(program)?.has(name) !== true) { this.missing++; return this.INVALID_INDEX; }
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
    const linked = new LinkedProgram(), program = { program: linked, getUniforms: () => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })) }) };
    programs.set(name, program); properties.currentProgram = program; properties.uniforms = parameters.uniforms; properties.uniformsList = null;
    return { program, linked, uniforms: parameters.uniforms };
  }
  const before = compile(env, envMesh, 'env');
  handler.onUpdateProgram(material, before.program, properties);
  expect(Reflect.get(material, '_latestBuilder')).toBeUndefined();
  material.onBeforeRender(renderer, env, camera, geometry, envMesh, new THREE.Group()); handler.renderEnd();
  expect(gl.ready(before.linked)).toBe(true);
  const after = compile(main, mainMesh, 'composer');
  // renderer.compile has selected the program but does not issue onUpdateProgram.
  expect(gl.ready(after.linked)).toBe(false);
  const queries = vi.spyOn(gl, 'getUniformBlockIndex'), writes = gl.writes, live = gl.live.size, bindings = [...gl.bound];
  handler.prepareProgram(material, after.program);
  expect(queries.mock.calls.length).toBeGreaterThan(0);
  const prepared = queries.mock.calls.length;
  handler.prepareProgram(material, after.program);
  expect(queries).toHaveBeenCalledTimes(prepared);
  expect(gl.writes).toBe(writes); expect(gl.live.size).toBe(live); expect([...gl.bound]).toEqual(bindings);
  expect(properties.currentProgram).toBe(after.program); expect(properties.uniforms).toBe(after.uniforms);
  expect(gl.ready(after.linked)).toBe(false);
  material.onBeforeRender(renderer, main, camera, geometry, mainMesh, new THREE.Group()); handler.renderEnd();
  expect(queries).toHaveBeenCalledTimes(prepared); queries.mockRestore();
  expect(gl.ready(after.linked)).toBe(true); expect(Reflect.get(material, '_latestBuilder')).toBeUndefined();
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


test('skinned graph clones bind their own bone buffers to one shared program', () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const properties = new WeakMap<THREE.Material, { programs: Map<string, object>; currentProgram?: object; uniforms?: object; uniformsList?: unknown }>();
  const get = (material: THREE.Material): NonNullable<ReturnType<typeof properties.get>> => {
    let value = properties.get(material); if (value === undefined) { value = { programs: new Map() }; properties.set(material, value); } return value;
  };
  const gl = new Buffers();
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => gl, getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get, has: (m: THREE.Material) => properties.has(m) },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const base = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const geometry = new THREE.BoxGeometry(), count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene(), linked = new LinkedProgram();
  let program: { program: WebGLProgram; getUniforms: () => { seq: { id: string }[] } } | undefined;
  let blocks: string[] | undefined;
  for (let i = 0; i < 2; i++) {
    const material = base.clone(), bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); scene.add(mesh);
    handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    const parameters: object = {};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(parameters)) throw new Error('Missing parameters');
    handler.build(material, mesh, parameters);
    const key = material.customProgramCacheKey(), other = new THREE.SkinnedMesh(geometry, material);
    other.bind(new THREE.Skeleton([new THREE.Bone(), new THREE.Bone()]));
    handler.setObject(other, material); expect(material.customProgramCacheKey()).not.toBe(key);
    handler.setObject(mesh, material); other.skeleton.dispose();
    const names = [...parameters.vertexShader.matchAll(/uniform\s+(\w+)\s*\{/gu)].map(match => match[1] ?? '');
    expect(names.some(name => name.startsWith('engineNodeBuffer'))).toBe(true);
    if (blocks === undefined) { blocks = names; gl.declared.set(linked, new Set(names)); }
    else expect(names).toEqual(blocks);
    program ??= { program: linked, getUniforms: () => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })) }) };
    const props = get(material); props.programs.set('shared', program); props.currentProgram = program; props.uniforms = parameters.uniforms;
    // The compact stock fallback must expose the same canonical block names.
    const pending: unknown = Reflect.get(handler, 'pendingBuilds');
    if (!(pending instanceof WeakMap)) throw new Error('Missing pending builds');
    if (i === 1) pending.delete(material);
    handler.onUpdateProgram(material, program, props);
    expect(gl.missing).toBe(0); expect(gl.ready(linked)).toBe(true);
    handler.renderEnd(); material.dispose(); mesh.skeleton.dispose(); scene.remove(mesh);
  }
  base.dispose(); geometry.dispose(); expect(gl.live.size).toBe(0);
});

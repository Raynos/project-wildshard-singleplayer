import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { loadGraphBackend } from '../src/engine/render/graphBackend';

// Plain uniforms are program state: gl.uniform* writes the CURRENT program. The handler's onBeforeRender and
// onUpdateProgram run before setProgram's useProgram, so a draw's plain uniforms wait for setProgram's closing
// `p_uniforms.setValue(gl, 'modelMatrix', …)` (after useProgram): Pine Hollow's Simulator load failed on the
// INVALID_OPERATION a write to the previous draw's program left behind.
const TYPES: Record<string, number> = { float: 0x1406, vec2: 0x8b50, vec3: 0x8b51, vec4: 0x8b52, mat3: 0x8b5b, mat4: 0x8b5c, int: 0x1404, uint: 0x1405, bool: 0x8b56 };
class LinkedProgram { readonly label = 'linked'; }
class PlainGl {
  readonly ACTIVE_UNIFORMS = 0x8b86;
  readonly sent: string[] = [];
  active: { name: string; type: number; size: number }[] = [];
  getParameter(): number { return 24; }
  getProgramParameter(): number { return this.active.length; }
  getActiveUniform(_p: WebGLProgram, i: number): WebGLActiveInfo | null { const a = this.active[i]; return a === undefined ? null : { ...a }; }
  getUniformLocation(_p: WebGLProgram, name: string): WebGLUniformLocation { return { name }; }
  private log(at: WebGLUniformLocation | null): void { this.sent.push(String(Reflect.get(at ?? {}, 'name'))); }
  uniform1fv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniform2fv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniform3fv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniform4fv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniform1iv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniform1uiv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniformMatrix3fv(at: WebGLUniformLocation | null): void { this.log(at); }
  uniformMatrix4fv(at: WebGLUniformLocation | null): void { this.log(at); }
}
vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
vi.stubGlobal('WebGLProgram', LinkedProgram);
vi.stubGlobal('WebGL2RenderingContext', PlainGl);
afterAll(() => { vi.unstubAllGlobals(); });

test('a draw sends its plain uniforms only once setProgram has its program in use', async () => {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const gl = new PlainGl(), programs = new Map<string, object>();
  const properties: { programs: typeof programs; currentProgram?: object; uniforms?: object; uniformsList?: unknown; __version?: number } = { programs };
  for (const [key, value] of Object.entries({
    extensions: { has: () => false, get: () => null }, getContext: (): PlainGl => gl, getRenderTarget: (): null => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => properties, has: () => true },
    setNodesHandler: (handler: { setRenderer: (r: unknown) => void }): void => { handler.setRenderer(renderer); },
  })) Reflect.set(renderer, key, value);
  const handler = await loadGraphBackend(renderer);
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'unlit', params: { tint: { type: 'vec3', value: [0.5, 0.5, 0.5] } },
    nodes: { tint: { op: 'param', param: 'tint' } },
    stages: { surface: { colour: 'tint' } }, effectState: { fog: false } });
  const material = compiled.material;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(mesh);
  handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  handler.build(material, mesh, parameters);
  gl.active = [...parameters.vertexShader.matchAll(/^uniform (?:(?:lowp|mediump|highp) )?(\w+) (\w+);/gmu)].flatMap(([, type, name]) => {
    const code = type === undefined ? undefined : TYPES[type];
    return code === undefined || name === undefined || name === 'modelMatrix' ? [] : [{ name, type: code, size: 1 }];
  });
  expect(gl.active.length).toBeGreaterThan(0);
  // three's WebGLProgram: its uniform setter is what setProgram calls after useProgram
  const calls: unknown[] = [], setter = { setValue: (_gl: unknown, name: unknown, _value: unknown): void => { calls.push(name); } };
  const program = { program: new LinkedProgram(), getUniforms: () => setter };
  programs.set('only', program);
  properties.currentProgram = program; properties.uniforms = parameters.uniforms; properties.__version = material.version;
  handler.onUpdateProgram(material, program, properties);
  material.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh, new THREE.Group());
  expect(gl.sent).toEqual([]);
  program.getUniforms().setValue(gl, 'modelViewMatrix', mesh.modelViewMatrix);
  expect(gl.sent).toEqual([]);
  program.getUniforms().setValue(gl, 'modelMatrix', mesh.matrixWorld);
  expect(gl.sent.length).toBeGreaterThan(0);
  expect(calls).toEqual(['modelViewMatrix', 'modelMatrix']);
  handler.renderEnd(); material.dispose();
});

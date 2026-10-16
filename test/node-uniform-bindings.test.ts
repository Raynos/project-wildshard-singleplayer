import { expect, test } from 'vitest';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { modelWorldMatrix } from 'three/tsl';
import { NodeUniformBuffers, type BlockGroup } from '../src/engine/render/nodes/nodeUniformBuffers';
import { classicModelUniform } from '../src/engine/render/nodes/nodeObjectUniforms';

class Gl {
  readonly MAX_UNIFORM_BUFFER_BINDINGS = 35375; readonly UNIFORM_BUFFER = 35345;
  readonly DYNAMIC_DRAW = 35048; readonly INVALID_INDEX = 4294967295;
  readonly bindings = new Map<number, WebGLBuffer | null>();
  readonly values = new Map<WebGLBuffer, Map<number, number[]>>();
  baseCalls = 0; writes = 0;
  private current: WebGLBuffer | null = null;
  getParameter(): number { return 24; }
  createBuffer(): WebGLBuffer { const buffer = {}; this.values.set(buffer, new Map()); return buffer; }
  deleteBuffer(buffer: WebGLBuffer): void { this.values.delete(buffer); }
  bindBuffer(_target: number, buffer: WebGLBuffer | null): void { this.current = buffer; }
  bufferData(): void { /* Allocations are retained in values. */ }
  bufferSubData(_target: number, offset: number, values: Float32Array, start = 0, length = values.length - start): void {
    if (this.current === null) throw new Error('Unbound upload');
    this.values.get(this.current)?.set(offset, Array.from(values.subarray(start, start + length))); this.writes++;
  }
  bindBufferBase(_target: number, point: number, buffer: WebGLBuffer | null): void { this.bindings.set(point, buffer); this.baseCalls++; }
  getUniformBlockIndex(): number { return 0; }
  uniformBlockBinding(): void { /* Each fake program has one block. */ }
}

test('keeps extensions first, removes only the stock matrix and preserves custom and buffer layouts', () => {
  const stock: unknown = Reflect.get(modelWorldMatrix, 'uniformNode');
  const original = '#extension GL_ANGLE_multi_draw : require\nprecision highp float;\nlayout( std140 ) uniform object {\nmat4 nodeUniform0;\nmat4 nodeUniform1;\n};\nvoid main() { gl_Position = nodeUniform0 * nodeUniform1 * vec4(1.0); }';
  const parameters = {vertexShader: original, fragmentShader: original};
  const own = {node: stock, name: 'nodeUniform0', type: 'mat4', value: new Matrix4()};
  const custom = {node: {}, name: 'nodeUniform1', type: 'mat4', value: new Matrix4()};
  const group: BlockGroup = {name: 'object', uniforms: [[own, custom]]};
  const bones: BlockGroup = {name: 'boneBuffer', uniforms: [{value: new Float32Array(16)}]};
  const result = classicModelUniform(parameters, [group, bones]);
  expect(parameters.vertexShader.startsWith('#extension')).toBe(true);
  expect(parameters.vertexShader.indexOf('precision')).toBeLessThan(parameters.vertexShader.indexOf('uniform highp mat4 modelMatrix;'));
  expect(parameters.vertexShader).toContain('gl_Position = modelMatrix * nodeUniform1');
  expect(parameters.fragmentShader).toBe(parameters.vertexShader);
  expect(group.uniforms).toEqual([custom]); expect(result[1]).toBe(bones);
  const untouched = {vertexShader: original, fragmentShader: original};
  classicModelUniform(untouched, [{name: 'object', uniforms: [custom]}]);
  expect(untouched.vertexShader).toBe(original);
});

test('coalesces dirty slots while retaining padding, unchanged gaps and live array edits', () => {
  const gl = new Gl(), blocks = new NodeUniformBuffers(gl), program: WebGLProgram = {};
  const a = {value: 1}, vector = {value: new Vector3(2, 3, 4)}, b = {value: 5};
  const matrix = {value: new Matrix3().set(1, 2, 3, 4, 5, 6, 7, 8, 9)};
  const array = {value: [10, 11]}, typed = {value: new Float32Array([12, 13, 14, 15])};
  const group = {name: 'object', uniforms: [a, vector, b, matrix, array, typed]};
  blocks.bind(program, [group]);
  const buffer = gl.bindings.get(23);
  if (buffer === undefined || buffer === null) throw new Error('Missing buffer');
  const uploads = gl.values.get(buffer);
  expect(gl.writes).toBe(1);
  expect(uploads?.get(0)).toEqual([1, 0, 0, 0, 2, 3, 4, 5,
    1, 4, 7, 0, 2, 5, 8, 0, 3, 6, 9, 0, 10, 11, 0, 0, 12, 13, 14, 15]);
  a.value = 20; b.value = 21;
  blocks.bind(program, [group]);
  expect(gl.writes).toBe(2);
  expect(uploads?.get(0)?.slice(0, 8)).toEqual([20, 0, 0, 0, 2, 3, 4, 21]);
  matrix.value.elements[1] = 30; array.value[1] = 31; typed.value[2] = 32;
  blocks.bind(program, [group]);
  expect(gl.writes).toBe(3);
  expect(uploads?.get(32)).toEqual([1, 30, 7, 0, 2, 5, 8, 0, 3, 6, 9, 0, 10, 31, 0, 0, 12, 13, 32, 15]);
  array.value = [40, 41];
  blocks.bind(program, [group]);
  expect(uploads?.get(80)).toEqual([40, 41, 0, 0, 12, 13, 32, 15]);
});

test('retains consecutive bindings while still uploading live changes and restoring displaced groups', () => {
  const gl = new Gl(), blocks = new NodeUniformBuffers(gl), a = { value: new Matrix4() }, b = { value: 7 };
  const render: BlockGroup = { name: 'render', uniforms: [a] }, other: BlockGroup = { name: 'object', uniforms: [b] };
  const first: WebGLProgram = {}, second: WebGLProgram = {};
  blocks.bind(first, [render]); const buffer = gl.bindings.get(23);
  expect(gl.baseCalls).toBe(1); expect(gl.writes).toBe(1);
  blocks.bind(first, [render]); blocks.bind(second, [render]);
  expect(gl.baseCalls).toBe(1); expect(gl.writes).toBe(1);
  a.value.makeTranslation(5, 6, 7); blocks.bind(second, [render]);
  expect(gl.baseCalls).toBe(1); expect(gl.writes).toBe(2);
  if (buffer === undefined || buffer === null) throw new Error('Missing live buffer');
  expect(gl.values.get(buffer)?.get(0)?.slice(12, 15)).toEqual([5, 6, 7]);
  blocks.bind(first, [other]); expect(gl.bindings.get(23)).not.toBe(buffer);
  blocks.bind(first, [render]); expect(gl.bindings.get(23)).toBe(buffer); expect(gl.baseCalls).toBe(3);
  // A classic draw or nested pass may have overwritten the indexed binding.
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 23, null); blocks.invalidateBindings(); blocks.bind(first, [render]);
  expect(gl.bindings.get(23)).toBe(buffer); expect(gl.baseCalls).toBe(5);
  blocks.release(render); blocks.bind(first, [render]);
  expect(gl.bindings.get(23)).not.toBe(buffer); expect(gl.baseCalls).toBe(6);
});

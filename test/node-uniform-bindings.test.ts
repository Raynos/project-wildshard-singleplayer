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

test.each([false, true])('coalesces dirty slots while retaining padding, unchanged gaps and live array edits (direct writes %s)', (direct) => {
  const gl = new Gl(), blocks = new NodeUniformBuffers(gl), program: WebGLProgram = {};
  blocks.directWrites = direct;
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

// Debug ▸ Performance ▸ Direct block writes (sp-o286): a write skipped or made in place never leaves the buffer stale,
// including across a toggle of the row.
test('direct block writes upload exactly what changed and survive the row toggling', () => {
  const gl = new Gl(), blocks = new NodeUniformBuffers(gl), program: WebGLProgram = {};
  const matrix = { value: new Matrix4() }, vector = { value: new Vector3(1, 2, 3) }, scalar = { value: 0.5 };
  const group: BlockGroup = { name: 'object', uniforms: [matrix, vector, scalar] };
  blocks.directWrites = true;
  blocks.bind(program, [group]);
  const buffer = gl.bindings.get(23);
  if (buffer === undefined || buffer === null) throw new Error('Missing buffer');
  const uploads = gl.values.get(buffer);
  expect(gl.writes).toBe(1);
  blocks.bind(program, [group]);
  expect(gl.writes).toBe(1);
  // a change below float precision uploads nothing: the GPU already holds those bytes
  scalar.value = 0.5 + 1e-12; blocks.bind(program, [group]);
  expect(gl.writes).toBe(1);
  matrix.value.makeTranslation(4, 5, 6); blocks.bind(program, [group]);
  expect(gl.writes).toBe(2);
  expect(uploads?.get(0)?.slice(12, 15)).toEqual([4, 5, 6]);
  // row off: the stale kept copy (identity) must not hide the change back to it
  blocks.directWrites = false; matrix.value.identity(); blocks.bind(program, [group]);
  expect(gl.writes).toBe(3);
  expect(uploads?.get(0)?.slice(12, 16)).toEqual([0, 0, 0, 1]);
  // row on again: values written by the generic path are already in the floats
  blocks.directWrites = true; blocks.bind(program, [group]);
  expect(gl.writes).toBe(3);
  vector.value.set(7, 8, 9); blocks.bind(program, [group]);
  expect(gl.writes).toBe(4);
  expect(uploads?.get(64)?.slice(0, 3)).toEqual([7, 8, 9]);
});

// Debug ▸ Performance ▸ Uniform block ring (sp-o290): a changed block is written whole at the ring's next aligned offset
// and bound there, never over bytes an earlier draw still reads; an unchanged block keeps its placement until the ring
// laps it, and turning the ring off rewrites the block's own buffer with every value it missed.
class RingGl extends Gl {
  readonly UNIFORM_BUFFER_OFFSET_ALIGNMENT = 35380;
  readonly ranges = new Map<number, { buffer: WebGLBuffer | null; offset: number; size: number }>();
  rangeCalls = 0;
  override getParameter(name?: number): number { return name === this.UNIFORM_BUFFER_OFFSET_ALIGNMENT ? 256 : 24; }
  bindBufferRange(_target: number, point: number, buffer: WebGLBuffer | null, offset: number, size: number): void {
    this.ranges.set(point, { buffer, offset, size }); this.bindings.set(point, buffer); this.rangeCalls++;
  }
}

test('the block ring writes each changed block at a fresh aligned offset and binds that range', () => {
  const gl = new RingGl(), blocks = new NodeUniformBuffers(gl), program: WebGLProgram = {};
  const model = { value: 1 }, fixed = { value: 9 };
  const object: BlockGroup = { name: 'object', uniforms: [model] }, render: BlockGroup = { name: 'render', uniforms: [fixed] };
  blocks.ring = true;
  expect(blocks.ring).toBe(true);
  // two draws of one shared object block: two placements, the second never over the first
  blocks.bind(program, [object, render]);
  const ring = gl.ranges.get(23)?.buffer;
  if (ring === undefined || ring === null) throw new Error('Missing ring');
  expect(gl.ranges.get(23)).toEqual({ buffer: ring, offset: 0, size: 16 });
  expect(gl.ranges.get(22)).toEqual({ buffer: ring, offset: 256, size: 16 });
  model.value = 2;
  blocks.bind(program, [object, render]);
  expect(gl.ranges.get(23)).toEqual({ buffer: ring, offset: 512, size: 16 });
  expect(gl.ranges.get(22)?.offset).toBe(256);
  const values = gl.values.get(ring);
  expect(values?.get(0)).toEqual([1, 0, 0, 0]); expect(values?.get(512)).toEqual([2, 0, 0, 0]);
  // an unchanged draw writes and binds nothing
  const writes = gl.writes, calls = gl.rangeCalls;
  blocks.bind(program, [object, render]);
  expect(gl.writes).toBe(writes); expect(gl.rangeCalls).toBe(calls);
  // a render boundary rebinds the same ranges without writing
  blocks.invalidateBindings(); blocks.bind(program, [object, render]);
  expect(gl.writes).toBe(writes); expect(gl.rangeCalls).toBe(calls + 2);
  // a full lap: the object block wraps to the ring's start and the unchanged render block is placed again
  for (let i = 0; i < 4 * 1024 * 4; i++) { model.value = 10 + i; blocks.bind(program, [object, render]); }
  expect(gl.ranges.get(22)?.offset).not.toBe(256);
  expect(values?.get(gl.ranges.get(22)?.offset ?? -1)).toEqual([9, 0, 0, 0]);
  expect(values?.get(gl.ranges.get(23)?.offset ?? -1)).toEqual([model.value, 0, 0, 0]);
  // the ring off: the block's own buffer gets every value it missed, bound whole again
  blocks.ring = false;
  blocks.bind(program, [object, render]);
  const own = gl.bindings.get(23);
  if (own === undefined || own === null) throw new Error('Missing own buffer');
  expect(own).not.toBe(ring);
  expect(gl.values.get(own)?.get(0)).toEqual([model.value, 0, 0, 0]);
  // a recorder without bindBufferRange never rings
  const plain = new NodeUniformBuffers(new Gl()); plain.ring = true;
  expect(plain.ring).toBe(false);
});

import { expect, test } from 'vitest';
import { Matrix3, Vector3, Vector4 } from 'three';
import { NodePlainUniforms, plainUniformShader, type PlainUniformGl } from '../src/engine/render/nodes/nodePlainUniforms';

const FLOAT = 0x1406, VEC3 = 0x8b51, VEC4 = 0x8b52, MAT3 = 0x8b5b, UINT = 0x1405;
/** a linked program's active uniforms and every upload made to it */
class Gl implements PlainUniformGl {
  readonly ACTIVE_UNIFORMS = 0x8b86;
  readonly sent: [string, number[]][] = [];
  constructor(private readonly active: readonly { name: string; type: number; size: number }[]) {}
  getProgramParameter(): number { return this.active.length; }
  getActiveUniform(_p: WebGLProgram, i: number): WebGLActiveInfo | null { const a = this.active[i]; return a === undefined ? null : { ...a }; }
  getUniformLocation(_p: WebGLProgram, name: string): WebGLUniformLocation { return { name }; }
  private log(at: WebGLUniformLocation | null, data: Iterable<number>): void { this.sent.push([String(Reflect.get(at ?? {}, 'name')), Array.from(data)]); }
  uniform1fv(at: WebGLUniformLocation | null, d: Float32List): void { this.log(at, d); }
  uniform2fv(at: WebGLUniformLocation | null, d: Float32List): void { this.log(at, d); }
  uniform3fv(at: WebGLUniformLocation | null, d: Float32List): void { this.log(at, d); }
  uniform4fv(at: WebGLUniformLocation | null, d: Float32List): void { this.log(at, d); }
  uniform1iv(at: WebGLUniformLocation | null, d: Int32List): void { this.log(at, d); }
  uniform2iv(at: WebGLUniformLocation | null, d: Int32List): void { this.log(at, d); }
  uniform3iv(at: WebGLUniformLocation | null, d: Int32List): void { this.log(at, d); }
  uniform4iv(at: WebGLUniformLocation | null, d: Int32List): void { this.log(at, d); }
  uniform1uiv(at: WebGLUniformLocation | null, d: Uint32List): void { this.log(at, d); }
  uniform2uiv(at: WebGLUniformLocation | null, d: Uint32List): void { this.log(at, d); }
  uniform3uiv(at: WebGLUniformLocation | null, d: Uint32List): void { this.log(at, d); }
  uniform4uiv(at: WebGLUniformLocation | null, d: Uint32List): void { this.log(at, d); }
  uniformMatrix2fv(at: WebGLUniformLocation | null, _t: boolean, d: Float32List): void { this.log(at, d); }
  uniformMatrix3fv(at: WebGLUniformLocation | null, _t: boolean, d: Float32List): void { this.log(at, d); }
  uniformMatrix4fv(at: WebGLUniformLocation | null, _t: boolean, d: Float32List): void { this.log(at, d); }
}

const VERTEX = 'uniform highp mat4 modelMatrix;\nlayout( std140 ) uniform object {\n\tvec3 nodeUniform0;\n\tmat3 nodeUniform4;\n\tuint nodeUniform5;\n};\nlayout( std140 ) uniform render {\n\tfloat cameraNear;\n};\nvoid main() { gl_Position = vec4(nodeUniform0, cameraNear); }';
const FRAGMENT = 'layout( std140 ) uniform object {\n\tvec3 nodeUniform0;\n\tmat3 nodeUniform4;\n\tuint nodeUniform5;\n};\nuniform engineNodeBuffer0 {\n\tvec4 engineNodeBufferData0[2];\n};\nvoid main() { }';

test('rewrites every std140 block as plain uniforms and names each group member in order', () => {
  const object = { name: 'object', uniforms: [{ value: new Vector3() }, { value: new Matrix3() }, { value: 0 }] };
  const render = { name: 'render', uniforms: [{ value: 0.1 }] }, buffer = { name: 'engineNodeBuffer0', uniforms: [{ value: [new Vector4(), new Vector4()] }] };
  const shaders = { vertexShader: VERTEX, fragmentShader: FRAGMENT };
  const names = plainUniformShader(shaders, [object, render, buffer]);
  expect(shaders.vertexShader).not.toContain('{\n\t');
  expect(shaders.vertexShader).toContain('uniform highp mat4 modelMatrix;\nuniform vec3 nodeUniform0;\nuniform mat3 nodeUniform4;\nuniform uint nodeUniform5;\nuniform float cameraNear;');
  expect(shaders.fragmentShader).toContain('uniform vec4 engineNodeBufferData0[2];');
  expect(shaders.vertexShader).toContain('void main() { gl_Position = vec4(nodeUniform0, cameraNear); }');
  expect(names.get(object)).toEqual(['nodeUniform0', 'nodeUniform4', 'nodeUniform5']);
  expect(names.get(buffer)).toEqual(['engineNodeBufferData0']);
  expect(() => plainUniformShader({ vertexShader: VERTEX, fragmentShader: FRAGMENT }, [{ name: 'object', uniforms: [{ value: 0 }] }])).toThrow(/3 members for 1/u);
});

test('uploads each member only when its image differs from what the program holds', () => {
  const gl = new Gl([{ name: 'nodeUniform0', type: VEC3, size: 1 }, { name: 'nodeUniform4', type: MAT3, size: 1 }, { name: 'nodeUniform5', type: UINT, size: 1 },
    { name: 'cameraNear', type: FLOAT, size: 1 }, { name: 'engineNodeBufferData0[0]', type: VEC4, size: 2 }]);
  const plain = new NodePlainUniforms(gl), program: WebGLProgram = {};
  const tint = new Vector3(1, 2, 3), normal = new Matrix3().set(1, 2, 3, 4, 5, 6, 7, 8, 9);
  const object = { name: 'object', uniforms: [{ value: tint }, { value: normal }, { value: 7 }] };
  const bands = [new Vector4(1, 2, 3, 4), new Vector4(5, 6, 7, 8)];
  const buffer = { name: 'engineNodeBuffer0', uniforms: [{ value: bands }] };
  plain.declare({ vertexShader: VERTEX, fragmentShader: FRAGMENT }, [object, buffer]);
  plain.bind(program, [object, buffer]);
  expect(gl.sent.map(([name]) => name)).toEqual(['nodeUniform0', 'nodeUniform4', 'nodeUniform5', 'engineNodeBufferData0']);
  expect(gl.sent[1]?.[1]).toEqual(normal.toArray());
  expect(gl.sent[3]?.[1]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  gl.sent.length = 0;
  plain.bind(program, [object, buffer]);
  expect(gl.sent).toEqual([]);
  tint.y = 9; bands[1]?.setW(0);
  plain.bind(program, [object, buffer]);
  expect(gl.sent).toEqual([['nodeUniform0', [1, 9, 3]], ['engineNodeBufferData0', [1, 2, 3, 4, 5, 6, 7, 0]]]);
});

test('a render group compares once per camera pass; another material on the same program sends only its differences', () => {
  const gl = new Gl([{ name: 'nodeUniform0', type: VEC3, size: 1 }, { name: 'nodeUniform4', type: MAT3, size: 1 }, { name: 'nodeUniform5', type: UINT, size: 1 }, { name: 'cameraNear', type: FLOAT, size: 1 }]);
  const plain = new NodePlainUniforms(gl), program: WebGLProgram = {};
  const near = { value: 0.1 }, render = { name: 'render', uniforms: [near] };
  const a = { name: 'object', uniforms: [{ value: new Vector3(1, 1, 1) }, { value: new Matrix3() }, { value: 2 }] };
  const b = { name: 'object', uniforms: [{ value: new Vector3(1, 1, 1) }, { value: new Matrix3() }, { value: 3 }] };
  plain.declare({ vertexShader: VERTEX, fragmentShader: FRAGMENT }, [a, render]);
  plain.declare({ vertexShader: VERTEX, fragmentShader: FRAGMENT }, [b]);
  plain.bind(program, [a, render], 1);
  gl.sent.length = 0;
  near.value = 0.2; plain.bind(program, [a, render], 1);
  expect(gl.sent).toEqual([]);
  plain.bind(program, [a, render], 2);
  expect(gl.sent.map(([name]) => name)).toEqual(['cameraNear']);
  gl.sent.length = 0;
  plain.bind(program, [b], 2);
  expect(gl.sent).toEqual([['nodeUniform5', [3]]]);
});

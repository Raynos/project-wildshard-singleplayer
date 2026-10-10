/**
 * The node materials' uniform blocks, bound per draw (SHARD-PLATFORM SF59; G169 pastel plain and ink valley).
 *
 * three's GLSL node builder puts every non-texture uniform of a node program into std140 uniform blocks, one per uniform
 * group (object, render, frame…), and the stock `WebGLNodesHandler` hands them to the classic renderer as
 * `material.uniformsGroups`. The classic renderer gives every such group its own GLOBAL binding point for as long as the
 * group lives (WebGLUniformsGroups), and a WebGL 2 context has only `MAX_UNIFORM_BUFFER_BINDINGS` of them (24 on many
 * GPUs): a page with a dozen graph programs ran out ('Maximum number of simultaneously usable uniforms groups
 * reached'), the overflow shared binding point 0, and draws read another program's block ('uniform buffer that is too
 * small'; the ink valley's ground grey, its hut black).
 *
 * `NodeUniformBuffers` owns those blocks instead: each group keeps its own buffer and its std140 layout (three's rules,
 * WebGLUniformsGroups.prepareUniformsGroup), and each draw binds its program's few blocks to the top binding points
 * (`MAX_UNIFORM_BUFFER_BINDINGS - 1` downwards, clear of the low points the classic renderer hands out from 0), so any
 * number of node programs share a handful of points. A value is written only when it changed since the buffer last saw it.
 */

/** the WebGL 2 calls the blocks make (a context, or a test's recorder) */
export type UniformBlockGl = Pick<WebGL2RenderingContext, 'MAX_UNIFORM_BUFFER_BINDINGS' | 'UNIFORM_BUFFER' | 'DYNAMIC_DRAW' | 'INVALID_INDEX'
  | 'getParameter' | 'createBuffer' | 'deleteBuffer' | 'bindBuffer' | 'bufferData' | 'bufferSubData' | 'bindBufferBase' | 'getUniformBlockIndex' | 'uniformBlockBinding'>;

/** one uniform as a group holds it: three's `Uniform` / a node's `NodeUniform` (its `value` read live) */
interface BlockUniform { readonly value: unknown }
/** a uniform group as the node handler builds it (three's `UniformsGroup`) */
export interface BlockGroup { readonly name: string; readonly uniforms: readonly (BlockUniform | readonly BlockUniform[])[] }

/** where one uniform value lives in its block, and what it last wrote */
interface Slot { readonly uniform: BlockUniform; readonly element: number; readonly offset: number; readonly data: Float32Array; last: unknown }
/** a group's buffer and layout */
interface Block { readonly buffer: WebGLBuffer; readonly size: number; readonly slots: readonly Slot[] }

const CHUNK = 16;

const isObject = (v: unknown): v is object => typeof v === 'object' && v !== null;
const flag = (v: object, k: string): boolean => Reflect.get(v, k) === true;

/** std140 boundary and storage, in bytes, of one value (three's getUniformSize) */
export function std140Size(value: unknown): { readonly boundary: number; readonly storage: number } {
  if (typeof value === 'number' || typeof value === 'boolean') return { boundary: 4, storage: 4 };
  if (ArrayBuffer.isView(value)) return { boundary: 16, storage: value.byteLength };
  if (!isObject(value)) throw new Error('node uniform block: an unsupported uniform value');
  if (flag(value, 'isVector2')) return { boundary: 8, storage: 8 };
  if (flag(value, 'isVector3') || flag(value, 'isColor')) return { boundary: 16, storage: 12 };
  if (flag(value, 'isVector4')) return { boundary: 16, storage: 16 };
  if (flag(value, 'isMatrix3')) return { boundary: 48, storage: 48 };
  if (flag(value, 'isMatrix4')) return { boundary: 64, storage: 64 };
  throw new Error('node uniform block: an unsupported uniform value');
}

/** the values a uniform contributes (an array uniform contributes each element) */
const valuesOf = (u: BlockUniform): readonly unknown[] => (Array.isArray(u.value) ? u.value : [u.value]);

/** a group's std140 layout: each value's byte offset and the block's padded size (WebGLUniformsGroups.prepareUniformsGroup) */
export function std140Layout(group: BlockGroup): { readonly size: number; readonly slots: readonly { readonly uniform: BlockUniform; readonly element: number; readonly offset: number; readonly storage: number }[] } {
  let offset = 0;
  const slots: { uniform: BlockUniform; element: number; offset: number; storage: number }[] = [];
  for (const entry of group.uniforms) {
    const list: readonly BlockUniform[] = Array.isArray(entry) ? entry : [entry];
    for (const uniform of list) {
      valuesOf(uniform).forEach((value, element) => {
        const { boundary, storage } = std140Size(value);
        const inChunk = offset % CHUNK, padding = inChunk % boundary, start = inChunk + padding;
        offset += padding;
        if (start !== 0 && CHUNK - start < storage) offset += CHUNK - start;
        slots.push({ uniform, element, offset, storage });
        offset += storage;
      });
    }
  }
  if (offset % CHUNK > 0) offset += CHUNK - (offset % CHUNK);
  return { size: offset, slots };
}

/** write one value into its slot's floats (three's writeUniformValue: a mat3 as three padded columns) */
function write(value: unknown, data: Float32Array): void {
  if (typeof value === 'number') { data[0] = value; return; }
  if (typeof value === 'boolean') { data[0] = value ? 1 : 0; return; }
  if (ArrayBuffer.isView(value)) { data.set(new Float32Array(value.buffer, value.byteOffset, data.length)); return; }
  if (!isObject(value)) return;
  if (flag(value, 'isMatrix3')) {
    const e: unknown = Reflect.get(value, 'elements');
    if (!Array.isArray(e)) return;
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) data[c * 4 + r] = Number(e[c * 3 + r]);
    data[3] = 0; data[7] = 0; data[11] = 0;
    return;
  }
  const toArray: unknown = Reflect.get(value, 'toArray');
  if (typeof toArray === 'function') Reflect.apply(toArray, value, [data, 0]);
}

/**
 * a copy to compare against next time: a number as itself, an object copied into the last copy (one clone per slot, as
 * WebGLUniformsGroups caches), a typed array not at all (it always rewrites)
 */
function remember(last: unknown, value: unknown): unknown {
  if (!isObject(value) || ArrayBuffer.isView(value)) return value;
  const copy: unknown = isObject(last) ? Reflect.get(last, 'copy') : undefined;
  if (isObject(last) && typeof copy === 'function') { Reflect.apply(copy, last, [value]); return last; }
  const clone: unknown = Reflect.get(value, 'clone');
  return typeof clone === 'function' ? Reflect.apply(clone, value, []) : value;
}
function changed(last: unknown, value: unknown): boolean {
  if (last === undefined || ArrayBuffer.isView(value)) return true;
  if (!isObject(value)) return last !== value;
  if (!isObject(last)) return true;
  const equals: unknown = Reflect.get(last, 'equals');
  return typeof equals === 'function' ? Reflect.apply(equals, last, [value]) !== true : true;
}

/** the node programs' uniform blocks on one WebGL 2 context, bound per draw (the module comment says why) */
export class NodeUniformBuffers {
  private readonly blocks = new WeakMap<object, Block>();
  /** each program's block indices by block name, and the binding point each block index was last pointed at */
  private readonly programs = new WeakMap<WebGLProgram, { readonly index: Map<string, number>; readonly point: Map<number, number> }>();
  private readonly top: number;
  private readonly gl: UniformBlockGl;

  constructor(gl: UniformBlockGl) {
    this.gl = gl;
    const max: unknown = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
    this.top = typeof max === 'number' && max > 0 ? max - 1 : 23;
  }

  /** upload what changed in `groups` and bind them, in order, to the top binding points for `program` (a linked GL program) */
  bind(program: WebGLProgram, groups: readonly BlockGroup[]): void {
    const gl = this.gl;
    let known = this.programs.get(program);
    if (known === undefined) { known = { index: new Map(), point: new Map() }; this.programs.set(program, known); }
    groups.forEach((group, i) => {
      const block = this.block(group);
      this.upload(block);
      const point = this.top - i;
      gl.bindBufferBase(gl.UNIFORM_BUFFER, point, block.buffer);
      let index = known.index.get(group.name);
      if (index === undefined) { index = gl.getUniformBlockIndex(program, group.name); known.index.set(group.name, index); }
      if (index === gl.INVALID_INDEX || known.point.get(index) === point) return;
      gl.uniformBlockBinding(program, index, point);
      known.point.set(index, point);
    });
  }

  /** free a group's buffer (its material was disposed) */
  release(group: object): void {
    const block = this.blocks.get(group);
    if (block === undefined) return;
    this.gl.deleteBuffer(block.buffer);
    this.blocks.delete(group);
  }

  private block(group: BlockGroup): Block {
    const known = this.blocks.get(group);
    if (known !== undefined) return known;
    const gl = this.gl, layout = std140Layout(group), buffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, layout.size, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    const block: Block = { buffer, size: layout.size, slots: layout.slots.map((s) => ({ uniform: s.uniform, element: s.element, offset: s.offset, data: new Float32Array(s.storage / 4), last: undefined })) };
    this.blocks.set(group, block);
    return block;
  }

  private upload(block: Block): void {
    const gl = this.gl;
    let bound = false;
    for (const slot of block.slots) {
      const value = valuesOf(slot.uniform)[slot.element];
      if (!changed(slot.last, value)) continue;
      slot.last = remember(slot.last, value);
      write(value, slot.data);
      if (!bound) { gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer); bound = true; }
      gl.bufferSubData(gl.UNIFORM_BUFFER, slot.offset, slot.data);
    }
    if (bound) gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }
}

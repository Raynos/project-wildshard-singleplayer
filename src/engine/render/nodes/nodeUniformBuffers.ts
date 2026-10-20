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
 * number of node programs share a handful of points. A value is written only when the bits it would write differ from
 * the bits its buffer holds.
 */

import { Color, Matrix4, Vector2, Vector3, Vector4 } from 'three';

/** the WebGL 2 calls the blocks make (a context, or a test's recorder) */
export type UniformBlockGl = Pick<WebGL2RenderingContext, 'MAX_UNIFORM_BUFFER_BINDINGS' | 'UNIFORM_BUFFER' | 'DYNAMIC_DRAW' | 'INVALID_INDEX'
  | 'getParameter' | 'createBuffer' | 'deleteBuffer' | 'bindBuffer' | 'bufferData' | 'bufferSubData' | 'bindBufferBase' | 'getUniformBlockIndex' | 'uniformBlockBinding'>;

/** one uniform as a group holds it: three's `Uniform` / a node's `NodeUniform` (its `value` read live) */
interface BlockUniform { readonly value: unknown }
/** a uniform group as the node handler builds it (three's `UniformsGroup`) */
export interface BlockGroup { readonly name: string; readonly uniforms: readonly (BlockUniform | readonly BlockUniform[])[] }

/** where one uniform value lives in its block */
interface Slot {
  readonly uniform: BlockUniform; readonly element: number; readonly offset: number; readonly data: Float32Array;
  /** typed values compare as bits: this slot's bits, and the last typed value's bit view (made once per value, not per draw) */
  readonly bits: Uint32Array; source: ArrayBufferView | null; sourceBits: Uint32Array | null;
}
/** a group's buffer and layout; `pass` is the camera pass a pass-scoped block last uploaded in */
interface Block { readonly buffer: WebGLBuffer; readonly data: Float32Array; readonly slots: readonly Slot[]; readonly passScoped: boolean; pass: number }

/**
 * three's shared groups whose uniforms only move at a render or frame update (the camera, the clock, the lights): their
 * values are fixed within one camera pass, so a block of one uploads once per pass, not on every draw of its material.
 */
const PASS_GROUPS: ReadonlySet<string> = new Set(['render', 'frame']);

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

/** one value's upload image, staged here and compared with its slot's image before anything is written */
const scratch = new Float32Array(16);
const scratchBits = new Uint32Array(scratch.buffer);
/** a scratch view of `length` floats (one per length, made once) */
const scratchViews: Float32Array[] = [];
function scratchOf(length: number): Float32Array {
  let view = scratchViews[length];
  if (view === undefined) { view = new Float32Array(scratch.buffer, 0, length); scratchViews[length] = view; }
  return view;
}

/**
 * Stage `value`'s upload image (exactly what `write` puts in its slot) in `scratch`: true when it was staged, false for a
 * value `write` leaves alone. three's own value classes take a direct path; anything else goes through `write`.
 */
function stage(value: unknown, length: number): boolean {
  if (typeof value === 'number') { scratch[0] = value; return true; }
  if (typeof value === 'boolean') { scratch[0] = value ? 1 : 0; return true; }
  if (value instanceof Matrix4) { const e = value.elements; for (let i = 0; i < 16; i++) scratch[i] = e[i] ?? 0; return true; }
  if (value instanceof Vector3) { scratch[0] = value.x; scratch[1] = value.y; scratch[2] = value.z; return true; }
  if (value instanceof Color) { scratch[0] = value.r; scratch[1] = value.g; scratch[2] = value.b; return true; }
  if (value instanceof Vector2) { scratch[0] = value.x; scratch[1] = value.y; return true; }
  if (value instanceof Vector4) { scratch[0] = value.x; scratch[1] = value.y; scratch[2] = value.z; scratch[3] = value.w; return true; }
  if (!isObject(value) || length > scratch.length) return false;
  write(value, scratchOf(length));
  return true;
}

/** Compare the exact upload image, including signed zero and NaN payloads.
 * The slot already retains these bytes, so mutable arrays need no clone. */
function sameBytes(value: ArrayBufferView, slot: Slot): boolean {
  let next = slot.sourceBits;
  if (slot.source !== value || next === null) { next = new Uint32Array(value.buffer, value.byteOffset, slot.data.length); slot.source = value; slot.sourceBits = next; }
  const previous = slot.bits;
  for (let i = 0; i < next.length; i++) if (next[i] !== previous[i]) return false;
  return true;
}

/** the node programs' uniform blocks on one WebGL 2 context, bound per draw (the module comment says why) */
export class NodeUniformBuffers {
  private readonly blocks = new WeakMap<object, Block>();
  /** each program's block indices by block name, and the binding point each block index was last pointed at */
  private readonly programs = new WeakMap<WebGLProgram, { readonly index: Map<string, number>; readonly point: Map<number, number> }>();
  private readonly bound = new Map<number, WebGLBuffer>();
  private readonly top: number;
  private readonly gl: UniformBlockGl;

  constructor(gl: UniformBlockGl) {
    this.gl = gl;
    const max: unknown = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
    this.top = typeof max === 'number' && max > 0 ? max - 1 : 23;
  }

  /** Resolve linked block indices during a paced warm-up. No buffer, value,
   * binding point or live draw state is created or changed. */
  prepare(program: WebGLProgram, groups: readonly BlockGroup[]): void {
    let known = this.programs.get(program);
    if (known === undefined) { known = { index: new Map(), point: new Map() }; this.programs.set(program, known); }
    for (const group of groups) if (!known.index.has(group.name)) known.index.set(group.name, this.gl.getUniformBlockIndex(program, group.name));
  }

  /**
   * upload what changed in `groups` and bind them, in order, to the top binding points for `program` (a linked GL program).
   * `pass` names the current camera pass (the node frame's render id; omitted: every block compares its values): a
   * `render` / `frame` block already uploaded in that pass is bound as it is.
   */
  bind(program: WebGLProgram, groups: readonly BlockGroup[], pass?: number): void {
    const gl = this.gl;
    let known = this.programs.get(program);
    if (known === undefined) { known = { index: new Map(), point: new Map() }; this.programs.set(program, known); }
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group === undefined) continue;
      const block = this.block(group);
      if (pass === undefined || !block.passScoped || block.pass !== pass) { this.upload(block); block.pass = pass ?? -1; }
      const point = this.top - i;
      if (this.bound.get(point) !== block.buffer) {
        gl.bindBufferBase(gl.UNIFORM_BUFFER, point, block.buffer); this.bound.set(point, block.buffer);
      }
      let index = known.index.get(group.name);
      if (index === undefined) { index = gl.getUniformBlockIndex(program, group.name); known.index.set(group.name, index); }
      if (index === gl.INVALID_INDEX || known.point.get(index) === point) continue;
      gl.uniformBlockBinding(program, index, point);
      known.point.set(index, point);
    }
  }

  /** Classic draws and render boundaries may bind external groups. */
  invalidateBindings(): void { this.bound.clear(); }

  /** free a group's buffer (its material was disposed) */
  release(group: object): void {
    const block = this.blocks.get(group);
    if (block === undefined) return;
    this.gl.deleteBuffer(block.buffer);
    for (const [point, buffer] of this.bound) if (buffer === block.buffer) this.bound.delete(point);
    this.blocks.delete(group);
  }

  private block(group: BlockGroup): Block {
    const known = this.blocks.get(group);
    if (known !== undefined) return known;
    const gl = this.gl, layout = std140Layout(group), buffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, layout.size, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    // One CPU image retains unchanged slots and std140 padding between edits.
    // Slot views are made once; uploads use WebGL2's source offset/count overload.
    const data = new Float32Array(layout.size / 4);
    const block: Block = { buffer, data, slots: layout.slots.map((s) => ({ uniform: s.uniform, element: s.element, offset: s.offset,
      data: new Float32Array(data.buffer, s.offset, s.storage / 4),
      bits: new Uint32Array(data.buffer, s.offset, s.storage / 4), source: null, sourceBits: null })), passScoped: PASS_GROUPS.has(group.name), pass: -1 };
    this.blocks.set(group, block);
    return block;
  }

  /**
   * Write the slots whose upload image moved and send the dirty span. A value is compared as the bits it would write, with
   * the image its slot already holds (a fresh buffer is zeros, as its GPU copy is): no copy of any value is kept.
   */
  private upload(block: Block): void {
    const gl = this.gl;
    let first: Slot | undefined, last: Slot | undefined;
    for (const slot of block.slots) {
      const value: unknown = Array.isArray(slot.uniform.value) ? slot.uniform.value[slot.element]
        : slot.element === 0 ? slot.uniform.value : undefined;
      if (ArrayBuffer.isView(value)) {
        if (sameBytes(value, slot)) continue;
        write(value, slot.data);
      } else {
        const length = slot.data.length;
        if (!stage(value, length)) continue;
        const bits = slot.bits;
        let same = true;
        for (let i = 0; i < length; i++) if (scratchBits[i] !== bits[i]) { same = false; break; }
        if (same) continue;
        slot.data.set(scratchOf(length));
      }
      first ??= slot; last = slot;
    }
    if (first !== undefined && last !== undefined) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer);
      // Layout slots are ordered. Keep the ordinary three-argument call when
      // only one changed; the span overload pays off for multiple dirty slots.
      if (first === last) gl.bufferSubData(gl.UNIFORM_BUFFER, first.offset, first.data);
      else gl.bufferSubData(gl.UNIFORM_BUFFER, first.offset, block.data, first.offset / 4, (last.offset + last.data.byteLength - first.offset) / 4);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }
  }
}

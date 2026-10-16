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

import { Color, Matrix3, Matrix4, Vector2, Vector3, Vector4 } from 'three';

/** the WebGL 2 calls the blocks make (a context, or a test's recorder) */
export type UniformBlockGl = Pick<WebGL2RenderingContext, 'MAX_UNIFORM_BUFFER_BINDINGS' | 'UNIFORM_BUFFER' | 'DYNAMIC_DRAW' | 'INVALID_INDEX'
  | 'getParameter' | 'createBuffer' | 'deleteBuffer' | 'bindBuffer' | 'bufferData' | 'bufferSubData' | 'bindBufferBase' | 'getUniformBlockIndex' | 'uniformBlockBinding'>;

/** one uniform as a group holds it: three's `Uniform` / a node's `NodeUniform` (its `value` read live) */
interface BlockUniform { readonly value: unknown }
/** a uniform group as the node handler builds it (three's `UniformsGroup`) */
export interface BlockGroup { readonly name: string; readonly uniforms: readonly (BlockUniform | readonly BlockUniform[])[] }

/** the extra WebGL 2 calls the block ring makes (`NodeUniformBuffers.ring`); a recorder without them never rings */
export type UniformRingGl = Pick<WebGL2RenderingContext, 'UNIFORM_BUFFER_OFFSET_ALIGNMENT' | 'bindBufferRange'>;
const ringCapable = (gl: UniformBlockGl): gl is UniformBlockGl & UniformRingGl =>
  typeof Reflect.get(gl, 'bindBufferRange') === 'function' && typeof Reflect.get(gl, 'UNIFORM_BUFFER_OFFSET_ALIGNMENT') === 'number';

/** where one uniform value lives in its block, and what it last wrote */
interface Slot { readonly uniform: BlockUniform; readonly element: number; readonly offset: number; readonly data: Float32Array; last: unknown }
/**
 * a group's buffer and layout; `stale` says its own buffer missed writes made while the ring was on, `ringAt` where its
 * current floats were last placed in the ring (a running byte count; -1 none)
 */
interface Block { readonly buffer: WebGLBuffer; readonly data: Float32Array; readonly slots: readonly Slot[]; stale: boolean; ringAt: number }

/** the ring's size: a Driftwood frame writes well under 1 MB of object blocks, so a placement survives several frames */
const RING_BYTES = 4 * 1024 * 1024;

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
/** a mat4's 16 floats where they differ; true if any did */
function writeMat4(e: readonly number[], data: Float32Array): boolean {
  let dirty = false;
  for (let i = 0; i < 16; i++) { const f = Math.fround(e[i] ?? 0); if (data[i] !== f) { data[i] = f; dirty = true; } }
  return dirty;
}
/** a mat3 as three padded columns (three's writeUniformValue) where they differ; true if any did */
function writeMat3(e: readonly number[], data: Float32Array): boolean {
  let dirty = false;
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) { const f = Math.fround(e[c * 3 + r] ?? 0), at = c * 4 + r; if (data[at] !== f) { data[at] = f; dirty = true; } }
  }
  return dirty;
}
function write2(data: Float32Array, a: number, b: number): boolean {
  const fa = Math.fround(a), fb = Math.fround(b);
  if (data[0] === fa && data[1] === fb) return false;
  data[0] = fa; data[1] = fb; return true;
}
function write3(data: Float32Array, a: number, b: number, c: number): boolean {
  const fa = Math.fround(a), fb = Math.fround(b), fc = Math.fround(c);
  if (data[0] === fa && data[1] === fb && data[2] === fc) return false;
  data[0] = fa; data[1] = fb; data[2] = fc; return true;
}
function write4(data: Float32Array, a: number, b: number, c: number, d: number): boolean {
  const fa = Math.fround(a), fb = Math.fround(b), fc = Math.fround(c), fd = Math.fround(d);
  if (data[0] === fa && data[1] === fb && data[2] === fc && data[3] === fd) return false;
  data[0] = fa; data[1] = fb; data[2] = fc; data[3] = fd; return true;
}
/**
 * Direct block writes (`NodeUniformBuffers.directWrites`): write a value of a known three type straight into its slot's
 * floats where they differ from what the buffer already holds, and say whether any did; null for any other value (the
 * generic compare-and-copy path). The slot's floats are exactly the uploaded bytes, so a skipped write uploads nothing
 * the GPU does not already have.
 */
function writeDirect(value: unknown, data: Float32Array): boolean | null {
  if (typeof value === 'number') { const f = Math.fround(value); if (data[0] === f) return false; data[0] = f; return true; }
  if (value instanceof Matrix4) return writeMat4(value.elements, data);
  if (value instanceof Vector3) return write3(data, value.x, value.y, value.z);
  if (value instanceof Vector4) return write4(data, value.x, value.y, value.z, value.w);
  if (value instanceof Color) return write3(data, value.r, value.g, value.b);
  if (value instanceof Vector2) return write2(data, value.x, value.y);
  if (value instanceof Matrix3) return writeMat3(value.elements, data);
  if (typeof value === 'boolean') { const f = value ? 1 : 0; if (data[0] === f) return false; data[0] = f; return true; }
  return null;
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
  private readonly bound = new Map<number, WebGLBuffer>();
  private readonly top: number;
  private readonly gl: UniformBlockGl;
  /**
   * Direct block writes (the Developer Debug row Performance ▸ Direct block writes, `graphBlockWrites`, live, default
   * off): a number, boolean, vector, colour or matrix is compared against and written into the block's own floats in
   * one pass, instead of compared with a kept copy through its `equals` and copied back through `copy` / `toArray`.
   */
  directWrites = false;
  /**
   * The block ring (the Developer Debug row Performance ▸ Uniform block ring, `graphBlockRing`, live, default off): a
   * block whose floats changed is written whole at the next free, aligned offset of one big ring buffer and bound there
   * with `bindBufferRange`, instead of rewritten in place in its own buffer. A group shared by many draws (every draw's
   * object block) then never overwrites bytes an earlier draw of the same frame still reads, which Metal (ANGLE) may
   * stall on or shadow-copy (sp-o286). A placement is reused while the ring has not lapped it.
   */
  get ring(): boolean { return this.ringOn; }
  set ring(on: boolean) {
    if (on && this.ringGl === null) return;
    if (on !== this.ringOn) { this.ringOn = on; this.invalidateBindings(); }
  }
  private ringOn = false;
  private readonly ringGl: (UniformBlockGl & UniformRingGl) | null;
  private ringBuffer: WebGLBuffer | null = null;
  /** the ring's running write position in bytes (never wraps; the ring offset is this modulo `RING_BYTES`) */
  private ringCursor = 0;
  private ringAlign = 256;
  /** the ring offset each binding point was last bound at (ring mode) */
  private readonly ringBound = new Map<number, number>();

  constructor(gl: UniformBlockGl) {
    this.gl = gl;
    const max: unknown = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
    this.top = typeof max === 'number' && max > 0 ? max - 1 : 23;
    this.ringGl = ringCapable(gl) ? gl : null;
  }

  /** upload what changed in `groups` and bind them, in order, to the top binding points for `program` (a linked GL program) */
  bind(program: WebGLProgram, groups: readonly BlockGroup[]): void {
    const gl = this.gl;
    let known = this.programs.get(program);
    if (known === undefined) { known = { index: new Map(), point: new Map() }; this.programs.set(program, known); }
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group === undefined) continue;
      const block = this.block(group);
      const point = this.top - i;
      if (this.ringOn && this.ringGl !== null) this.ringBind(this.ringGl, block, point);
      else {
        this.upload(block);
        if (this.bound.get(point) !== block.buffer) { gl.bindBufferBase(gl.UNIFORM_BUFFER, point, block.buffer); this.bound.set(point, block.buffer); }
      }
      let index = known.index.get(group.name);
      if (index === undefined) { index = gl.getUniformBlockIndex(program, group.name); known.index.set(group.name, index); }
      if (index === gl.INVALID_INDEX || known.point.get(index) === point) continue;
      gl.uniformBlockBinding(program, index, point);
      known.point.set(index, point);
    }
  }

  /** Classic draws and render boundaries may bind external groups. */
  invalidateBindings(): void { this.bound.clear(); this.ringBound.clear(); }

  /** free a group's buffer (its material was disposed) */
  release(group: object): void {
    const block = this.blocks.get(group);
    if (block === undefined) return;
    this.gl.deleteBuffer(block.buffer);
    for (const [point, buffer] of this.bound) if (buffer === block.buffer) this.bound.delete(point);
    this.blocks.delete(group);
  }

  /** refresh `block`'s floats; if they changed or the ring lapped its placement, write them at the ring's cursor; bind */
  private ringBind(gl: UniformBlockGl & UniformRingGl, block: Block, point: number): void {
    const dirty = this.refresh(block) !== null;
    if (dirty) block.stale = true;
    const size = block.data.byteLength;
    if (dirty || block.ringAt < 0 || this.ringCursor > block.ringAt + RING_BYTES - size) {
      let ring = this.ringBuffer;
      if (ring === null) {
        const align: unknown = gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT);
        if (typeof align === 'number' && align > 0) this.ringAlign = align;
        ring = gl.createBuffer(); this.ringBuffer = ring;
        gl.bindBuffer(gl.UNIFORM_BUFFER, ring);
        gl.bufferData(gl.UNIFORM_BUFFER, RING_BYTES, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      }
      let at = Math.ceil(this.ringCursor / this.ringAlign) * this.ringAlign;
      // a block never straddles the ring's end: it starts the next lap instead
      if ((at % RING_BYTES) + size > RING_BYTES) at = (Math.floor(at / RING_BYTES) + 1) * RING_BYTES;
      gl.bindBuffer(gl.UNIFORM_BUFFER, ring);
      gl.bufferSubData(gl.UNIFORM_BUFFER, at % RING_BYTES, block.data);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      block.ringAt = at; this.ringCursor = at + size;
    }
    const ring = this.ringBuffer, offset = block.ringAt % RING_BYTES;
    if (ring === null || (this.ringBound.get(point) === offset && this.bound.get(point) === ring)) return;
    gl.bindBufferRange(gl.UNIFORM_BUFFER, point, ring, offset, size);
    this.ringBound.set(point, offset); this.bound.set(point, ring);
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
      data: new Float32Array(data.buffer, s.offset, s.storage / 4), last: undefined })), stale: false, ringAt: -1 };
    this.blocks.set(group, block);
    return block;
  }

  /** write what changed into the block's floats and its own buffer (a block the ring left stale is written whole) */
  private upload(block: Block): void {
    const span = this.refresh(block), gl = this.gl;
    if (block.stale) {
      block.stale = false;
      gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, block.data);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      return;
    }
    if (span === null) return;
    const [first, last] = span;
    gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer);
    // Layout slots are ordered. Keep the ordinary three-argument call when
    // only one changed; the span overload pays off for multiple dirty slots.
    if (first === last) gl.bufferSubData(gl.UNIFORM_BUFFER, first.offset, first.data);
    else gl.bufferSubData(gl.UNIFORM_BUFFER, first.offset, block.data, first.offset / 4, (last.offset + last.data.byteLength - first.offset) / 4);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }

  /** write what changed into the block's floats: the first and last changed slots, or null when nothing did */
  private refresh(block: Block): readonly [Slot, Slot] | null {
    let first: Slot | undefined, last: Slot | undefined;
    const direct = this.directWrites;
    for (const slot of block.slots) {
      const value: unknown = Array.isArray(slot.uniform.value) ? slot.uniform.value[slot.element]
        : slot.element === 0 ? slot.uniform.value : undefined;
      if (direct) {
        const dirty = writeDirect(value, slot.data);
        if (dirty !== null) {
          // the kept copy is now stale: the generic path rewrites this slot once if the row goes off
          slot.last = undefined;
          if (dirty) { first ??= slot; last = slot; }
          continue;
        }
      }
      if (!changed(slot.last, value)) continue;
      slot.last = remember(slot.last, value);
      write(value, slot.data);
      first ??= slot; last = slot;
    }
    return first !== undefined && last !== undefined ? [first, last] : null;
  }
}

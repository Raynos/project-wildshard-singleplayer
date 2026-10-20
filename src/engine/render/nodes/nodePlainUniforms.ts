/**
 * The node materials' uniforms as plain program uniforms (SHARD-PLATFORM, the iOS Simulator frame gate).
 *
 * three's GLSL node builder declares every non-texture uniform of a node program in std140 blocks (`nodeUniformBuffers.ts`
 * binds them). WebKit draws WebGL through ANGLE's Metal back-end, which passes a stage's uniform blocks to Metal in an
 * argument buffer and encodes that buffer again on every draw whose pipeline or block bindings moved: one
 * `setArgumentBuffer` plus one `setBuffer` per block, per stage. In the iOS Simulator each of those is a synchronous XPC
 * round trip to the host's Metal driver, so Nine's ~130 graph draws (4 blocks each) spent ~20 ms of a 33 ms frame waiting
 * on them, whatever was drawn (sampled in the Simulator's GPU process: `ProgramExecutableMtl::setupDraw` →
 * `MTLSimArgumentEncoder`). A program without blocks takes ANGLE's default uniforms, sent with the draw (`setBytes`).
 *
 * `plainUniformShader` rewrites a build's blocks as plain uniform declarations (the members keep their names, so the
 * shader body is unchanged) and `NodePlainUniforms` uploads each member to its program as it changes. Plain uniforms
 * belong to a program, so every program keeps the image it last received and a draw sends only what differs from it;
 * a render or frame group (the camera, the clock) is compared once per camera pass. There are no binding points.
 */

import { Color, Matrix3, Matrix4, Vector2, Vector3, Vector4 } from 'three';
import type { BlockGroup } from './nodeUniformBuffers';

/** the WebGL 2 calls the plain uniforms make (a context, or a test's recorder) */
export type PlainUniformGl = Pick<WebGL2RenderingContext, 'ACTIVE_UNIFORMS' | 'getProgramParameter' | 'getActiveUniform' | 'getUniformLocation'
  | 'uniform1fv' | 'uniform2fv' | 'uniform3fv' | 'uniform4fv' | 'uniform1iv' | 'uniform2iv' | 'uniform3iv' | 'uniform4iv'
  | 'uniform1uiv' | 'uniform2uiv' | 'uniform3uiv' | 'uniform4uiv' | 'uniformMatrix2fv' | 'uniformMatrix3fv' | 'uniformMatrix4fv'>;

interface BlockUniform { readonly value: unknown }
const members = (entry: BlockGroup['uniforms'][number]): readonly BlockUniform[] => 'value' in entry ? [entry] : entry;

const BLOCK = /(?:layout\s*\(\s*std140\s*\)\s*)?uniform\s+(\w+)\s*\{([^{}]*)\}\s*;/gu;
const MEMBER = /^(?:(lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*(\[\s*\d+\s*\])?$/u;

/**
 * Rewrite `groups`' std140 blocks in both stages as plain uniforms; returns each group's member names in its
 * uniforms' order (a block declares its members in that order, as its std140 layout reads them).
 */
export function plainUniformShader(parameters: { vertexShader: string; fragmentShader: string }, groups: readonly BlockGroup[]): Map<BlockGroup, readonly string[]> {
  const declared = new Map<string, readonly string[]>();
  const rewrite = (source: string): string => source.replaceAll(BLOCK, (_block: string, name: string, fields: string) => {
    const lines: string[] = [], names: string[] = [];
    for (const field of fields.split(';').map(f => f.trim()).filter(f => f !== '')) {
      const m = MEMBER.exec(field);
      const type = m?.[2], member = m?.[3];
      if (type === undefined || member === undefined) throw new Error(`plain node uniforms: an unsupported block member '${field}'`);
      const precision = m?.[1], array = m?.[4];
      lines.push(`uniform ${precision === undefined ? '' : `${precision} `}${type} ${member}${array === undefined ? '' : array.replaceAll(/\s/gu, '')};`);
      names.push(member);
    }
    const known = declared.get(name);
    if (known !== undefined && known.join(',') !== names.join(',')) throw new Error(`plain node uniforms: block ${name} differs between stages`);
    declared.set(name, names);
    return lines.join('\n');
  });
  parameters.vertexShader = rewrite(parameters.vertexShader);
  parameters.fragmentShader = rewrite(parameters.fragmentShader);
  const out = new Map<BlockGroup, readonly string[]>();
  for (const group of groups) {
    const names = declared.get(group.name);
    if (names === undefined) continue; // a group neither stage declares: nothing reads it
    const count = group.uniforms.reduce((n, entry) => n + members(entry).length, 0);
    if (count !== names.length) throw new Error(`plain node uniforms: block ${group.name} declares ${String(names.length)} members for ${String(count)} uniforms`);
    out.set(group, names);
  }
  return out;
}

/** a member's images on one program (staged this draw, held by the program) and its upload */
type Image = Float32Array | Int32Array | Uint32Array;
interface Images { readonly next: Image; readonly held: Image; readonly send: () => void }
/** a GL uniform type: its component count and how a slot of it is made */
interface Kind { readonly comps: number; readonly make: (gl: PlainUniformGl, at: WebGLUniformLocation, length: number) => Images }
type Send<T> = (gl: PlainUniformGl, at: WebGLUniformLocation, data: T) => void;
const floats = (comps: number, send: Send<Float32Array>): Kind => ({ comps,
  make: (gl, at, length) => { const next = new Float32Array(length); return { next, held: new Float32Array(length), send: () => { send(gl, at, next); } }; } });
const ints = (comps: number, send: Send<Int32Array>): Kind => ({ comps,
  make: (gl, at, length) => { const next = new Int32Array(length); return { next, held: new Int32Array(length), send: () => { send(gl, at, next); } }; } });
const uints = (comps: number, send: Send<Uint32Array>): Kind => ({ comps,
  make: (gl, at, length) => { const next = new Uint32Array(length); return { next, held: new Uint32Array(length), send: () => { send(gl, at, next); } }; } });
/** by GL type enum; int and bool members both upload as ints */
const KINDS: Readonly<Record<number, Kind>> = {
  0x1406: floats(1, (gl, at, d) => { gl.uniform1fv(at, d); }), 0x8b50: floats(2, (gl, at, d) => { gl.uniform2fv(at, d); }),
  0x8b51: floats(3, (gl, at, d) => { gl.uniform3fv(at, d); }), 0x8b52: floats(4, (gl, at, d) => { gl.uniform4fv(at, d); }),
  0x8b5a: floats(4, (gl, at, d) => { gl.uniformMatrix2fv(at, false, d); }), 0x8b5b: floats(9, (gl, at, d) => { gl.uniformMatrix3fv(at, false, d); }),
  0x8b5c: floats(16, (gl, at, d) => { gl.uniformMatrix4fv(at, false, d); }),
  0x1404: ints(1, (gl, at, d) => { gl.uniform1iv(at, d); }), 0x8b53: ints(2, (gl, at, d) => { gl.uniform2iv(at, d); }),
  0x8b54: ints(3, (gl, at, d) => { gl.uniform3iv(at, d); }), 0x8b55: ints(4, (gl, at, d) => { gl.uniform4iv(at, d); }),
  0x8b56: ints(1, (gl, at, d) => { gl.uniform1iv(at, d); }), 0x8b57: ints(2, (gl, at, d) => { gl.uniform2iv(at, d); }),
  0x8b58: ints(3, (gl, at, d) => { gl.uniform3iv(at, d); }), 0x8b59: ints(4, (gl, at, d) => { gl.uniform4iv(at, d); }),
  0x1405: uints(1, (gl, at, d) => { gl.uniform1uiv(at, d); }), 0x8dc6: uints(2, (gl, at, d) => { gl.uniform2uiv(at, d); }),
  0x8dc7: uints(3, (gl, at, d) => { gl.uniform3uiv(at, d); }), 0x8dc8: uints(4, (gl, at, d) => { gl.uniform4uiv(at, d); }),
};

/** one member on one program; `fresh` until its first upload */
interface Slot extends Images { readonly comps: number; fresh: boolean }
/** one group's members on one program, and the camera pass a pass-scoped group last compared in */
interface Bound { readonly slots: readonly { readonly uniform: BlockUniform; readonly slot: Slot }[]; pass: number }
interface Program { readonly slots: ReadonlyMap<string, Slot>; readonly groups: WeakMap<BlockGroup, Bound> }

/** three's groups whose uniforms only move at a render or frame update (as `nodeUniformBuffers.ts` PASS_GROUPS) */
const PASS_GROUPS: ReadonlySet<string> = new Set(['render', 'frame']);

const isObject = (v: unknown): v is object => typeof v === 'object' && v !== null;

/** write `value` (a number, a three value class, a typed array or an array of either) as `comps`-wide elements from `at` */
function fill(value: unknown, out: Image, at: number, comps: number): void {
  if (typeof value === 'number') { out[at] = value; return; }
  if (typeof value === 'boolean') { out[at] = value ? 1 : 0; return; }
  if (value instanceof Float32Array || value instanceof Int32Array || value instanceof Uint32Array || value instanceof Float64Array) {
    out.set(value.subarray(0, Math.max(0, Math.min(value.length, out.length - at))), at); return;
  }
  if (Array.isArray(value)) {
    const list: readonly unknown[] = value;
    for (let i = 0; i < list.length && at + i * comps < out.length; i++) fill(list[i], out, at + i * comps, comps);
    return;
  }
  // three's value classes write their toArray order directly (a keyed native call per value per draw was a hot spot on
  // the Simulator); anything else keeps its own toArray
  if (value instanceof Matrix4 || value instanceof Matrix3) {
    const e = value.elements, n = Math.min(e.length, out.length - at);
    for (let i = 0; i < n; i++) out[at + i] = e[i] ?? 0;
    return;
  }
  if (value instanceof Vector3) { out[at] = value.x; out[at + 1] = value.y; out[at + 2] = value.z; return; }
  if (value instanceof Color) { out[at] = value.r; out[at + 1] = value.g; out[at + 2] = value.b; return; }
  if (value instanceof Vector2) { out[at] = value.x; out[at + 1] = value.y; return; }
  if (value instanceof Vector4) { out[at] = value.x; out[at + 1] = value.y; out[at + 2] = value.z; out[at + 3] = value.w; return; }
  if (!isObject(value)) return;
  const toArray: unknown = Reflect.get(value, 'toArray');
  if (typeof toArray === 'function') Reflect.apply(toArray, value, [out, at]);
}

/** the plain uniforms of node programs on one WebGL 2 context (the module comment says why) */
export class NodePlainUniforms {
  private readonly names = new WeakMap<BlockGroup, readonly string[]>();
  private readonly programs = new WeakMap<WebGLProgram, Program>();
  private readonly gl: PlainUniformGl;
  constructor(gl: PlainUniformGl) { this.gl = gl; }

  /** rewrite a build's blocks as plain uniforms and keep its groups' member names */
  declare(parameters: { vertexShader: string; fragmentShader: string }, groups: readonly BlockGroup[]): void {
    for (const [group, names] of plainUniformShader(parameters, groups)) this.names.set(group, names);
  }

  /** Read a linked program's active uniforms during a paced warm-up; no value is uploaded. */
  prepare(program: WebGLProgram, groups: readonly BlockGroup[]): void {
    const known = this.program(program);
    for (const group of groups) this.bound(known, group);
  }

  /**
   * Upload what changed in `groups` since `program` last received it. `program` must be in use: gl.uniform* writes the
   * current program, so the handler sends a draw's uniforms from setProgram, after its useProgram. `pass` names the
   * current camera pass (the node frame's render id; omitted: every group compares): a render / frame group already
   * compared on this program in that pass is left as it is.
   */
  bind(program: WebGLProgram, groups: readonly BlockGroup[], pass?: number): void {
    const known = this.program(program);
    for (const group of groups) {
      const bound = this.bound(known, group);
      if (bound === null) continue;
      if (pass !== undefined && PASS_GROUPS.has(group.name)) { if (bound.pass === pass) continue; bound.pass = pass; }
      for (const { uniform, slot } of bound.slots) {
        const next = slot.next, held = slot.held;
        fill(uniform.value, next, 0, slot.comps);
        let same = !slot.fresh;
        for (let k = 0; same && k < next.length; k++) if (next[k] !== held[k]) same = false;
        if (same) continue;
        slot.send(); held.set(next); slot.fresh = false;
      }
    }
  }

  /** Plain uniforms are program state: nothing stays bound between draws. */
  invalidateBindings(): void { /* no binding points */ }

  /** a disposed material's groups: their slot lists go with the groups (weak maps) */
  release(_group: object): void { /* nothing is allocated per group */ }

  private program(program: WebGLProgram): Program {
    const known = this.programs.get(program);
    if (known !== undefined) return known;
    const slots = new Map<string, Slot>(), gl = this.gl;
    const count: unknown = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < (typeof count === 'number' ? count : 0); i++) {
      const info = gl.getActiveUniform(program, i);
      const kind = info === null ? undefined : KINDS[info.type];
      if (info === null || kind === undefined) continue;
      const name = info.name.replace(/\[0\]$/u, ''), at = gl.getUniformLocation(program, name);
      if (at !== null) slots.set(name, { ...kind.make(gl, at, kind.comps * info.size), comps: kind.comps, fresh: true });
    }
    const made = { slots, groups: new WeakMap<BlockGroup, Bound>() };
    this.programs.set(program, made);
    return made;
  }

  private bound(known: Program, group: BlockGroup): Bound | null {
    const cached = known.groups.get(group);
    if (cached !== undefined) return cached;
    const names = this.names.get(group);
    if (names === undefined) return null;
    const slots: { uniform: BlockUniform; slot: Slot }[] = [];
    group.uniforms.flatMap(members).forEach((uniform, i) => { const slot = known.slots.get(names[i] ?? ''); if (slot !== undefined) slots.push({ uniform, slot }); });
    const bound = { slots, pass: -1 };
    known.groups.set(group, bound);
    return bound;
  }
}

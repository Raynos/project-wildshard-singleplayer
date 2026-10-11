import { BufferAttribute, BufferGeometry, Float16BufferAttribute, InterleavedBufferAttribute, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, IcosahedronGeometry, CapsuleGeometry, Shape, ExtrudeGeometry, Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A pack of float32 geometries as an offline bake stores them (SHARD-PLATFORM M3, the kit system): each geometry's unique
 * vertices as one block per attribute, then its index (16 or 32 bit, 4-byte aligned), described by a row each. A geometry
 * the builder left indexed (`own`) comes back with its own copies of the blocks and its index; one the builder left
 * non-indexed (`own: null`) is expanded back through the index to `count` vertices, exactly as the builder had it.
 */

/** One draw group of a packed geometry: its index range and material slot, as three keeps it. */
export interface PackedGroup { readonly start: number; readonly count: number; readonly materialIndex: number }

/** One packed geometry: its attributes [name, item size], its vertex count, its unique vertices, its index. */
export interface PackedGeometryRow {
  readonly attrs: readonly (readonly [string, number])[];
  readonly count: number;
  readonly unique: number;
  /** the index the builder kept ('u16' / 'u32'), or null: expand it away */
  readonly own: 'u16' | 'u32' | null;
  readonly indexCount: number;
  /** the builder's draw groups (a primitive's side and caps, say), when it had any */
  readonly groups?: readonly PackedGroup[];
}

/** A pack's rows: its byte size and its geometries in byte order. */
export interface PackedGeometryRows {
  readonly bytes: number;
  readonly geometries: readonly PackedGeometryRow[];
}

/** A pack's rows as JSON holds them (each attribute pair an array, the index kind a string). */
export interface PackedGeometryJson {
  readonly bytes: number;
  readonly geometries: readonly { readonly attrs: readonly (readonly (string | number)[])[]; readonly count: number; readonly unique: number; readonly own: string | null; readonly indexCount: number; readonly groups?: readonly PackedGroup[] }[];
}

/** JSON rows checked into a pack's rows: every attribute pair is [name, item size], every index 'u16', 'u32' or null. */
export function packedRows(json: PackedGeometryJson): PackedGeometryRows {
  return { bytes: json.bytes, geometries: json.geometries.map((g) => {
    const attrs = g.attrs.map(([name, size]) => {
      if (typeof name !== 'string' || typeof size !== 'number') throw new Error('geometry pack: an attribute row is [name, size]');
      return [name, size] as const;
    });
    if (g.own !== null && g.own !== 'u16' && g.own !== 'u32') throw new Error(`geometry pack: index kind ${g.own}`);
    return { attrs, count: g.count, unique: g.unique, own: g.own, indexCount: g.indexCount, ...(g.groups === undefined ? {} : { groups: g.groups }) };
  }) };
}

/** The decoded binary: each geometry's blocks, read fresh for every geometry built from it (nothing is shared). */
export class GeometryPack {
  private readonly at: number[] = [];
  private readonly buffer: ArrayBuffer;
  private readonly rows: PackedGeometryRows;
  private readonly label: string;

  /** `bytes` the inflated binary, `rows` its description, `label` the error messages' name. */
  constructor(bytes: Uint8Array, rows: PackedGeometryRows, label: string) {
    this.rows = rows; this.label = label;
    if (bytes.length !== rows.bytes) throw new Error(`[${label}] the bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
    let offset = 0;
    const pad = (n: number): number => Math.ceil(n / 4) * 4;
    for (const g of rows.geometries) {
      this.at.push(offset);
      for (const [, size] of g.attrs) offset += pad(g.unique * size * 4);
      offset += pad(g.indexCount * (g.own === 'u32' || (g.own === null && g.unique >= 65536) ? 4 : 2));
    }
    if (offset !== bytes.length) throw new Error(`[${label}] the bake does not match its rows`);
  }

  /** geometry `i` as the builder made it: a copy its caller owns */
  geometry(i: number): BufferGeometry {
    const row = this.rows.geometries[i], start = this.at[i];
    if (row === undefined || start === undefined) throw new Error(`[${this.label}] no baked geometry ${String(i)}`);
    let offset = start;
    const blocks = row.attrs.map(([, size]) => { const a = new Float32Array(this.buffer, offset, row.unique * size); offset += Math.ceil(a.byteLength / 4) * 4; return a; });
    const wide = row.own === 'u32' || (row.own === null && row.unique >= 65536);
    const index = wide ? new Uint32Array(this.buffer, offset, row.indexCount) : new Uint16Array(this.buffer, offset, row.indexCount);
    const g = new BufferGeometry();
    row.attrs.forEach(([name, size], k) => {
      const block = blocks[k];
      if (block === undefined) return;
      if (row.own !== null) { g.setAttribute(name, new BufferAttribute(block.slice(), size)); return; }
      const out = new Float32Array(row.count * size);
      for (let j = 0; j < row.count; j++) { const src = (index[j] ?? 0) * size; for (let c = 0; c < size; c++) out[j * size + c] = block[src + c] ?? 0; }
      g.setAttribute(name, new BufferAttribute(out, size));
    });
    if (row.own !== null) g.setIndex(new BufferAttribute(index.slice(), 1));
    for (const group of row.groups ?? []) g.addGroup(group.start, group.count, group.materialIndex);
    return g;
  }

  /** float block `i` (`GeometryPackWriter.addFloats`): a copy of its floats, exactly as written (a `-0` stays `-0`) */
  floats(i: number): Float32Array {
    const a = this.geometry(i).getAttribute('values');
    if (!(a instanceof BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error(`[${this.label}] ${String(i)} is not a float block`);
    return a.array;
  }
}

/**
 * The writer of a pack (build-time): geometries added in order, each attribute's floats then an index, every block padded
 * to 4 bytes. A geometry built without an index stores its distinct vertices once (bit-equal floats in every attribute)
 * and the index that expands them back, in order; one built with an index keeps its own (16 or 32 bit, as built).
 * `GeometryPack` reads the bytes back to the builder's exact arrays.
 */
export class GeometryPackWriter {
  private readonly packed: PackedGeometryRow[] = [];
  private readonly chunks: Uint8Array[] = [];
  private size = 0;
  private readonly label: string;

  /** `label` the error messages' name. */
  constructor(label: string) { this.label = label; }

  /** Append geometry `g` (plain float32 attributes only); returns its index in the pack. */
  add(g: BufferGeometry): number {
    const names = Object.keys(g.attributes), attrs = names.map((name): [string, number] => [name, g.getAttribute(name).itemSize]);
    const count = g.getAttribute(names[0] ?? 'position').count, own = g.getIndex();
    const groups = g.groups.length === 0 ? {} : { groups: g.groups.map((group) => ({ start: group.start, count: group.count, materialIndex: group.materialIndex ?? 0 })) };
    const floats = (name: string): Float32Array => {
      const a = g.getAttribute(name);
      if (a instanceof InterleavedBufferAttribute || !(a.array instanceof Float32Array) || a.normalized) throw new Error(`[${this.label}] ${name}: plain float32 only`);
      return a.array.subarray(0, a.count * a.itemSize);
    };
    if (own !== null) {
      for (const name of names) this.push(new Uint8Array(floats(name).slice().buffer));
      const u32 = own.array instanceof Uint32Array;
      this.push(new Uint8Array((u32 ? Uint32Array.from(own.array) : Uint16Array.from(own.array)).buffer));
      this.packed.push({ attrs, count, unique: count, own: u32 ? 'u32' : 'u16', indexCount: own.count, ...groups });
      return this.packed.length - 1;
    }
    const arrays = names.map(floats), keys = new Map<string, number>(), index = new Uint32Array(count), firsts: number[] = [];
    const bits = new Uint32Array(1), view = new Float32Array(bits.buffer);
    for (let i = 0; i < count; i++) {
      let key = '';
      arrays.forEach((a, k) => { const w = attrs[k]?.[1] ?? 0; for (let c = 0; c < w; c++) { view[0] = a[i * w + c] ?? 0; key += `${String(bits[0])},`; } });
      let at = keys.get(key);
      if (at === undefined) { at = firsts.length; keys.set(key, at); firsts.push(i); }
      index[i] = at;
    }
    arrays.forEach((a, k) => {
      const w = attrs[k]?.[1] ?? 0, out = new Float32Array(firsts.length * w);
      firsts.forEach((i, j) => { for (let c = 0; c < w; c++) out[j * w + c] = a[i * w + c] ?? 0; });
      this.push(new Uint8Array(out.buffer));
    });
    this.push(new Uint8Array((firsts.length < 65536 ? Uint16Array.from(index) : index).buffer));
    this.packed.push({ attrs, count, unique: firsts.length, own: null, indexCount: count, ...groups });
    return this.packed.length - 1;
  }

  /**
   * Append a block of floats (instance matrices, say: anything a page reads back bit for bit, which JSON cannot carry: it
   * drops a `-0`'s sign), `size` floats to an item; returns its index (`GeometryPack.floats`).
   */
  addFloats(values: Float32Array, size: number): number {
    const g = new BufferGeometry(); g.setAttribute('values', new BufferAttribute(values, size));
    return this.add(g);
  }

  /** The pack's rows so far (its byte size and every geometry's row). */
  rows(): PackedGeometryRows { return { bytes: this.size, geometries: this.packed.map((row) => ({ ...row, attrs: row.attrs.map(([name, w]) => [name, w] as const) })) }; }

  /** The pack's bytes so far (uncompressed). */
  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const c of this.chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  private push(bytes: Uint8Array): void {
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4); padded.set(bytes);
    this.chunks.push(padded); this.size += padded.length;
  }
}

/** Fetch a zlib-deflated bake and inflate it (a failed fetch throws). */
export async function fetchDeflated(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}

// Built geometry as an offline bake stores it (SHARD-PLATFORM M3, the kit system): each attribute's typed array exactly
// as the builder made it (float, half, normalized bytes), so a baked kit draws the same bytes the page's own build would
// have; and `appendGeometry`, which puts what the page adds to a baked builder after its bake.


/** an attribute's element type in the bake ('f16' is a half float held in a Uint16Array, Float16BufferAttribute) */
export type BakedType = 'f32' | 'f16' | 'u16' | 'i8' | 'u8';
/** one baked geometry: its attributes [name, type, item size, normalized], vertex count, index (stored as deltas) */
export interface BakedGeometryRow {
  readonly attrs: readonly (readonly [string, BakedType, number, boolean])[];
  readonly count: number;
  readonly index: 'u16' | 'u32' | null;
  readonly indexCount: number;
  /** whether the builder computed its bounding box (every one computes its sphere) */
  readonly box: boolean;
}

/** bytes per element of each baked type */
export const BAKED_BYTES: Readonly<Record<BakedType, number>> = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 };

/** a block's length padded to 4 bytes */
export const pad4 = (n: number): number => Math.ceil(n / 4) * 4;

/** the bytes a row's blocks take in the bake (each attribute, then the index as int32 deltas, 4-byte aligned) */
export function bakedGeometryBytes(row: BakedGeometryRow): number {
  let n = 0;
  for (const [, type, size] of row.attrs) n += pad4(row.count * size * BAKED_BYTES[type]);
  return n + (row.index === null ? 0 : row.indexCount * 4);
}

/** read geometry `row` from `bytes` at `offset` (the arrays are copies the geometry owns) */
export function readBakedGeometry(bytes: Uint8Array, offset: number, row: BakedGeometryRow): BufferGeometry {
  const g = new BufferGeometry();
  let at = offset;
  const copy = (length: number): ArrayBuffer => { const b = bytes.slice(at, at + length).buffer; at += pad4(length); return b; };
  for (const [name, type, size, normalized] of row.attrs) {
    const buffer = copy(row.count * size * BAKED_BYTES[type]);
    if (type === 'f32') g.setAttribute(name, new BufferAttribute(new Float32Array(buffer), size, normalized));
    else if (type === 'f16') g.setAttribute(name, new Float16BufferAttribute(new Uint16Array(buffer), size, normalized));
    else if (type === 'u16') g.setAttribute(name, new BufferAttribute(new Uint16Array(buffer), size, normalized));
    else if (type === 'i8') g.setAttribute(name, new BufferAttribute(new Int8Array(buffer), size, normalized));
    else g.setAttribute(name, new BufferAttribute(new Uint8Array(buffer), size, normalized));
  }
  if (row.index !== null) {
    const deltas = new Int32Array(copy(row.indexCount * 4));
    const index = row.index === 'u16' ? new Uint16Array(row.indexCount) : new Uint32Array(row.indexCount);
    let last = 0;
    for (let i = 0; i < deltas.length; i++) { last += deltas[i] ?? 0; index[i] = last; }
    g.setIndex(new BufferAttribute(index, 1));
  }
  g.computeBoundingSphere();
  if (row.box) g.computeBoundingBox();
  return g;
}

/** a typed array of `a`'s kind holding `a` then `b` */
function joined(a: BufferAttribute['array'], b: BufferAttribute['array']): BufferAttribute['array'] {
  if (a instanceof Float32Array && b instanceof Float32Array) { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint16Array && b instanceof Uint16Array) { const o = new Uint16Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint32Array && b instanceof Uint32Array) { const o = new Uint32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Int8Array && b instanceof Int8Array) { const o = new Int8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint8Array && b instanceof Uint8Array) { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  throw new Error('kit: a baked geometry and its additions differ in an attribute type');
}

/**
 * `a` (a baked builder's geometry) with `b` (what the page added to that builder since, built by it) after it: the same
 * attributes in the same types, `b`'s indices already counting `a`'s vertices (the builder numbers on from the bake).
 * The index widens to 32 bits once the whole passes 65 535 vertices, as the builder's own choice would.
 */
export function appendGeometry(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(a.attributes)) {
    const tail = b.getAttribute(name);
    if (!(attr instanceof BufferAttribute) || !(tail instanceof BufferAttribute) || tail.itemSize !== attr.itemSize) throw new Error(`kit: '${name}' does not append to its bake`);
    const array = joined(attr.array, tail.array);
    g.setAttribute(name, attr instanceof Float16BufferAttribute ? new Float16BufferAttribute(array, attr.itemSize, attr.normalized) : new BufferAttribute(array, attr.itemSize, attr.normalized));
  }
  const ia = a.index, ib = b.index;
  if (ia !== null && ib !== null) {
    const count = a.getAttribute('position').count + b.getAttribute('position').count;
    const index = ia.array instanceof Uint16Array && count < 65536 ? new Uint16Array(ia.count + ib.count) : new Uint32Array(ia.count + ib.count);
    for (let i = 0; i < ia.count; i++) index[i] = ia.getX(i);
    for (let i = 0; i < ib.count; i++) index[ia.count + i] = ib.getX(i);
    g.setIndex(new BufferAttribute(index, 1));
  }
  g.computeBoundingSphere();
  return g;
}

/**
 * Primitives as rows (SHARD-PLATFORM M3): a three.js primitive, the transforms applied to it in order (translate,
 * rotate about an axis, scale: the geometry's own methods, so every vertex is the one hand-written code computed), and
 * whether it is made non-indexed; a list of them merged in order into one geometry that keeps every part's attributes
 * (position, normal, uv). A lantern's iron frame, a ribcage's hoops or a skull plate is data; `standardMaterial` makes a
 * MeshStandardMaterial from a row (hex or working-space colours). Unlike `primitiveParts` (one colour per part, normals
 * recomputed) the parts keep their own normals and uvs.
 *
 *   const frame = mergePrimitives(rows);           // every row non-indexed, merged
 *   const glass = buildPrimitive(row);             // one part as it stands
 */

/** A primitive's kind; `args` are its three.js constructor's, in order (a cylinder's sixth, open-ended, is 1 for true); an
 *  `extrude` is its row's `shape` extruded by its `extrude` options. */
export type PrimitiveKind = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'icosahedron' | 'capsule' | 'extrude';

/** One transform, applied by the geometry's own method (`rotateX` … angles in radians). */
export type PrimitiveOp = readonly ['translate' | 'scale', number, number, number] | readonly ['rotateX' | 'rotateY' | 'rotateZ', number];

/** One step of a 2D outline (three's Shape path methods, in order). */
export type ShapeStep = readonly ['moveTo' | 'lineTo', number, number] | readonly ['quadraticCurveTo', number, number, number, number];
/** An outline's extrusion (three's ExtrudeGeometry options). */
export interface ExtrudeRow {
  readonly depth: number; readonly bevelEnabled: boolean; readonly bevelThickness: number; readonly bevelSize: number;
  readonly bevelSegments: number; readonly curveSegments: number;
}
/** One primitive as data. */
export interface PrimitiveRow {
  readonly kind: PrimitiveKind;
  readonly args: readonly number[];
  /** an `extrude`'s outline and options */
  readonly shape?: readonly ShapeStep[];
  readonly extrude?: ExtrudeRow;
  /** applied in order */
  readonly ops?: readonly PrimitiveOp[];
}
/** A primitive painted one colour (a CSS colour string) into a `color` vertex attribute. */
export interface PaintedPrimitiveRow extends PrimitiveRow {
  readonly paint: string;
}

/** A MeshStandardMaterial as data: colours a hex number or working-space (r, g, b). */
export interface StandardMaterialRow {
  readonly color: number | readonly [number, number, number];
  readonly emissive?: number | readonly [number, number, number];
  readonly emissiveIntensity?: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly fog?: boolean;
}

const arg = (a: readonly number[], i: number): number | undefined => a[i];

function primitive(p: PrimitiveRow): BufferGeometry {
  const a = p.args;
  switch (p.kind) {
    case 'box': return new BoxGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'cylinder': return new CylinderGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5) === 1);
    case 'cone': return new ConeGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'sphere': return new SphereGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'torus': return new TorusGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4));
    case 'icosahedron': return new IcosahedronGeometry(arg(a, 0), arg(a, 1));
    case 'capsule': return new CapsuleGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3));
    case 'extrude': return extruded(p);
    default: {
      const unknown: never = p.kind;
      throw new Error(`unknown primitive ${String(unknown)}`);
    }
  }
}

/** an `extrude` row's outline, extruded */
function extruded(p: PrimitiveRow): BufferGeometry {
  if (p.shape === undefined || p.extrude === undefined) throw new Error('an extrude primitive needs a shape and its options');
  const s = new Shape();
  for (const step of p.shape) {
    if (step[0] === 'quadraticCurveTo') s.quadraticCurveTo(step[1], step[2], step[3], step[4]);
    else if (step[0] === 'moveTo') s.moveTo(step[1], step[2]);
    else s.lineTo(step[1], step[2]);
  }
  const e = p.extrude;
  return new ExtrudeGeometry(s, { depth: e.depth, bevelEnabled: e.bevelEnabled, bevelThickness: e.bevelThickness, bevelSize: e.bevelSize, bevelSegments: e.bevelSegments, curveSegments: e.curveSegments });
}
/** One primitive with its transforms applied in order (indexed as three.js builds it). */
export function buildPrimitive(row: PrimitiveRow): BufferGeometry {
  const g = primitive(row);
  for (const op of row.ops ?? []) {
    if (op[0] === 'translate') g.translate(op[1], op[2], op[3]);
    else if (op[0] === 'scale') g.scale(op[1], op[2], op[3]);
    else if (op[0] === 'rotateX') g.rotateX(op[1]);
    else if (op[0] === 'rotateY') g.rotateY(op[1]);
    else g.rotateZ(op[1]);
  }
  return g;
}

const merged = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts, false);
/** The rows built (`buildPrimitive`), each made non-indexed, merged in order into one geometry (no groups). */
export function mergePrimitives(rows: readonly PrimitiveRow[]): BufferGeometry {
  return merged(rows.map((r) => buildPrimitive(r).toNonIndexed()));
}
/**
 * The rows built (`buildPrimitive`), each non-indexed (an indexed one copied so), painted its colour into a `color`
 * attribute and stripped to position, normal, uv and color, merged in order into one geometry (no groups): a
 * vertex-coloured stand-in in one draw.
 */
export function paintedPrimitives(rows: readonly PaintedPrimitiveRow[]): BufferGeometry {
  return merged(rows.map((r) => {
    const g = buildPrimitive(r), out = g.index ? g.toNonIndexed() : g;
    const c = new Color(r.paint), n = out.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    out.setAttribute('color', new BufferAttribute(col, 3));
    for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') out.deleteAttribute(k);
    return out;
  }));
}

const colour = (c: number | readonly [number, number, number]): Color => (typeof c === 'number' ? new Color(c) : new Color(c[0], c[1], c[2]));

/** A MeshStandardMaterial from its row (fog left at three's default unless the row says). */
export function standardMaterial(row: StandardMaterialRow): MeshStandardMaterial {
  const p: MeshStandardMaterialParameters = { color: colour(row.color), roughness: row.roughness, metalness: row.metalness };
  if (row.emissive !== undefined) p.emissive = colour(row.emissive);
  if (row.emissiveIntensity !== undefined) p.emissiveIntensity = row.emissiveIntensity;
  if (row.fog !== undefined) p.fog = row.fog;
  return new MeshStandardMaterial(p);
}

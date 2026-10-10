import { InstancedBufferAttribute, InstancedMesh, type BufferGeometry, type Material } from 'three';

/**
 * Baked instance sets (SHARD-PLATFORM M3, offline bakes): a scatter (grass clumps, flowers, boulders over a shard's
 * ground) placed at build time instead of on the page. A generator places its copies into instanced meshes as it always
 * did; `encodeInstanceSets` writes each set's instance matrices (and colours, when it has them) as the float32 words three
 * keeps them in, so the page draws exactly the matrices the live placement computed, bit for bit. They are stored column
 * by column (one matrix element, or colour channel, across every instance): a column that holds one word throughout, or
 * an earlier column's words (or their negation), is stored as its row only. The binary's 4-byte words are split into
 * four byte lanes (every word's first bytes, then its second …: floats compress ~30 % better so) and the bake script
 * deflates it; `fetchInstanceSets` inflates it on the page and `instancedFromSet` builds the draw. Nothing here knows a
 * shard: the set names, the geometry and the material are the caller's.
 */

/**
 * How one column is stored: `lane` (always true) — its words are in the binary; `bits` — every instance holds this one word (the
 * float's bits as a uint32); `of` — the same words as an earlier stored column, its sign bit flipped when `neg`.
 */
export type ColumnRow = { readonly lane: boolean } | { readonly bits: number } | { readonly of: number; readonly neg: boolean };

/** One baked set's row: its name, instance count, its matrix columns (16) and colour columns (3, or null: no colours). */
export interface InstanceSetRow {
  readonly name: string;
  readonly count: number;
  readonly matrix: readonly ColumnRow[];
  readonly color: readonly ColumnRow[] | null;
}

/** One baked set: its instance matrices (16 floats each, as three's `instanceMatrix` holds them) and colours (3 each) or null. */
export interface InstanceSet {
  readonly matrices: Float32Array;
  readonly colors: Float32Array | null;
}

const SIGN = 0x80000000;

/** `words`' columns (`width` per instance) as rows; the stored columns' words are appended to `out`, column by column. */
function planColumns(words: Uint32Array, width: number, out: number[]): ColumnRow[] {
  const count = words.length / width;
  const columns = Array.from({ length: width }, (_, j) => Uint32Array.from({ length: count }, (_unused, i) => words[i * width + j] ?? 0));
  const rows: ColumnRow[] = [];
  columns.forEach((col, j) => {
    const first = col[0] ?? 0;
    if (col.every((w) => w === first)) { rows.push({ bits: first }); return; }
    let row: ColumnRow | null = null;
    for (let k = 0; k < j && row === null; k++) {
      const prior = columns[k], earlier = rows[k];
      if (prior === undefined || earlier === undefined || !('lane' in earlier)) continue;
      if (col.every((w, i) => w === prior[i])) row = { of: k, neg: false };
      else if (col.every((w, i) => w === ((prior[i] ?? 0) ^ SIGN) >>> 0)) row = { of: k, neg: true };
    }
    if (row === null) { row = { lane: true }; for (const w of col) out.push(w); }
    rows.push(row);
  });
  return rows;
}

/** Fills `target` (`count` instances × `rows.length` columns), the stored columns read from `words` at `at`; returns the new `at`. */
function fillColumns(target: Uint32Array, rows: readonly ColumnRow[], count: number, words: Uint32Array, at: number): number {
  const width = rows.length;
  let next = at;
  rows.forEach((row, j) => {
    if ('lane' in row) { for (let i = 0; i < count; i++) target[i * width + j] = words[next + i] ?? 0; next += count; }
    else if ('bits' in row) for (let i = 0; i < count; i++) target[i * width + j] = row.bits;
    else for (let i = 0; i < count; i++) { const w = target[i * width + row.of] ?? 0; target[i * width + j] = row.neg ? (w ^ SIGN) >>> 0 : w; }
  });
  if (next > words.length) throw new Error('decodeInstanceSets: the binary is shorter than its rows');
  return next;
}

/** `words` (a whole number of 4-byte words) as byte lanes: every word's byte 0, then every byte 1, … */
export function shuffleLanes(words: Uint8Array): Uint8Array {
  if (words.length % 4 !== 0) throw new Error('shuffleLanes: not whole words');
  const n = words.length / 4, out = new Uint8Array(words.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[b * n + i] = words[i * 4 + b] ?? 0;
  return out;
}

/** The words from their byte lanes (`shuffleLanes` reversed). */
export function unshuffleLanes(lanes: Uint8Array): Uint8Array {
  if (lanes.length % 4 !== 0) throw new Error('unshuffleLanes: not whole words');
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}

/**
 * Build time: the named instanced meshes' matrices and colours as rows and one lane-shuffled binary (not yet deflated:
 * the bake script deflates it): each set's stored matrix columns, then its stored colour columns, in row order.
 */
export function encodeInstanceSets(meshes: readonly (readonly [string, InstancedMesh])[]): { rows: InstanceSetRow[]; bytes: Uint8Array } {
  const out: number[] = [];
  const rows = meshes.map(([name, mesh]): InstanceSetRow => {
    const matrix = planColumns(new Uint32Array(mesh.instanceMatrix.array.slice(0, mesh.count * 16).buffer), 16, out), colors = mesh.instanceColor;
    return { name, count: mesh.count, matrix, color: colors === null ? null : planColumns(new Uint32Array(colors.array.slice(0, mesh.count * 3).buffer), 3, out) };
  });
  return { rows, bytes: shuffleLanes(new Uint8Array(Uint32Array.from(out).buffer)) };
}

/** The sets from their (unshuffled) words, by name; throws when the binary is not the rows' size. */
export function decodeInstanceSets(bytes: Uint8Array, rows: readonly InstanceSetRow[]): Map<string, InstanceSet> {
  const words = new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), sets = new Map<string, InstanceSet>();
  let at = 0;
  for (const row of rows) {
    const matrices = new Float32Array(row.count * 16);
    at = fillColumns(new Uint32Array(matrices.buffer), row.matrix, row.count, words, at);
    let colors: Float32Array | null = null;
    if (row.color !== null) { colors = new Float32Array(row.count * 3); at = fillColumns(new Uint32Array(colors.buffer), row.color, row.count, words, at); }
    sets.set(row.name, { matrices, colors });
  }
  if (at !== words.length) throw new Error(`decodeInstanceSets: ${String(words.length)} words, the rows hold ${String(at)}`);
  return sets;
}

/** Fetch a deflated, lane-shuffled instance bake and decode it against its rows. */
export async function fetchInstanceSets(url: string, rows: readonly InstanceSetRow[]): Promise<Map<string, InstanceSet>> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  const lanes = new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  return decodeInstanceSets(unshuffleLanes(lanes), rows);
}

/** One instanced draw of `geometry` in `material` with the set's matrices and colours (no instances when `set` is absent). */
export function instancedFromSet(geometry: BufferGeometry, material: Material, set: InstanceSet | undefined): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, set === undefined ? 0 : set.matrices.length / 16);
  if (set === undefined) return mesh;
  mesh.instanceMatrix.array.set(set.matrices);
  if (set.colors !== null) mesh.instanceColor = new InstancedBufferAttribute(set.colors.slice(), 3);
  return mesh;
}

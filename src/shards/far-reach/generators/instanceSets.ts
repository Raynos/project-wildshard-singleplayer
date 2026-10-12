import type { InstancedMesh } from 'three';

/**
 * The bake half of the baked instance sets (`@wildshard/game/plugin/geometry` fetchInstanceSets reads them on the page): each set's instance
 * matrices and colours, column by column, as rows and one lane-shuffled binary.
 */

/** How one column is stored (the page's `ColumnRow`): in the binary, one word throughout, or an earlier column (negated). */
export type ColumnRow = { readonly lane: boolean } | { readonly bits: number } | { readonly of: number; readonly neg: boolean };
/** One baked set's row (the page's `InstanceSetRow`): its name, count, matrix columns (16) and colour columns (3, or null). */
export interface InstanceSetRow { readonly name: string; readonly count: number; readonly matrix: readonly ColumnRow[]; readonly color: readonly ColumnRow[] | null }
/** The float32 sign bit (a negated column's words). */
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

/** `words` (a whole number of 4-byte words) as byte lanes: every word's byte 0, then every byte 1, … */
export function shuffleLanes(words: Uint8Array): Uint8Array {
  if (words.length % 4 !== 0) throw new Error('shuffleLanes: not whole words');
  const n = words.length / 4, out = new Uint8Array(words.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[b * n + i] = words[i * 4 + b] ?? 0;
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

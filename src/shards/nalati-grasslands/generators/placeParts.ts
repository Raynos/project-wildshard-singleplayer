import type { PlaceGeometryRow } from './placeRows';

interface PlacePartRows {
  readonly places: { readonly rows: readonly {
    readonly name: string;
    readonly meshes: readonly { readonly offset: number; readonly geometry: PlaceGeometryRow }[];
  }[] };
}
const widths = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 };
const geometryBytes = (g: PlaceGeometryRow): number => g.attrs.reduce((sum, [, type, width]) => sum + Math.ceil(g.count * width * widths[type] / 4) * 4, 0) + (g.index === null ? 0 : g.indexCount * 4);

/** One detached original packed geometry block, without file publication or a runtime reader. */
export interface NalatiPlacePart { readonly geometry: PlaceGeometryRow; readonly bytes: Uint8Array }

/** Extract the original first-mesh carving/prop blocks from caller-owned raw place words.
 * Callers retain their defining metadata admission. Attribute lanes keep four-byte padding;
 * delta indices retain their original four-byte words. */
export function nalatiPlaceParts(runtime: PlacePartRows, raw: Uint8Array, names: readonly string[]): ReadonlyMap<string, NalatiPlacePart> {
  if (raw.length === 0 || raw.length % 4 !== 0 || raw.length > 256_000_000) throw new Error('Place parts require bounded whole words');
  const parts = new Map<string, NalatiPlacePart>();
  for (const name of names) {
    if (parts.has(name)) throw new Error('Duplicate named place part');
    const rows = runtime.places.rows.filter(row => row.name === name), mesh = rows[0]?.meshes[0];
    if (rows.length !== 1 || mesh === undefined) throw new Error(`Missing or ambiguous place part ${name}`);
    const g = mesh.geometry;
    const size = geometryBytes(g);
    if (!Number.isSafeInteger(mesh.offset) || mesh.offset < 0 || mesh.offset % 4 !== 0 || !Number.isSafeInteger(size) || size <= 0 || mesh.offset + size > raw.length) throw new Error('Place part exceeds its raw geometry words');
    parts.set(name, { geometry: structuredClone(g), bytes: raw.slice(mesh.offset, mesh.offset + size) });
  }
  return parts;
}

/** Compute the original sequential offsets directly from native builder rows.
 * Every packed mesh contributes to the span, including meshes not selected. */
export function nalatiNativePlaceParts(rows: readonly { readonly name: string; readonly meshes: readonly { readonly geometry: PlaceGeometryRow }[] }[], raw: Uint8Array, names: readonly string[]): ReadonlyMap<string, NalatiPlacePart> {
  let offset = 0;
  const placed = rows.map(row => ({ name: row.name, meshes: row.meshes.map(mesh => {
    const at = offset; offset += geometryBytes(mesh.geometry);
    return { offset: at, geometry: mesh.geometry };
  }) }));
  if (offset !== raw.length) throw new Error('Native place parts differ from their complete raw span');
  return nalatiPlaceParts({ places: { rows: placed } }, raw, names);
}

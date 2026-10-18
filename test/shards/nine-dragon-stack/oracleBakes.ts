// Committed predecessor bytes are test oracles only; no product/runtime imports this module.
import * as v from 'valibot';
import { bakedGeometryBytes, readBakedGeometry } from '../../../src/game/plugin/geometry';
import { LayoutBake, layoutReviver } from '../../../src/shards/nine-dragon-stack/world/layoutBake';
import { LayoutRowsSchema } from '../../../src/shards/nine-dragon-stack/generators/sections';
import type { BufferGeometry } from 'three';

const finite = v.number();
const Geometry = v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8'] as const), finite, v.boolean()])),
  count: finite, index: v.nullable(v.picklist(['u16', 'u32'] as const)), indexCount: finite, box: v.boolean(),
});
/** the bake's rows (the binary's JSON head): each geometry under the key its model reads it by, in bake order */
export const SpecimenRowsSchema = v.strictObject({ version: v.literal(1), entries: v.array(v.strictObject({ key: v.string(), geo: Geometry })) });
export type SpecimenRows = v.InferOutput<typeof SpecimenRowsSchema>;

/** Keyed standard GLB geometries, with original typed channels and index. */
export class SpecimenBake {
  constructor(private readonly entries: Map<string, BufferGeometry>) {}
  has(key: string): boolean { return this.entries.has(key); }
  geometry(key: string): BufferGeometry {
    const geometry = this.entries.get(key);
    if (geometry === undefined) throw new Error(`[nine-dragon] no specimen ${key}`);
    return geometry.clone();
  }
  take(key: string): BufferGeometry {
    const geometry = this.entries.get(key);
    if (geometry === undefined) throw new Error(`[nine-dragon] no specimen ${key}`);
    this.entries.delete(key); return geometry;
  }
}


export function oracleLayout(bytes: Uint8Array): LayoutBake {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), jsonBytes = header.getUint32(0, true), count = header.getUint32(4, true);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + jsonBytes)), layoutReviver);
  const rows = v.parse(LayoutRowsSchema, parsed);
  let offset = Math.ceil((8 + jsonBytes) / 8) * 8;
  const records = new Float64Array(bytes.slice(offset, offset + count * 8).buffer); offset += count * 8;
  const geometries = new Map<number, ReturnType<typeof readBakedGeometry>>();
  for (const [index, row] of rows.geometries.entries()) { geometries.set(index, readBakedGeometry(bytes, offset, row)); offset += bakedGeometryBytes(row); }
  if (offset !== bytes.length) throw new Error('Nine layout oracle size differs');
  return new LayoutBake(rows, [...records], geometries);
}
export function oracleSpecimens(bytes: Uint8Array): SpecimenBake {
  const jsonBytes = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + jsonBytes)));
  const rows = v.parse(SpecimenRowsSchema, parsed);
  let offset = Math.ceil((4 + jsonBytes) / 4) * 4;
  const geometries = new Map<string, ReturnType<typeof readBakedGeometry>>();
  for (const { key, geo } of rows.entries) { geometries.set(key, readBakedGeometry(bytes, offset, geo)); offset += bakedGeometryBytes(geo); }
  if (offset !== bytes.length) throw new Error('Nine specimens oracle size differs');
  return new SpecimenBake(geometries);
}

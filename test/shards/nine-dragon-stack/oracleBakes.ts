// Committed predecessor bytes are test oracles only; no product/runtime imports this module.
import * as v from 'valibot';
import { bakedGeometryBytes, readBakedGeometry } from '../../../src/game/plugin/geometry';
import { LayoutBake, LayoutRowsSchema, layoutReviver } from '../../../src/shards/nine-dragon-stack/world/layoutBake';
import { SpecimenBake, SpecimenRowsSchema } from '../../../src/shards/nine-dragon-stack/world/specimens';

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

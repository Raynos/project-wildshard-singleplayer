import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF } from '../core/config';

const MAGIC = 0x31545457, HEADER = 32;
/** Baked row-major heights in a shard-local square; optional linear RGB values describe the rendered vertices. */
export interface TerrainTileData {
  resolution: number; x: number; z: number; size: number;
  heights: Float32Array; colours?: Float32Array;
}
function check(data: TerrainTileData): void {
  const { resolution: r, x, z, size, heights, colours } = data;
  if (!Number.isInteger(r) || r < 2 || r > 257 || ![x, z, size].every(Number.isFinite) || size <= 0 || x < -CHUNK_HALF || z < -CHUNK_HALF || x + size > CHUNK_HALF || z + size > CHUNK_HALF || heights.length !== r * r || (colours !== undefined && colours.length !== r * r * 3)) throw new Error('Invalid terrain dimensions');
  if (heights.some((h) => !Number.isFinite(h) || h < -CELL_BELOW || h > CELL_ABOVE) || colours?.some((c) => !Number.isFinite(c) || c < 0 || c > 1)) throw new Error('Invalid terrain samples');
}
/** Recognise the terrain wire format before its full bounded decoder checks the payload. */
export function isTerrainTileData(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === MAGIC;
}
/** Encode version-one terrain using explicit little-endian floats, without host paths or timestamps. */
export function encodeTerrainTile(data: TerrainTileData): Uint8Array {
  check(data);
  const bytes = new Uint8Array(HEADER + data.heights.length * (data.colours === undefined ? 4 : 16));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true); view.setUint16(4, 1, true); view.setUint16(6, data.resolution, true);
  view.setUint32(8, data.colours === undefined ? 0 : 1, true);
  view.setFloat32(12, data.x, true); view.setFloat32(16, data.z, true); view.setFloat32(20, data.size, true);
  data.heights.forEach((height, i) => view.setFloat32(HEADER + i * 4, height, true));
  data.colours?.forEach((colour, i) => view.setFloat32(HEADER + data.heights.length * 4 + i * 4, colour, true));
  return bytes;
}
/** Validate dimensions and exact byte counts before allocating sample arrays; reject unknown versions and flags. */
export function decodeTerrainTile(bytes: Uint8Array): TerrainTileData {
  if (bytes.length < HEADER || !isTerrainTileData(bytes)) throw new Error('Invalid terrain header');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), r = v.getUint16(6, true), flags = v.getUint32(8, true);
  if (v.getUint16(4, true) !== 1 || r < 2 || r > 257 || flags > 1 || v.getUint32(24, true) !== 0 || v.getUint32(28, true) !== 0 || bytes.length !== HEADER + r * r * (flags === 0 ? 4 : 16)) throw new Error('Invalid terrain version or length');
  const heights = Float32Array.from({ length: r * r }, (_, i) => v.getFloat32(HEADER + i * 4, true));
  const data: TerrainTileData = { resolution: r, x: v.getFloat32(12, true), z: v.getFloat32(16, true), size: v.getFloat32(20, true), heights };
  if (flags === 1) data.colours = Float32Array.from({ length: r * r * 3 }, (_, i) => v.getFloat32(HEADER + r * r * 4 + i * 4, true));
  check(data); return data;
}
/** Sample the same diagonal split as Rapier heightfields, rather than a bilinear surface that differs from collision. */
export function terrainTileHeight(data: TerrainTileData, x: number, z: number): number {
  if (![x, z].every(Number.isFinite) || x < data.x || z < data.z || x > data.x + data.size || z > data.z + data.size) throw new Error('Point outside terrain');
  const n = data.resolution - 1, gx = (x - data.x) / data.size * n, gz = (z - data.z) / data.size * n;
  const ix = Math.min(n - 1, Math.floor(gx)), iz = Math.min(n - 1, Math.floor(gz)), u = gx - ix, v = gz - iz;
  const at = (dx: number, dz: number): number => data.heights[(iz + dz) * data.resolution + ix + dx] ?? 0;
  return u + v <= 1 ? at(0, 0) + (at(1, 0) - at(0, 0)) * u + (at(0, 1) - at(0, 0)) * v : at(1, 1) + (at(0, 1) - at(1, 1)) * (1 - u) + (at(1, 0) - at(1, 1)) * (1 - v);
}
/** Conservative sample/mesh residency and draws, including an L0 shadow pass; collider-only payloads have no draws. */
export function terrainTileCost(data: TerrainTileData): { decoded: number; gpu: number; triangles: number; draws: number } {
  const vertices = data.resolution ** 2, cells = (data.resolution - 1) ** 2, skirt = data.resolution === 17 && data.size === 125 ? 0 : 4 * (data.resolution - 1);
  const indexBytes = (cells * 6 + skirt * 6) * (vertices + skirt > 65535 ? 4 : 2);
  return data.colours === undefined ? { decoded: HEADER + vertices * 8, gpu: 0, triangles: 0, draws: 0 }
    : { decoded: HEADER + vertices * (skirt === 0 ? 56 : 68) + skirt * 36 + indexBytes, gpu: (vertices + skirt) * 36 + indexBytes, triangles: cells * 2 + skirt * 2, draws: data.size === 62.5 ? 2 : 1 };
}

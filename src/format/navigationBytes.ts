/** WSNM v1 little-endian voxel/detail layout. Pure decoding: no navcat, renderer or service. */
export type NavigationBounds = [number, number, number, number, number, number];
/** A walkable polygon: ordered vertex and neighbour indices, traversal flags and area id. */
export interface NavigationPoly { vertices: number[]; neis: number[]; flags: number; area: number }
/** Offsets and counts into a tile's detailed height-sample vertices and triangle arrays. */
export interface NavigationDetail { verticesBase: number; verticesCount: number; trianglesBase: number; trianglesCount: number }
/** One decoded tile in world metres, retaining original polygon order and detailed height samples. */
export interface NavigationTileData {
  bounds: NavigationBounds; vertices: number[]; polys: NavigationPoly[];
  detailMeshes: NavigationDetail[]; detailVertices: number[]; detailTriangles: number[];
  tileX: number; tileY: number; tileLayer: number;
}
/** One agent-clearance layer and its voxel dimensions, world origin and ordered decoded tiles. */
export interface NavigationLayerData {
  radius: number; height: number; climb: number; cellSize: number; cellHeight: number;
  origin: [number, number, number]; tileSize: number; tiles: NavigationTileData[];
}
const Q = 100;
const NEI_EXT = 248;
class Reader {
  private at = 0;
  private readonly dv: DataView;
  constructor(buf: ArrayBuffer) { this.dv = new DataView(buf); }
  get done(): boolean { return this.at === this.dv.byteLength; }
  private need(n: number): void { if (this.at + n > this.dv.byteLength) throw new RangeError('navmesh: truncated'); }
  u8(): number { this.need(1); return this.dv.getUint8(this.at++); }
  u16(): number { this.need(2); const v = this.dv.getUint16(this.at, true); this.at += 2; return v; }
  u32(): number { this.need(4); const v = this.dv.getUint32(this.at, true); this.at += 4; return v; }
  i32(): number { this.need(4); const v = this.dv.getInt32(this.at, true); this.at += 4; return v; }
  f32(): number { this.need(4); const v = this.dv.getFloat32(this.at, true); this.at += 4; return v; }
  u8s(n: number): number[] { const out: number[] = []; for (let i = 0; i < n; i++) out.push(this.u8()); return out; }
  u16s(n: number): number[] { const out: number[] = []; for (let i = 0; i < n; i++) out.push(this.u16()); return out; }
}

function readLayer(r: Reader): NavigationLayerData {
  const radius = r.f32(), height = r.f32(), climb = r.f32(), cellSize = r.f32(), cellHeight = r.f32();
  const origin: [number, number, number] = [r.f32(), r.f32(), r.f32()], tileSize = r.f32();
  if (![radius, height, climb, cellSize, cellHeight, ...origin, tileSize].every(Number.isFinite) || radius <= 0 || height <= 0 || climb < 0 || cellSize <= 0 || cellHeight <= 0 || tileSize <= 0) throw new RangeError("Invalid navigation layer");
  const tiles = r.u32(), decoded: NavigationTileData[] = [];
  if (tiles > 4096) throw new RangeError("Navigation tile cap");
  const occupied = new Set<string>();
  for (let t = 0; t < tiles; t++) {
    const tileX = r.i32(), tileY = r.i32();
    const bounds: NavigationBounds = [r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32()];
    if (Math.abs(tileX) > 1024 || Math.abs(tileY) > 1024 || occupied.has(`${tileX}:${tileY}`) || !bounds.every(Number.isFinite) || bounds.slice(0, 3).some((min, axis) => min > (bounds[axis + 3] ?? min)) || bounds.some(value => Math.abs(value) > 16384)) throw new RangeError("Invalid navigation tile bounds or identity");
    occupied.add(`${tileX}:${tileY}`);
    const nv = r.u16(), np = r.u16(), nd = r.u16();
    // polygon vertices sit on the voxel grid: x / z in cells, y in cell heights, above the tile's min corner
    const gx = r.u8s(nv), gz = r.u8s(nv), gy = r.u16s(nv);
    const vertices: number[] = [];
    for (let i = 0; i < nv; i++) vertices.push(bounds[0] + (gx[i] ?? 0) * cellSize, bounds[1] + (gy[i] ?? 0) * cellHeight, bounds[2] + (gz[i] ?? 0) * cellSize);
    const counts = r.u8s(np), areas = r.u8s(np), flags = r.u8s(np);
    if (counts.some(n => n < 3 || n > 12)) throw new RangeError("Invalid navigation polygon");
    const total = counts.reduce((a, b) => a + b, 0);
    const idx = nv <= 256 ? r.u8s(total) : r.u16s(total);
    const neis = np < NEI_EXT ? r.u8s(total).map((n) => (n >= NEI_EXT ? 0x8000 | (n - NEI_EXT) : n)) : r.u16s(total);
    if (idx.some(index => index >= nv) || neis.some(n => n !== 0 && n < 0x8000 && n > np)) throw new RangeError("Invalid navigation polygon reference");
    const polys: NavigationPoly[] = [];
    let k = 0;
    for (let p = 0; p < np; p++) {
      const n = counts[p] ?? 0;
      polys.push({ vertices: idx.slice(k, k + n), neis: neis.slice(k, k + n), flags: flags[p] ?? 0, area: areas[p] ?? 0 });
      k += n;
    }
    const detailVerts = r.u8s(np), detailTris = r.u8s(np);
    if (detailVerts.reduce((sum, count) => sum + count, 0) !== nd) throw new RangeError("Invalid navigation detail count");
    const detailVertices: number[] = [];
    for (let i = 0; i < nd * 3; i++) detailVertices.push((bounds[i % 3] ?? 0) + r.u16() / Q);
    // a poly with its own height samples brings its triangles; one without is fanned from its vertices (as
    // navcat's polysToTileDetailMesh does)
    const detailMeshes: NavigationDetail[] = [], detailTriangles: number[] = [];
    let vb = 0;
    for (let p = 0; p < np; p++) {
      const dv = detailVerts[p] ?? 0, stored = detailTris[p] ?? 0, n = counts[p] ?? 0;
      const trianglesBase = detailTriangles.length / 4;
      if (stored > 0) {
        const triangles = r.u8s(stored * 4);
        if (triangles.some((value, index) => index % 4 < 3 && value >= n + dv)) throw new RangeError('Invalid navigation detail triangle reference');
        detailTriangles.push(...triangles);
      }
      else for (let j = 2; j < n; j++) detailTriangles.push(0, j - 1, j, (1 << 2) | (j === 2 ? 1 : 0) | (j === n - 1 ? 1 << 4 : 0));
      detailMeshes.push({ verticesBase: vb, verticesCount: dv, trianglesBase, trianglesCount: detailTriangles.length / 4 - trianglesBase });
      vb += dv;
    }
    decoded.push({ bounds, vertices, polys, detailMeshes, detailVertices, detailTriangles, tileX, tileY, tileLayer: 0 });
  }
  return { radius, height, climb, cellSize, cellHeight, origin, tileSize, tiles: decoded };
}


/** Recognize only the platform-owned WSNM header; malformed recognized data still refuses decoding. */
export function isNavigationData(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === 0x4d4e5357;
}
/** Bound the complete stream before constructing any runtime navigation mesh. */
export function decodeNavigation(bytes: Uint8Array): NavigationLayerData[] {
  if (bytes.length > 16_000_000) throw new RangeError('Navigation byte cap');
  const r = new Reader(Uint8Array.from(bytes).buffer);
  if (r.u32() !== 0x4d4e5357 || r.u32() !== 1) throw new RangeError('Navigation requires WSNM v1');
  const n = r.u32(); if (n < 1 || n > 16) throw new RangeError('Navigation layer cap');
  const layers: NavigationLayerData[] = [];
  for (let i = 0; i < n; i++) layers.push(readLayer(r));
  if (!r.done || layers.every(layer => layer.tiles.length === 0)) throw new RangeError('Navigation trailing bytes or empty mesh');
  return layers;
}
/** Conservative retained CPU charge for decoded arrays, polygons and navcat query structures. */
export function navigationCost(bytes: Uint8Array): { decoded: number; gpu: number; triangles: number; draws: number } {
  const layers = decodeNavigation(bytes);
  const decoded = bytes.length + layers.reduce((sum, layer) => sum + 256 + layer.tiles.reduce((cost, tile) => cost + 1024 + tile.polys.length * 512 + (tile.vertices.length + tile.detailVertices.length + tile.detailTriangles.length + tile.polys.reduce((n, poly) => n + poly.vertices.length + poly.neis.length, 0)) * 16, 0), 0);
  return { decoded, gpu: 0, triangles: 0, draws: 0 };
}

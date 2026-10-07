/** Bounds for one indexed collision chunk; larger geometry must be partitioned before encoding. */
export const MESH_COLLISION_LIMITS = Object.freeze({ vertices: 120000, triangles: 40000, coordinate: 250 });
const MAGIC = 0x31434d57; // WMC1, little endian.
const HEADER = 24;

/** Cell-local triangle geometry. Each index names a vertex in the packed XYZ array; winding is preserved. */
export interface MeshCollisionData { vertices: Float32Array; indices: Uint32Array }

function counts(vertices: number, indices: number): number {
  if (!Number.isSafeInteger(vertices) || vertices < 3 || vertices > MESH_COLLISION_LIMITS.vertices
    || !Number.isSafeInteger(indices) || indices < 3 || indices % 3 !== 0 || indices / 3 > MESH_COLLISION_LIMITS.triangles) {
    throw new Error('Mesh collision counts exceed chunk limits');
  }
  return HEADER + vertices * 12 + indices * 4;
}
function validate(data: MeshCollisionData): void {
  const n = data.vertices.length / 3;
  counts(n, data.indices.length);
  for (const value of data.vertices) if (!Number.isFinite(value) || Math.abs(value) > MESH_COLLISION_LIMITS.coordinate) throw new Error('Mesh collision position outside finite bounds');
  const used = new Uint8Array(n);
  for (let i = 0; i < data.indices.length; i += 3) {
    const a = data.indices[i], b = data.indices[i + 1], c = data.indices[i + 2];
    if (a === undefined || b === undefined || c === undefined || a >= n || b >= n || c >= n) throw new Error('Mesh collision index outside vertex array');
    used[a] = 1; used[b] = 1; used[c] = 1;
    const ax = data.vertices[a * 3], ay = data.vertices[a * 3 + 1], az = data.vertices[a * 3 + 2];
    const bx = data.vertices[b * 3], by = data.vertices[b * 3 + 1], bz = data.vertices[b * 3 + 2];
    const cx = data.vertices[c * 3], cy = data.vertices[c * 3 + 1], cz = data.vertices[c * 3 + 2];
    if (ax === undefined || ay === undefined || az === undefined || bx === undefined || by === undefined || bz === undefined || cx === undefined || cy === undefined || cz === undefined) throw new Error('Mesh collision missing vertex');
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    if (uy * vz - uz * vy === 0 && uz * vx - ux * vz === 0 && ux * vy - uy * vx === 0) throw new Error('Mesh collision degenerate triangle');
  }
  if (used.includes(0)) throw new Error('Mesh collision unreferenced vertex');
}

/** Identify WMC1 bytes without allocating or admitting their contents. */
export function isMeshCollisionData(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === MAGIC;
}

/** Encode bounded indexed geometry deterministically, with no simplification or heightfield conversion. */
export function encodeMeshCollision(data: MeshCollisionData): Uint8Array {
  validate(data);
  const bytes = new Uint8Array(counts(data.vertices.length / 3, data.indices.length));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true); view.setUint16(4, 1, true);
  view.setUint32(8, data.vertices.length / 3, true); view.setUint32(12, data.indices.length, true);
  let at = HEADER;
  for (const value of data.vertices) { view.setFloat32(at, value, true); at += 4; }
  for (const index of data.indices) { view.setUint32(at, index, true); at += 4; }
  return bytes;
}

/** Admit exact WMC1 wire bytes before native allocation and return owned arrays, including for unaligned input. */
export function decodeMeshCollision(bytes: Uint8Array): MeshCollisionData {
  if (bytes.byteLength < HEADER) throw new Error('Mesh collision truncated header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC || view.getUint16(4, true) !== 1 || view.getUint16(6, true) !== 0
    || view.getUint32(16, true) !== 0 || view.getUint32(20, true) !== 0) throw new Error('Mesh collision unsupported header');
  const n = view.getUint32(8, true), m = view.getUint32(12, true);
  if (bytes.byteLength !== counts(n, m)) throw new Error('Mesh collision wire length mismatch');
  const vertices = new Float32Array(n * 3), indices = new Uint32Array(m);
  let at = HEADER;
  for (let i = 0; i < vertices.length; i++) { vertices[i] = view.getFloat32(at, true); at += 4; }
  for (let i = 0; i < indices.length; i++) { indices[i] = view.getUint32(at, true); at += 4; }
  const data = { vertices, indices }; validate(data); return data;
}

/** Provisional collision residency: two wire copies, 64 bytes/vertex and 256 bytes/triangle; no render resources.
 * Native snapshot probes are a lower-bound check, not a native-heap measurement. SF22a must replace this model
 * with measured allocation costs before a shard using mesh collision ships.
 */
export function meshCollisionCost(data: MeshCollisionData): { decoded: number; gpu: number; triangles: number; draws: number } {
  validate(data);
  const vertices = data.vertices.length / 3, triangles = data.indices.length / 3;
  return { decoded: counts(vertices, data.indices.length) * 2 + vertices * 64 + triangles * 256, gpu: 0, triangles: 0, draws: 0 };
}

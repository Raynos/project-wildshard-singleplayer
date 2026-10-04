import { decodeTerrainTile, isTerrainTileData, terrainTileCost } from '@wildshard/engine/world/terrainTileData';

/** Actual costs derived from a bounded parser, never trusted from the author declaration. */
export interface AssetCost { decoded: number; gpu: number; triangles: number; draws: number }
const MAX_BYTES = 25_000_000;
const MAX_ELEMENTS = 4_000_000;
function requireRange(bytes: Uint8Array, offset: number, size: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length) throw new Error('asset truncated or oversized');
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('asset object required');
  return value as Record<string, unknown>;
}
function list(value: unknown): unknown[] { if (!Array.isArray(value) || value.length > 10_000) throw new Error('asset array required or oversized'); return value; }
function count(value: unknown, max = MAX_ELEMENTS): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('asset count outside cap'); return value; }
function json(bytes: Uint8Array): unknown { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }

/** Parse self-contained GLB 2 without following URLs or allocating accessor-sized arrays. */
export function parseGlb(bytes: Uint8Array): AssetCost {
  requireRange(bytes, 0, 20); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > MAX_BYTES || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) throw new Error('invalid GLB header');
  const length = view.getUint32(12, true); requireRange(bytes, 20, length);
  if (length > 2_000_000 || length % 4 !== 0 || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('invalid GLB JSON chunk');
  const doc = object(json(bytes.subarray(20, 20 + length))); const asset = object(doc['asset']);
  if (asset['version'] !== '2.0') throw new Error('GLB asset version');
  let binaryBytes = 0;
  if (20 + length < bytes.length) {
    requireRange(bytes, 20 + length, 8); const n = view.getUint32(20 + length, true);
    if (view.getUint32(24 + length, true) !== 0x004e4942 || n % 4 !== 0 || 28 + length + n !== bytes.length) throw new Error('invalid GLB binary chunk');
    binaryBytes = n;
  }
  for (const buffer of list(doc['buffers'] ?? [])) {
    const b = object(buffer); if (b['uri'] !== undefined || count(b['byteLength'], MAX_BYTES) > binaryBytes) throw new Error('external or truncated GLB buffer');
  }
  const views = list(doc['bufferViews'] ?? []).map(object);
  for (const b of views) if (count(b['buffer'] ?? 0, 0) !== 0 || count(b['byteOffset'] ?? 0, MAX_BYTES) + count(b['byteLength'], MAX_BYTES) > binaryBytes) throw new Error('GLB buffer view outside buffer');
  let gpu = 0;
  const accessors = list(doc['accessors'] ?? []).map((entry) => {
    const a = object(entry), components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16, MAT3: 9, MAT2: 4 };
    const widths: Record<string, number> = { '5120': 1, '5121': 1, '5122': 2, '5123': 2, '5125': 4, '5126': 4 };
    const width = widths[String(a['componentType'])], dimension = components[String(a['type'])], n = count(a['count']);
    if (width === undefined || dimension === undefined || a['sparse'] !== undefined) throw new Error('unsupported GLB accessor');
    const bufferView = views[count(a['bufferView'], 10_000)]; if (bufferView === undefined) throw new Error('missing GLB accessor view');
    const size = width * dimension, stride = count(bufferView['byteStride'] ?? size, 252), offset = count(a['byteOffset'] ?? 0, MAX_BYTES);
    if (stride < size || offset + (n === 0 ? 0 : (n - 1) * stride + size) > count(bufferView['byteLength'], MAX_BYTES)) throw new Error('GLB accessor outside view');
    gpu += n * size; return { n, type: a['type'], component: a['componentType'], offset: count(bufferView['byteOffset'] ?? 0, MAX_BYTES) + offset, stride, width, dimension };
  });
  if (list(doc['images'] ?? []).length > 0) throw new Error('GLB textures must be separate declared KTX2 assets');
  const meshCosts = list(doc['meshes'] ?? []).map((mesh) => {
    let triangles = 0, draws = 0;
    for (const primitive of list(object(mesh)['primitives'])) {
      const p = object(primitive); if ((p['mode'] ?? 4) !== 4 || p['extensions'] !== undefined) throw new Error('unsupported GLB primitive');
      const attributes = object(p['attributes']);
      const position = accessors[count(attributes['POSITION'], 10_000)];
      const index = accessors[count(p['indices'] ?? attributes['POSITION'], 10_000)];
      if (position === undefined || position.type !== 'VEC3' || index === undefined || index.n % 3 !== 0) throw new Error('invalid GLB triangle accessor');
      triangles += index.n / 3; draws++;
      for (const id of Object.values(attributes)) if (accessors[count(id, 10_000)] === undefined) throw new Error('missing GLB attribute');
    }
    return { triangles, draws };
  });
  let triangles = 0, draws = 0, instanceCpu = 0;
  const nodes = list(doc['nodes'] ?? []).map(object);
  for (const node of nodes) {
    if (node['mesh'] === undefined) continue;
    const cost = meshCosts[count(node['mesh'], 10_000)]; if (cost === undefined) throw new Error('missing GLB mesh');
    let instances = 1;
    if (node['extensions'] !== undefined) {
      const extensions = object(node['extensions']);
      if (Object.keys(extensions).some((key) => key !== 'EXT_mesh_gpu_instancing')) throw new Error('unsupported GLB node extension');
      const attributes = object(object(extensions['EXT_mesh_gpu_instancing'])['attributes']);
      let size: number | undefined;
      for (const [key, id] of Object.entries(attributes)) {
        const a = accessors[count(id, 10_000)], dimension = key === 'ROTATION' ? 4 : 3;
        if (!['TRANSLATION', 'ROTATION', 'SCALE'].includes(key) || a === undefined || a.component !== 5126 || a.dimension !== dimension || a.n === 0 || a.n > 10_000 || (size !== undefined && a.n !== size)) throw new Error('invalid GLB instance attribute');
        size = a.n;
        for (let i = 0; i < a.n; i++) {
          let norm = 0;
          for (let c = 0; c < dimension; c++) {
            const n = view.getFloat32(28 + length + a.offset + i * a.stride + c * 4, true);
            if (!Number.isFinite(n) || (key === 'SCALE' && (n <= 0 || n > 1000))) throw new Error('invalid GLB instance transform');
            norm += n * n;
          }
          if (key === 'ROTATION' && Math.abs(norm - 1) > 1e-4) throw new Error('invalid GLB instance quaternion');
        }
      }
      if (size === undefined) throw new Error('empty GLB instance list');
      instances = size; gpu += size * 64; instanceCpu += size * 64;
    }
    const shadow = node['extras'] === undefined ? true : object(node['extras'])['castShadow'] ?? true;
    if (typeof shadow !== 'boolean') throw new Error('invalid GLB shadow flag');
    triangles += cost.triangles * instances; draws += cost.draws * (shadow ? 2 : 1);
  }
  // Old GLB fixtures omit scene nodes; count their mesh resources conservatively too.
  if (nodes.length === 0) for (const cost of meshCosts) { triangles += cost.triangles; draws += cost.draws * 2; }
  if (gpu > MAX_BYTES || triangles > 400_000 || draws > 512) throw new Error('GLB resource cap');
  return { decoded: length + binaryBytes + instanceCpu, gpu, triangles, draws };
}

/** Parse bounded KTX2 headers and mip ranges; RGBA residency is the conservative transcode upper bound. */
export function parseKtx2(bytes: Uint8Array): AssetCost {
  requireRange(bytes, 0, 80); const signature = [171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10];
  if (bytes.length > MAX_BYTES || signature.some((n, i) => bytes[i] !== n)) throw new Error('invalid KTX2 signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = view.getUint32(20, true), height = view.getUint32(24, true), levels = view.getUint32(40, true);
  if (width === 0 || height === 0 || width > 4096 || height > 4096 || levels === 0 || levels > 13 || view.getUint32(28, true) > 1 || view.getUint32(32, true) > 1 || view.getUint32(36, true) !== 1 || view.getUint32(44, true) > 2) throw new Error('KTX2 dimensions or encoding cap');
  requireRange(bytes, 80, levels * 24); let gpu = 0; const ranges: [number, number][] = [];
  for (let i = 0; i < levels; i++) {
    const offset = Number(view.getBigUint64(80 + i * 24, true)), size = Number(view.getBigUint64(88 + i * 24, true)), raw = Number(view.getBigUint64(96 + i * 24, true));
    requireRange(bytes, offset, size); if (offset < 80 + levels * 24 || size === 0 || raw > MAX_BYTES || ranges.some(([start, end]) => offset < end && offset + size > start)) throw new Error('KTX2 mip range'); ranges.push([offset, offset + size]);
    gpu += Math.max(1, width >> i) * Math.max(1, height >> i) * 4;
  }
  const dfd = view.getUint32(48, true), dfdSize = view.getUint32(52, true); requireRange(bytes, dfd, dfdSize);
  if (dfdSize < 24 || dfd < 80 + levels * 24 || ranges.some(([start, end]) => dfd < end && dfd + dfdSize > start) || gpu > MAX_BYTES) throw new Error('KTX2 descriptor or residency cap');
  return { decoded: 0, gpu, triangles: 0, draws: 0 };
}

/** Parse PCM WAV without decoding samples; duration/channel caps bound decoded audio memory. */
export function parseAudio(bytes: Uint8Array): AssetCost {
  requireRange(bytes, 0, 12); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = (at: number): string => new TextDecoder().decode(bytes.subarray(at, at + 4));
  if (bytes.length > MAX_BYTES || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw new Error('invalid WAV header');
  let at = 12, channels = 0, rate = 0, alignment = 0, data = 0;
  while (at < bytes.length) {
    requireRange(bytes, at, 8); const n = view.getUint32(at + 4, true); requireRange(bytes, at + 8, n);
    if (tag(at) === 'fmt ') {
      if (channels !== 0 || n < 16 || view.getUint16(at + 8, true) !== 1) throw new Error('unsupported WAV format');
      channels = view.getUint16(at + 10, true); rate = view.getUint32(at + 12, true); alignment = view.getUint16(at + 20, true); const bits = view.getUint16(at + 22, true);
      if (channels < 1 || channels > 2 || rate < 8000 || rate > 96000 || ![8, 16, 24, 32].includes(bits) || alignment !== channels * bits / 8 || view.getUint32(at + 16, true) !== rate * alignment) throw new Error('WAV channel/rate cap');
    } else if (tag(at) === 'data') { if (data !== 0) throw new Error('duplicate WAV data'); data = n; }
    at += 8 + n + (n % 2);
  }
  if (channels === 0 || data === 0 || data % alignment !== 0 || data / alignment / rate > 180 || at !== bytes.length) throw new Error('WAV duration or data cap');
  return { decoded: data / alignment * channels * 4, gpu: 0, triangles: 0, draws: 0 };
}
/** Select the format parser; binary/JSON/Wasm are bounded before higher-level content validators run. */
export function assetCost(kind: string, bytes: Uint8Array): AssetCost {
  if (kind === 'glb') return parseGlb(bytes);
  if (kind === 'ktx2') return parseKtx2(bytes);
  if (kind === 'audio') return parseAudio(bytes);
  if (bytes.length > MAX_BYTES) throw new Error('asset byte cap');
  if (kind === 'binary' && isTerrainTileData(bytes)) return terrainTileCost(decodeTerrainTile(bytes));
  if (kind === 'json') { json(bytes); return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 }; }
  if (kind === 'wasm' && (bytes.length > 262_144 || !WebAssembly.validate(Uint8Array.from(bytes)))) throw new Error('invalid or oversized Wasm');
  return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 };
}

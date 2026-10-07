import { decodeTerrainTile, isTerrainTileData, terrainTileCost } from '@wildshard/engine/world/terrainTileData';
import { decodeMeshCollision, isMeshCollisionData, meshCollisionCost } from '@wildshard/engine/core/meshCollision';
import { visitGlbGeometry, type GlbVertex } from './glbTriangles';
import { projectedLayerCoverage, type OverdrawEstimate } from './overdraw';

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
export function parseGlb(bytes: Uint8Array): AssetCost { return parseGlbData(bytes); }
/** Inspect exact static triangles only after the bounded GLB parser admits the complete payload. */
export function visitGlbTriangles(bytes: Uint8Array, visit: (triangle: readonly GlbVertex[]) => void): void { parseGlbData(bytes, visit); }
/** Shared byte-derived raster estimate; no author-supplied overdraw number is accepted. */
export function assetOverdraw(kind: string, bytes: Uint8Array): OverdrawEstimate {
  const estimate: OverdrawEstimate = { layers: 0, blendedLayers: 0, maskedLayers: 0, basis: 'primitive-bounds' };
  if (kind === 'glb') parseGlbData(bytes, undefined, estimate);
  else { assetCost(kind, bytes); if (isTerrainTileData(bytes)) estimate.layers = 1; }
  return estimate;
}
function parseGlbData(bytes: Uint8Array, visit?: (triangle: readonly GlbVertex[]) => void, estimate?: OverdrawEstimate): AssetCost {
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
  let gpu = 0, elements = 0;
  const accessors = list(doc['accessors'] ?? []).map((entry) => {
    const a = object(entry), components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16, MAT3: 9, MAT2: 4 };
    const widths: Record<string, number> = { '5120': 1, '5121': 1, '5122': 2, '5123': 2, '5125': 4, '5126': 4 };
    const width = widths[String(a['componentType'])], dimension = components[String(a['type'])], n = count(a['count']);
    if (width === undefined || dimension === undefined || a['sparse'] !== undefined) throw new Error('unsupported GLB accessor');
    elements += n * dimension;
    if (elements > MAX_ELEMENTS * 16) throw new Error('GLB aggregate accessor cap');
    const bufferView = views[count(a['bufferView'], 10_000)]; if (bufferView === undefined) throw new Error('missing GLB accessor view');
    const size = width * dimension, stride = count(bufferView['byteStride'] ?? size, 252), offset = count(a['byteOffset'] ?? 0, MAX_BYTES);
    if (stride < size || offset + (n === 0 ? 0 : (n - 1) * stride + size) > count(bufferView['byteLength'], MAX_BYTES)) throw new Error('GLB accessor outside view');
    gpu += n * size; return { n, type: a['type'], component: a['componentType'], offset: count(bufferView['byteOffset'] ?? 0, MAX_BYTES) + offset, stride, width, dimension, normalized: a['normalized'] === true };
  });
  const read = (a: typeof accessors[number], row: number, component: number): number => {
    const at = 28 + length + a.offset + row * a.stride + component * a.width;
    switch (a.component) {
      case 5121: return view.getUint8(at);
      case 5123: return view.getUint16(at, true);
      case 5125: return view.getUint32(at, true);
      case 5126: return view.getFloat32(at, true);
      default: throw new Error('unsupported GLB rig component');
    }
  };
  const checkedPositions = new Set<number>(), maximumIndices = new Map<number, number>();
  const materials = list(doc['materials'] ?? []).map(object);
  if (list(doc['images'] ?? []).length > 0) throw new Error('GLB textures must be separate declared KTX2 assets');
  const meshCosts = list(doc['meshes'] ?? []).map((mesh) => {
    let triangles = 0, draws = 0, layers = 0, blendedLayers = 0, maskedLayers = 0;
    for (const primitive of list(object(mesh)['primitives'])) {
      const p = object(primitive); if ((p['mode'] ?? 4) !== 4 || p['extensions'] !== undefined) throw new Error('unsupported GLB primitive');
      const attributes = object(p['attributes']);
      const positionId = count(attributes['POSITION'], 10_000), position = accessors[positionId];
      const indexId = count(p['indices'] ?? attributes['POSITION'], 10_000), index = accessors[indexId];
      if (position === undefined || position.type !== 'VEC3' || position.component !== 5126 || index === undefined || index.n % 3 !== 0) throw new Error('invalid GLB triangle accessor');
      if (!checkedPositions.has(positionId)) {
        for (let i = 0; i < position.n; i++) for (let c = 0; c < 3; c++) if (!Number.isFinite(read(position, i, c))) throw new Error('nonfinite GLB position');
        checkedPositions.add(positionId);
      }
      if (p['indices'] !== undefined) {
        if (index.type !== 'SCALAR' || ![5121, 5123, 5125].includes(Number(index.component))) throw new Error('invalid GLB index encoding');
        let maximum = maximumIndices.get(indexId);
        if (maximum === undefined) { maximum = -1; for (let i = 0; i < index.n; i++) maximum = Math.max(maximum, read(index, i, 0)); maximumIndices.set(indexId, maximum); }
        if (maximum >= position.n) throw new Error('GLB index outside positions');
      }
      triangles += index.n / 3; draws++;
      const material = p['material'] === undefined ? undefined : materials[count(p['material'], 10_000)];
      if (p['material'] !== undefined && material === undefined) throw new Error('missing GLB material');
      const alpha = material?.['alphaMode'] ?? 'OPAQUE';
      if (typeof alpha !== 'string' || !['OPAQUE', 'MASK', 'BLEND'].includes(alpha)) throw new Error('unsupported GLB alpha mode');
      if (estimate !== undefined) {
        const vertices = position, indices = index;
        const primitiveGeometry = function* primitiveGeometry(): Generator<readonly GlbVertex[]> {
          for (let i = 0; i < indices.n; i += 3) yield Array.from({ length: 3 }, (_, offset) => {
            const row = p['indices'] === undefined ? i + offset : read(indices, i + offset, 0);
            return { x: read(vertices, row, 0), y: read(vertices, row, 1), z: read(vertices, row, 2) };
          });
        };
        const coverage = projectedLayerCoverage(primitiveGeometry()); layers += coverage;
        if (alpha === 'BLEND') blendedLayers += coverage; if (alpha === 'MASK') maskedLayers += coverage;
      }
      for (const id of Object.values(attributes)) if (accessors[count(id, 10_000)] === undefined) throw new Error('missing GLB attribute');
    }
    return { triangles, draws, layers, blendedLayers, maskedLayers };
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
    if (estimate !== undefined) { estimate.layers += cost.layers * instances; estimate.blendedLayers += cost.blendedLayers * instances; estimate.maskedLayers += cost.maskedLayers * instances; }
  }
  // Skins and clips are admitted before GLTFLoader allocates skeletons or animation tracks.
  const nodeIndex = (value: unknown): number => { const id = count(value, 10000); if (nodes[id] === undefined) throw new Error('missing GLB rig node'); return id; };
  const parents = new Map<number, number>();
  nodes.forEach((node, id) => {
    for (const child of list(node['children'] ?? [])) { const key = nodeIndex(child); if (key === id || parents.has(key)) throw new Error('GLB node hierarchy'); parents.set(key, id); }
    for (const [key, size] of [['translation', 3], ['rotation', 4], ['scale', 3], ['matrix', 16]] as const) if (node[key] !== undefined) {
      const values = list(node[key]); if (values.length !== size || values.some((n) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 100000)) throw new Error('GLB node transform');
      if (key === 'rotation' && Math.abs(values.reduce<number>((sum, n) => sum + Number(n) ** 2, 0) - 1) > 1e-4) throw new Error('GLB node quaternion');
    }
    if (node['matrix'] !== undefined && ['translation', 'rotation', 'scale'].some((key) => node[key] !== undefined)) throw new Error('GLB matrix and TRS');
  });
  for (let id = 0; id < nodes.length; id++) { const seen = new Set<number>(); let parent: number | undefined = id; while (parent !== undefined) { if (seen.has(parent) || seen.size > 128) throw new Error('GLB node cycle or depth'); seen.add(parent); parent = parents.get(parent); } }
  let rigCpu = 0;
  const skins = list(doc['skins'] ?? []).map((value) => {
    const skin = object(value), joints = list(skin['joints']).map(nodeIndex);
    if (joints.length === 0 || joints.length > 128 || new Set(joints).size !== joints.length) throw new Error('GLB skin joints cap');
    if (skin['skeleton'] !== undefined) nodeIndex(skin['skeleton']);
    if (skin['inverseBindMatrices'] !== undefined) {
      const a = accessors[count(skin['inverseBindMatrices'], 10000)]; if (a === undefined || a.type !== 'MAT4' || a.component !== 5126 || a.n !== joints.length) throw new Error('GLB inverse bind shape');
      for (let i = 0; i < a.n; i++) for (let c = 0; c < 16; c++) if (!Number.isFinite(read(a, i, c))) throw new Error('GLB inverse bind value');
    }
    const textureSize = Math.max(4, Math.ceil(Math.sqrt(joints.length * 4) / 4) * 4);
    gpu += textureSize * textureSize * 16; rigCpu += textureSize * textureSize * 16 + joints.length * 64;
    return joints;
  });
  if (skins.length > 128) throw new Error('GLB skins cap');
  const meshes = list(doc['meshes'] ?? []).map(object);
  for (const node of nodes) if (node['skin'] !== undefined) {
    const joints = skins[count(node['skin'], 128)], mesh = meshes[count(node['mesh'], 10000)]; if (joints === undefined || mesh === undefined || node['extensions'] !== undefined) throw new Error('GLB skin binding');
    for (const primitive of list(mesh['primitives'])) {
      const attrs = object(object(primitive)['attributes']), position = accessors[count(attrs['POSITION'], 10000)], indices = accessors[count(attrs['JOINTS_0'], 10000)], weights = accessors[count(attrs['WEIGHTS_0'], 10000)];
      if (indices === undefined || weights === undefined || position === undefined || indices.type !== 'VEC4' || weights.type !== 'VEC4' || indices.n !== position.n || weights.n !== position.n || ![5121, 5123].includes(Number(indices.component)) || !(weights.component === 5126 || ([5121, 5123].includes(Number(weights.component)) && weights.normalized))) throw new Error('GLB skin weights shape');
      for (let i = 0; i < indices.n; i++) { let total = 0; for (let c = 0; c < 4; c++) { const joint = read(indices, i, c), raw = read(weights, i, c), weight = weights.normalized ? raw / (weights.component === 5121 ? 255 : 65535) : raw;
        if (joint >= joints.length || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('GLB skin weight value'); total += weight;
      } if (Math.abs(total - 1) > 1e-4) throw new Error('GLB skin weights must sum to one'); }
    }
  }
  const animations = list(doc['animations'] ?? []); if (animations.length > 32) throw new Error('GLB clips cap');
  for (const value of animations) {
    const animation = object(value), samplers = list(animation['samplers']).map(object), channels = list(animation['channels']), bindings = new Set<string>();
    if (typeof animation['name'] !== 'string' || !/^[a-z][a-z0-9.-]{0,127}$/u.test(animation['name'])) throw new Error('GLB clip name');
    if (samplers.length === 0 || samplers.length > 512 || channels.length === 0 || channels.length > 512) throw new Error('GLB clip channels cap');
    for (const entry of channels) {
      const channel = object(entry), target = object(channel['target']), targetId = nodeIndex(target['node']), path = target['path'], sampler = samplers[count(channel['sampler'], 512)];
      if (sampler === undefined || !['translation', 'rotation', 'scale'].includes(String(path)) || nodes[targetId]?.['matrix'] !== undefined || bindings.has(`${targetId}/${String(path)}`)) throw new Error('GLB clip target'); bindings.add(`${targetId}/${String(path)}`);
      const input = accessors[count(sampler['input'], 10000)], output = accessors[count(sampler['output'], 10000)], width = path === 'rotation' ? 4 : 3;
      if ((sampler['interpolation'] !== undefined && typeof sampler['interpolation'] !== 'string') || !['LINEAR', 'STEP'].includes(typeof sampler['interpolation'] === 'string' ? sampler['interpolation'] : 'LINEAR') || input === undefined || output === undefined || input.type !== 'SCALAR' || input.component !== 5126 || input.n < 2 || input.n > 4097 || output.component !== 5126 || output.dimension !== width || output.n !== input.n) throw new Error('GLB clip accessor shape');
      let previous = -1;
      for (let i = 0; i < input.n; i++) { const time = read(input, i, 0); if (!Number.isFinite(time) || time < 0 || time > 60 || time <= previous) throw new Error('GLB clip time order'); previous = time;
        let norm = 0; for (let c = 0; c < width; c++) { const n = read(output, i, c); if (!Number.isFinite(n) || Math.abs(n) > 100000) throw new Error('GLB clip value'); norm += n * n; }
        if (path === 'rotation' && Math.abs(norm - 1) > 1e-4) throw new Error('GLB clip quaternion');
      }
      rigCpu += (input.n + output.n * width) * 4;
    }
  }
  // Old GLB fixtures omit scene nodes; count their mesh resources conservatively too.
  if (nodes.length === 0) for (const cost of meshCosts) {
    triangles += cost.triangles; draws += cost.draws * 2;
    if (estimate !== undefined) { estimate.layers += cost.layers; estimate.blendedLayers += cost.blendedLayers; estimate.maskedLayers += cost.maskedLayers; }
  }
  if (length + binaryBytes + instanceCpu + rigCpu > MAX_BYTES || gpu > MAX_BYTES || triangles > 400_000 || draws > 512) throw new Error('GLB resource cap');
  if (visit !== undefined) visitGlbGeometry({ nodes, meshes, accessors, parents, read }, visit);
  return { decoded: length + binaryBytes + instanceCpu + rigCpu, gpu, triangles, draws };
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
  if (kind === 'binary' && isMeshCollisionData(bytes)) return meshCollisionCost(decodeMeshCollision(bytes));
  if (kind === 'json') { json(bytes); return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 }; }
  if (kind === 'wasm' && (bytes.length > 262_144 || !WebAssembly.validate(Uint8Array.from(bytes)))) throw new Error('invalid or oversized Wasm');
  return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 };
}

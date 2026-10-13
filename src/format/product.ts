import { textureMipBytes, type TextureTranscodeSupport } from './contentBounds';
import { indexRecordingAac } from '@wildshard/format/aacIndex';
import { bilinearTerrainSamplers, decodeTerrainTile, isTerrainTileData, terrainTileCost, terrainTileHeight } from "@wildshard/format/terrainTileBytes";
import { decodeMeshCollision, isMeshCollisionData, meshCollisionCost } from "@wildshard/format/meshCollisionBytes";
import { visitGlbGeometry, type GlbVertex } from "@wildshard/format/glbTriangles";
import { projectedLayerCoverage, type OverdrawEstimate } from "@wildshard/format/overdraw";
import { parseStillImage } from "@wildshard/format/stillImage";
import type { Shardfile } from "@wildshard/format/shardSchema";
import type { ShardTerrain } from "@wildshard/format/terrain";
import { assertMigrationCompatibility } from "@wildshard/format/migrations";
import { StateSchema } from "@wildshard/format/state";
import * as v from "valibot";
import { worstContentCost, memoryTargetWarnings, nearbyContentCost } from "@wildshard/format/budget";
import { CONTENT_CAPS as C, CONTENT_CAPS } from '@wildshard/format/contentBounds';
import { DEFAULT_GRAPH_BUDGET, validateGraph } from "@wildshard/format/materialGraph";
import { SCRIPT_LIMITS } from '@wildshard/format/scriptLimits';
import { runtimeAccountedBytes } from "@wildshard/format/runtimeCost";
import type { ContentCostInput } from "@wildshard/format/contentCost";
import { nearPlaceholderRoots } from '@wildshard/format/nearPlaceholder';

/** Actual costs derived from a bounded parser, never trusted from the author declaration. */
import { isNavigationData, navigationCost } from '@wildshard/format/navigationBytes';

/** Admitted decoded CPU bytes, GPU bytes, triangle count and draw count charged to the asset budget. */
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
export function assetOverdraw(requestedKind: string, bytes: Uint8Array): OverdrawEstimate {
  const kind = requestedKind === 'commons' ? commonsKind(bytes) : requestedKind;
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
      if (attributes['_MATRIX'] !== undefined && ['TRANSLATION', 'ROTATION', 'SCALE'].some(key => attributes[key] !== undefined)) throw new Error('GLB exact matrix cannot mix with TRS');
      let size: number | undefined;
      for (const [key, id] of Object.entries(attributes)) {
        const normalized = object(list(doc['accessors'])[count(id, 10_000)])['normalized'];
        const a = accessors[count(id, 10_000)], dimension = key === '_MATRIX' ? 16 : key === 'ROTATION' ? 4 : 3;
        if (!['TRANSLATION', 'ROTATION', 'SCALE', '_MATRIX', '_COLOR_0'].includes(key) || a === undefined || a.component !== 5126 || a.dimension !== dimension || (key === '_MATRIX' && (a.type !== 'MAT4' || (normalized !== undefined && normalized !== false) || a.stride !== 64 || a.offset % 4 !== 0)) || (key === '_COLOR_0' && (a.type !== 'VEC3' || (normalized !== undefined && normalized !== false) || a.stride !== 12 || a.offset % 4 !== 0)) || a.n === 0 || a.n > 10_000 || (size !== undefined && a.n !== size)) throw new Error('invalid GLB instance attribute');
        size = a.n;
        for (let i = 0; i < a.n; i++) {
          let norm = 0;
          for (let c = 0; c < dimension; c++) {
            const n = view.getFloat32(28 + length + a.offset + i * a.stride + c * 4, true);
            if (!Number.isFinite(n) || (key === 'SCALE' && (n <= 0 || n > 1000)) || (key === '_COLOR_0' && (n < 0 || n > 1))) throw new Error('invalid GLB instance transform');
            norm += n * n;
          }
          if (key === '_MATRIX') {
            const at = 28 + length + a.offset + i * a.stride;
            const m = (c: number): number => view.getFloat32(at + c * 4, true);
            if (m(3) !== 0 || m(7) !== 0 || m(11) !== 0 || m(15) !== 1) throw new Error('invalid GLB affine instance matrix');
            for (const c of [0, 4, 8]) if (m(c) * m(c) + m(c + 1) * m(c + 1) + m(c + 2) * m(c + 2) > 1_000_000.25) throw new Error('invalid GLB instance matrix scale');
            const determinant = m(0) * (m(5) * m(10) - m(6) * m(9)) - m(4) * (m(1) * m(10) - m(2) * m(9)) + m(8) * (m(1) * m(6) - m(2) * m(5));
            if (determinant <= 0) throw new Error('invalid GLB instance matrix determinant');
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
    if (typeof animation['name'] !== 'string' || !/^[a-z][a-z0-9.:-]{0,127}$/u.test(animation['name'])) throw new Error('GLB clip name');
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

/** Parse bounded KTX2 headers and mip ranges; absent GPU support retains the full RGBA transcode bound. */
export function parseKtx2(bytes: Uint8Array, support?: TextureTranscodeSupport): AssetCost {
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
  // Only ordinary Basis LDR sources use the advertised ASTC/BC7 transcode paths.
  const model = view.getUint8(dfd + 12);
  const basis = view.getUint32(12, true) === 0;
  const compressed = basis && ((model === 166 && support?.astc === true) || ((model === 163 || model === 166) && support?.bc7 === true));
  if (compressed) gpu = textureMipBytes(width, height, levels, true);
  return { decoded: 0, gpu, triangles: 0, draws: 0 };
}

/** Admit bounded PCM WAV or indexed AAC-LC without decoding; charge full float32 sample residency. */
export function parseAudio(bytes: Uint8Array): AssetCost {
  requireRange(bytes, 0, 12);
  if (new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') {
    if (bytes.length > MAX_BYTES) throw new Error('audio byte cap');
    const indexed = indexRecordingAac(bytes);
    if (indexed.mediaFrames / indexed.sampleRate > 180) throw new Error('AAC duration cap');
    // Include priming and the entire final packet: never undercharge packet padding or encoder delay.
    return { decoded: indexed.sizes.length * 1024 * indexed.channels * 4, gpu: 0, triangles: 0, draws: 0 };
  }
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
function commonsKind(bytes: Uint8Array): 'ktx2' | 'glb' | 'audio' | 'binary' {
  return bytes[0] === 171 ? 'ktx2' : bytes[0] === 103 ? 'glb'
    : bytes[0] === 82 || new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp' ? 'audio' : 'binary';
}
/** Select the format parser; binary/JSON/Wasm are bounded before higher-level content validators run. */
export function assetCost(requestedKind: string, bytes: Uint8Array): AssetCost {
  const kind = requestedKind === 'commons' ? commonsKind(bytes) : requestedKind;
  if (kind === 'image') { const image = parseStillImage(bytes); return { decoded: image.decoded, gpu: image.gpu, triangles: 0, draws: 0 }; }
  if (kind === 'glb') return parseGlb(bytes);
  if (kind === 'ktx2') return parseKtx2(bytes);
  if (kind === 'audio') return parseAudio(bytes);
  if (bytes.length > MAX_BYTES) throw new Error('asset byte cap');
  if (kind === 'binary' && isNavigationData(bytes)) return navigationCost(bytes);
  if (kind === 'binary' && isTerrainTileData(bytes)) return terrainTileCost(decodeTerrainTile(bytes));
  if (kind === 'binary' && isMeshCollisionData(bytes)) return meshCollisionCost(decodeMeshCollision(bytes));
  if (kind === 'json') { json(bytes); return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 }; }
  if (kind === 'wasm' && (bytes.length > 262_144 || !WebAssembly.validate(Uint8Array.from(bytes)))) throw new Error('invalid or oversized Wasm');
  return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 };
}

/** Refuse orphan wire assets and require look LUTs in the charged library closure before any asset read. */
export function preflightAssetGraph(source: Pick<Shardfile, 'files' | 'library' | 'critical' | 'tiles' | 'far' | 'look' | 'requires'> & Partial<Pick<Shardfile, 'rows' | 'presentation' | 'map' | 'audio' | 'near'>>): void {
  const files = new Map(source.files.map((file) => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
      found.add(ref); for (const dependency of files.get(ref)?.dependencies ?? []) pending.push(dependency);
    }
    return found;
  };
  const library = closure(source.library), lut = source.look.grade.lut;
  if (lut !== null && !library.has(lut)) throw new Error('Look LUT must be in the charged library closure');
  if (source.map !== undefined && (!library.has(source.map.image) || files.get(source.map.image)?.kind !== 'image')) throw new Error('Map image must be a declared image file in the charged library closure');
  for (const ref of Object.values(source.presentation?.card ?? {})) {
    if (!library.has(ref) || files.get(ref)?.kind !== 'image') throw new Error('Presentation images must be declared image files in the charged library closure');
  }
  for (const ref of Object.values(source.audio?.recordings ?? {})) {
    const shared = ref.startsWith('commons:') && source.requires.commons.includes(ref.slice(8));
    if (!library.has(ref) || (!shared && files.get(ref)?.kind !== 'audio')) throw new Error('Audio recordings must be declared audio in the charged library closure');
  }
  for (const row of source.rows?.compendiums ?? []) for (const entry of row.entries) {
    if (!entry.sketch.startsWith('data:') && !library.has(entry.sketch)) throw new Error('Compendium sketch hash must be in the charged library closure');
  }
  const reachable = closure([...source.library, ...source.critical, ...source.tiles.flatMap((tile) => tile.files), ...source.far?.files ?? [], ...nearPlaceholderRoots(source.near)]);
  if (source.files.some((file) => !reachable.has(file.hash)) || source.requires.commons.some((hash) => !reachable.has(`commons:${hash}`))) throw new Error('Orphan shardfile asset is not reachable from a bundle root');
}

/** Check baked payloads against the public tile rows and edge profiles, including exact render/collider L0 seams. */
export function validateTerrainAssets(terrain: ShardTerrain, assets: ReadonlyMap<string, Uint8Array>, content: {
  tiles: readonly { lod: number; x: number; z: number; files: readonly string[]; geometricError: number }[];
  critical: readonly string[]; edge: Record<'north' | 'east' | 'south' | 'west', { heights: readonly number[]; colours: readonly (readonly number[])[] }>;
}): void {
  const read = (fileRef: string) => { const bytes = assets.get(fileRef); if (bytes === undefined) throw new Error('Missing terrain file'); return decodeTerrainTile(bytes); };
  const collider = read(terrain.collider);
  const derivedQuery = terrain.form === 'query' && terrain.collider === terrain.sampling.file;
  if (!derivedQuery && (!content.critical.includes(terrain.collider) || collider.colours !== undefined || collider.splat !== undefined || collider.x !== -250 || collider.z !== -250 || collider.size !== 500 || collider.resolution !== 257)) throw new Error('Terrain collider must be a complete critical heightfield');
  if (terrain.sampling !== undefined) {
    if (!content.critical.includes(terrain.sampling.file)) throw new Error('Terrain sampling must be a critical query root');
    bilinearTerrainSamplers(read(terrain.sampling.file), terrain.sampling.normalEpsilon, terrain.sampling.datum);
  }
  if (terrain.form === 'query') return; // Queries install no render seams, road colours or collision.
  const colours = new Map<string, readonly number[]>();
  for (const tile of terrain.tiles) {
    const data = read(tile.file), size = tile.lod === 0 ? 62.5 : 125, row = content.tiles.find((t) => t.lod === tile.lod && t.x === tile.x && t.z === tile.z);
    if (data.colours === undefined || data.size !== size || data.x !== -250 + tile.x * size || data.z !== -250 + tile.z * size || data.resolution !== (tile.lod === 0 ? 33 : 17) || row === undefined || !row.files.includes(tile.file)) throw new Error('Terrain tile payload disagrees with its address');
    for (let z = 0; z < data.resolution; z++) for (let x = 0; x < data.resolution; x++) {
      const height = terrainTileHeight(collider, data.x + x * size / (data.resolution - 1), data.z + z * size / (data.resolution - 1));
      if (Math.abs((data.heights[z * data.resolution + x] ?? Infinity) - height) > 1e-5) throw new Error('Terrain render/collider seam mismatch');
      if (tile.lod === 0) {
        const key = `${tile.x * 32 + x}/${tile.z * 32 + z}`, rgb = [...data.colours.subarray((z * data.resolution + x) * 3, (z * data.resolution + x) * 3 + 3)], prior = colours.get(key);
        if (prior !== undefined && rgb.some((c, i) => c !== prior[i])) throw new Error('Terrain colour seam mismatch');
        colours.set(key, rgb);
      }
    }
    let error = 0;
    for (let z = 0; z <= size / (500 / 256); z++) for (let x = 0; x <= size / (500 / 256); x++) {
      const px = data.x + x * 500 / 256, pz = data.z + z * 500 / 256;
      error = Math.max(error, Math.abs(terrainTileHeight(data, px, pz) - terrainTileHeight(collider, px, pz)));
    }
    if (row.geometricError + 1e-5 < error) throw new Error('Terrain geometric error understated');
  }
  for (const [side, edge] of Object.entries(content.edge)) {
    if (edge.heights.length !== 257 || edge.colours.length !== 257) throw new Error('Terrain edge profile sample count');
    edge.heights.forEach((height, i) => {
      const p = -250 + i * 500 / 256, x = side === 'east' ? 250 : side === 'west' ? -250 : p, z = side === 'north' ? 250 : side === 'south' ? -250 : p;
      if (Math.abs(height - terrainTileHeight(collider, x, z)) > 1e-5) throw new Error('Terrain edge profile mismatch');
      const key = `${Math.round((x + 250) / 500 * 256)}/${Math.round((z + 250) / 500 * 256)}`, rgb = colours.get(key), declared = edge.colours[i];
      if (rgb === undefined || declared?.length !== 3 || rgb.some((c, channel) => c !== declared[channel])) throw new Error('Terrain edge colour mismatch');
    });
    if (edge.heights[128] !== 0) throw new Error('Terrain entry road must meet road height zero');
  }
}

const lineage = v.object({ identity: v.object({ slug: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)) }), state: StateSchema });
type StateLineage = v.InferOutput<typeof lineage>;
/** Read only strict portable state and identity from a previously visited product. Its legacy geometry and scripts remain unadmitted. */
export function parseStateLineage(input: unknown): StateLineage { return v.parse(lineage, input); }

/** Preserve saved field identities across validated author revisions; declaration ordering is immaterial. */
export function assertStateCompatibility(previous: StateLineage, next: Shardfile): void {
  v.parse(v.literal(previous.identity.slug, 'State revisions must name the same shard'), next.identity.slug);
  if (next.identity.revision < previous.identity.revision) throw new Error('State revisions cannot move backwards');
  assertMigrationCompatibility(previous.state, next.state, next.migrations);
}

declare const __SHARDFILE_VALIDATOR__: string;
declare const __SHARDFILE_VERDICTS__: unknown;
/** Build-owned verdict. It is never read from authored shardfile data or a network sidecar. */
export interface ValidationReceipt {
  revision: string; sourceHash: string; worst: ReturnType<typeof worstContentCost>;
}
/** Sorted JSON makes the build and browser hash exactly the same admitted declaration. */
export function validationSourceBytes(source: Shardfile): Uint8Array {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (typeof input === 'object' && input !== null) return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, sort(value)]));
    return input;
  };
  return new TextEncoder().encode(`${JSON.stringify(sort(source))}\n`);
}
/** The build hashes the engine/game validator sources; unbundled clients always validate in full. */
export function validationRevision(): string | null { return typeof __SHARDFILE_VALIDATOR__ === 'string' ? __SHARDFILE_VALIDATOR__ : null; }
/** Cache metadata is trusted local storage, but stale or malformed verdicts are never accepted. */
export function readValidationReceipt(input: unknown, sourceHash: string): ValidationReceipt | null {
  if (typeof input !== 'object' || input === null || !('revision' in input) || typeof input.revision !== 'string' || input.revision !== validationRevision() || !('sourceHash' in input) || input.sourceHash !== sourceHash || !('worst' in input)) return null;
  const cost = input.worst;
  if (typeof cost !== 'object' || cost === null || !('playing' in cost) || !('loading' in cost) || !('accounted' in cost) || !('location' in cost)) return null;
  if (![cost.playing, cost.loading, cost.accounted].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || !Array.isArray(cost.location) || cost.location.length !== 2 || !cost.location.every(value => typeof value === 'number' && Number.isSafeInteger(value))) return null;
  // Explicit numeric narrowing preserves the defining cost type without accepting arbitrary metadata.
  if (typeof cost.playing !== 'number' || typeof cost.loading !== 'number' || typeof cost.accounted !== 'number' || typeof cost.location[0] !== 'number' || typeof cost.location[1] !== 'number') return null;
  return { revision: input.revision, sourceHash, worst: { playing: cost.playing, loading: cost.loading, accounted: cost.accounted, location: [cost.location[0], cost.location[1]] } };
}
/** Only the client build's own validated first-party catalogue can skip a first asset-header validation. */
export function builtValidationReceipt(sourceHash: string): ValidationReceipt | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) { const receipt = readValidationReceipt(row, sourceHash); if (receipt !== null) return receipt; }
  return null;
}

/** Native offline observations; script execution is timed separately from physics and checkpoint/IPC work. */
export interface PerformanceObservations {
  scripts: { p95Micros: number; maxMicros: number; samples: number };
  fuel: { p95: number; max: number; samples: number };
}
/** A report issue distinguishes tradeable memory targets from enforceable complete totals and execution budgets. */
export interface PerformanceIssue { metric: string; actual: number; limit: number; severity: 'warning' | 'refusal' }
/** Build-time estimates retain units, their scope, and the measured execution samples they use. */
export interface PerformanceReport {
  slug: string; policy: 'refuse' | 'warn'; pass: boolean;
  native: { resident: number; evidence: string | null; unmeasuredViewAndDownload: boolean };
  memory: { near: ReturnType<typeof nearbyContentCost>; worst: ReturnType<typeof worstContentCost>; playingLimit: number; loadingLimit: number };
  views: { name: string; x: number; z: number; draws: number; triangles: number }[];
  graphs: { id: string; nodes: number; samplers: number; instructions: number }[];
  scripts: PerformanceObservations;
  download: { critical: number; tiles: number; library: number; far: number; near?: number; total: number; playable: number };
  estimatedPlayable: { seconds: number; bytesPerSecond: number; setupSeconds: number };
  issues: PerformanceIssue[];
}

function reportCardClosure(source: Shardfile, roots: readonly string[]): Set<string> {
  const files = new Map(source.files.map(file => [file.hash, file])), found = new Set<string>(), pending = [...roots];
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
    found.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
  }
  return found;
}
function totals(source: Shardfile, refs: Iterable<string>): { bytes: number; draws: number; triangles: number } {
  const files = new Map(source.files.map(file => [file.hash, file]));
  let bytes = 0, draws = 0, triangles = 0;
  for (const ref of refs) {
    const shared = ref.startsWith('commons:') ? ref.slice(8) : null;
    const file = files.get(ref), row = shared === null ? file : source.requires.commonsCosts[shared];
    if (row === undefined) throw new Error(`Report requires admitted cost for ${ref}`);
    const wire = shared === null ? file?.compressed : source.requires.commonsWire[shared];
    if (wire === undefined) throw new Error(`Report requires admitted wire size for ${ref}`);
    bytes += wire; draws += row.draws; triangles += row.triangles;
  }
  return { bytes, draws, triangles };
}
const near = (tile: Shardfile['tiles'][number], x: number, z: number): boolean => {
  const dx = Math.max((tile.drawBounds ?? tile.bounds).min[0] - x, x - (tile.drawBounds ?? tile.bounds).max[0], 0), dz = Math.max((tile.drawBounds ?? tile.bounds).min[2] - z, z - (tile.drawBounds ?? tile.bounds).max[2], 0);
  return dx * dx + dz * dz <= C.nearRadius ** 2;
};

/** Cheap target grading before asset reads; format integrity and total-memory admission remain separate. */
export function performanceTargetIssues(source: Shardfile, policy: 'refuse' | 'warn' = 'refuse'): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const check = (metric: string, actual: number, limit: number, provisional = false): void => {
    if (actual > limit) issues.push({ metric, actual, limit, severity: provisional || policy === 'warn' ? 'warning' : 'refusal' });
  };
  const libraryAllowance = source.budgets.library.downloadAllowance ?? C.library.compressed;
  check('library download budget bytes', source.budgets.library.compressed, libraryAllowance);
  check('critical download budget bytes', source.budgets.sim.compressed, C.sim.compressed);
  check('library download bytes', totals(source, reportCardClosure(source, source.library)).bytes, libraryAllowance);
  check('critical download bytes', totals(source, reportCardClosure(source, source.critical)).bytes, C.sim.compressed);
  for (const tile of source.tiles) {
    const cap = tile.lod === 0 ? C.l0 : C.l1, id = `tile ${tile.lod}/${tile.x}/${tile.z}`;
    check(`${id} download bytes`, tile.compressed, cap.compressed, true); check(`${id} draws`, tile.draws, cap.draws, true); check(`${id} triangles`, tile.triangles, cap.triangles, true);
  }
  if (source.far !== null) {
    check('far download bytes', source.far.compressed, C.far.compressed); check('far draws', source.far.draws, C.far.draws); check('far triangles', source.far.triangles, C.far.triangles);
  }
  return issues;
}

/** Refuse forged visual overhang or draw extents using actual transformed triangle bytes, never accessor bounds. */
export function validatePropDrawBounds(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>): void {
  const props = source.props; if (props?.overhang === undefined) return;
  const limit = 250 + props.overhang;
  for (const row of props.tiles) {
    const tile = source.tiles.find(candidate => candidate.lod === row.lod && candidate.x === row.x && candidate.z === row.z);
    if (tile === undefined) throw new Error('Missing prop draw tile');
    const bounds = tile.drawBounds ?? tile.bounds;
    for (const ref of [row.file, ...row.additionalFiles ?? []]) {
      const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing prop draw bytes');
      visitGlbTriangles(bytes, triangle => {
        for (const point of triangle) if (Math.abs(point.x) > limit || Math.abs(point.z) > limit || point.x < bounds.min[0] || point.x > bounds.max[0] || point.y < bounds.min[1] || point.y > bounds.max[1] || point.z < bounds.min[2] || point.z > bounds.max[2]) throw new Error('Prop exceeds declared visual draw bounds');
      });
    }
  }
}

/** Report deterministic declared bounds and measured native execution; the caller supplies trusted provenance policy. */
export function performanceReport(source: Shardfile, observations: PerformanceObservations, policy: 'refuse' | 'warn' = 'refuse'): PerformanceReport {
  const native = { resident: source.runtime?.cost === undefined ? 0 : runtimeAccountedBytes(source.runtime.cost), evidence: source.runtime?.cost?.evidence ?? null, unmeasuredViewAndDownload: source.runtime !== null };
  const commons = native.resident + Object.values(source.requires.commonsCosts).reduce((sum, row) => sum + row.decoded + row.gpu, 0);
  const worst = worstContentCost(source, commons), spawn = source.spawn;
  const memory = { near: nearbyContentCost(source, spawn.x, spawn.z, commons), worst, playingLimit: C.playing, loadingLimit: C.loading };
  const issues: PerformanceIssue[] = memoryTargetWarnings(source).map(row => ({ metric: `${row.category} resident target (tradeable)`, actual: row.bytes, limit: row.target, severity: 'warning' }));
  issues.push(...performanceTargetIssues(source, policy));
  const check = (metric: string, actual: number, limit: number): void => {
    if (!Number.isFinite(actual) || actual < 0 || actual > limit) issues.push({ metric, actual, limit, severity: policy === 'warn' ? 'warning' : 'refusal' });
  };
  if (native.unmeasuredViewAndDownload) check('native view/download measurement required', 1, 0);
  if (source.runtime !== null && source.runtime.cost === undefined) check('native resident measurement required', 1, 0);
  check('worst playing total bytes', worst.playing, C.playing); check('worst loading total bytes', worst.loading, C.loading);
  const library = reportCardClosure(source, source.library), critical = reportCardClosure(source, source.critical);
  const tileRoots = source.tiles.flatMap(tile => tile.files), farRoots = source.far?.files ?? [], nearRoots = nearPlaceholderRoots(source.near);
  const playable = reportCardClosure(source, [...source.critical, ...source.library, ...farRoots, ...source.tiles.filter(tile => tile.lod === 1 || near(tile, spawn.x, spawn.z)).flatMap(tile => tile.files)]);
  const download = { critical: totals(source, critical).bytes, tiles: totals(source, reportCardClosure(source, tileRoots)).bytes,
    library: totals(source, library).bytes, far: totals(source, reportCardClosure(source, farRoots)).bytes,
    ...(source.near === undefined ? {} : { near: totals(source, reportCardClosure(source, nearRoots)).bytes }),
    total: totals(source, reportCardClosure(source, [...source.critical, ...source.library, ...tileRoots, ...farRoots, ...nearRoots])).bytes, playable: totals(source, playable).bytes };
  const libraryView = totals(source, library);
  const views = [['spawn', spawn.x, spawn.z], ['worst memory', ...worst.location]].map(([name, x, z]) => {
    if (typeof name !== 'string' || typeof x !== 'number' || typeof z !== 'number') throw new Error('Invalid report view');
    const tiles = source.tiles.filter(tile => tile.lod === 1 || near(tile, x, z));
    return { name, x, z, draws: libraryView.draws + (source.far?.draws ?? 0) + tiles.reduce((sum, tile) => sum + tile.draws, 0),
      triangles: libraryView.triangles + (source.far?.triangles ?? 0) + tiles.reduce((sum, tile) => sum + tile.triangles, 0) };
  });
  const graphs: PerformanceReport['graphs'] = [];
  // inline graphs (a graph file is checked with its bytes at product admission; a preset is engine-owned, under its own budget)
  for (const [id, material] of Object.entries(source.look.materials)) if (material.family === 'graph' && 'graph' in material) {
    const result = validateGraph(material.graph);
    if (!result.ok) throw new Error(`Report requires an admitted material graph: ${id}`);
    graphs.push({ id, ...result.cost });
    for (const metric of ['nodes', 'samplers', 'instructions'] as const) check(`graph ${id} ${metric}`, result.cost[metric], DEFAULT_GRAPH_BUDGET[metric]);
  }
  const scriptLimit = Math.min(source.serverBudget.tickMicros, 1_000_000 / 60 / 4);
  for (const [group, data] of ([['scripts', observations.scripts], ['fuel', observations.fuel]] as const)) for (const [metric, value] of Object.entries(data)) {
    if (!Number.isFinite(value) || value < 0) check(`invalid measured ${group}.${metric}`, value, 0);
  }
  check('script CPU p95 us/tick', observations.scripts.p95Micros, scriptLimit);
  check('script fuel/tick', observations.fuel.max, SCRIPT_LIMITS.fuelPerTick);
  if (observations.scripts.samples < 60 || observations.fuel.samples < 60) check('missing execution samples', 60, Math.min(observations.scripts.samples, observations.fuel.samples));
  // An explicit cold-network estimate, not a measured phone loading claim. The guide names both assumptions.
  const bytesPerSecond = 1_000_000, setupSeconds = 1;
  return { slug: source.identity.slug, policy, pass: !issues.some(issue => issue.severity === 'refusal'), native, memory, views, graphs, scripts: observations, download,
    estimatedPlayable: { seconds: setupSeconds + download.playable / bytesPerSecond, bytesPerSecond, setupSeconds }, issues };
}

/** Human-readable card keeps estimates visibly distinct from measurements and prints every enforced limit. */
export function performanceReportLines(report: PerformanceReport): string[] {
  const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(3)} MB`;
  return [`PERFORMANCE REPORT ${report.slug}: ${report.pass ? 'PASS' : 'REFUSED'} (${report.policy})`,
    `native runtime: charged ${mb(report.native.resident)}${report.native.evidence === null ? '' : ` from ${report.native.evidence}`}; ${report.native.unmeasuredViewAndDownload ? 'view/download remainder UNMEASURED (port required)' : 'none'}`,
    `estimated memory near player (${report.memory.near.location.join(', ')}): play ${mb(report.memory.near.playing)}, load ${mb(report.memory.near.loading)}`,
    `estimated worst grid memory (${report.memory.worst.location.join(', ')}): play ${mb(report.memory.worst.playing)} / ${mb(report.memory.playingLimit)}, load ${mb(report.memory.worst.loading)} / ${mb(report.memory.loadingLimit)}`,
    ...report.views.map(view => `declared view bounds ${view.name} (${view.x}, ${view.z}): ${view.draws} draws, ${view.triangles} triangles (before frustum/occlusion; excludes engine/native recipes)`),
    ...report.graphs.map(graph => `graph ${graph.id}: ${graph.nodes}/${DEFAULT_GRAPH_BUDGET.nodes} nodes, ${graph.samplers}/${DEFAULT_GRAPH_BUDGET.samplers} samplers, ${graph.instructions}/${DEFAULT_GRAPH_BUDGET.instructions} instructions`),
    ...(report.graphs.length === 0 ? ['graphs: 0 authored graphs; platform family shader presets'] : []),
    report.scripts.scripts.samples === 0 ? 'scripts CPU/fuel: UNMEASURED (execution proof required)' : `measured scripts (${report.scripts.scripts.samples} ticks): p95 ${report.scripts.scripts.p95Micros.toFixed(1)} us/tick, max ${report.scripts.scripts.maxMicros.toFixed(1)} us/tick; fuel p95 ${report.scripts.fuel.p95}, max ${report.scripts.fuel.max}/${SCRIPT_LIMITS.fuelPerTick}`,
    `download closures: critical ${mb(report.download.critical)}, tiles ${mb(report.download.tiles)}, library ${mb(report.download.library)}, far ${mb(report.download.far)}${report.download.near === undefined ? '' : `, near ${mb(report.download.near)}`}, unique total ${mb(report.download.total)}`,
    `estimated playable ${report.estimatedPlayable.seconds.toFixed(3)} s: ${mb(report.download.playable)} at ${mb(report.estimatedPlayable.bytesPerSecond)}/s + ${report.estimatedPlayable.setupSeconds} s setup (assumptions, not a phone reading)`,
    ...report.issues.map(issue => `${issue.severity.toUpperCase()}: ${issue.metric}: ${issue.actual} > ${issue.limit}`)];
}

/** A measured opaque runtime retains both rulers and the evidence used to derive its full claim. All bytes are decimal. */
export interface AdmissionMeasurement {
  readonly webContentBytes: number; readonly glBytes: number; readonly engineBaseBytes: number;
  /** Matched pre-entry resident set subtracted by the runtime claim; the dated engine base remains provenance. */
  readonly residentBaseBytes?: number;
  readonly rev: string; readonly device: string; readonly evidence: string;
}
/** Trusted callers report only the total-memory envelope here. Parser, hash, script and content-understatement guards are separate. */
export interface MemoryAdmissionRequest {
  readonly stage: 'runtime' | 'declared' | 'actual' | 'resident';
  readonly owner: string; readonly id: string;
  readonly claimedBytes: number; readonly accountedBytes: number;
  readonly playingBytes: number; readonly loadingBytes: number;
  readonly playingCap?: number; readonly loadingCap?: number;
  readonly categories?: Readonly<ContentCostInput>;
  readonly measured?: AdmissionMeasurement;
}
/** G216's visible warning / G217 loading-screen read port: full claims and original caps, never a discounted allocation. */
export interface MemoryAdmissionWarning extends MemoryAdmissionRequest {
  readonly playingCap: number; readonly loadingCap: number;
  readonly playingOverBytes: number; readonly loadingOverBytes: number;
}

/**
 * G216: Developer may exceed the total memory envelope while keeping truthful accounting. Public callers still refuse.
 * The root supplies the live Settings Developer reader; pure Node and author validation default to strict. No DOM,
 * timers, world allocation or service installation occurs here. Warnings are bounded and leave with their page owner.
 */
export class MemoryAdmission {
  private readonly warnings = new Map<string, MemoryAdmissionWarning>();
  private readonly listeners = new Set<() => void>();
  private readonly developer: () => boolean;
  constructor(developer: () => boolean = () => false) { this.developer = developer; }

  /** True for an in-envelope request or a Developer override. False means the caller retains its original refusal path. */
  accept(request: MemoryAdmissionRequest): boolean {
    const playingCap = request.playingCap ?? CONTENT_CAPS.playing, loadingCap = request.loadingCap ?? CONTENT_CAPS.loading;
    if (request.owner.length === 0 || request.id.length === 0 || ![request.claimedBytes, request.accountedBytes, request.playingBytes, request.loadingBytes].every(value => Number.isSafeInteger(value) && value >= 0)
      || ![playingCap, loadingCap].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid memory admission report');
    const key = `${request.stage}:${request.owner}`;
    const playingOverBytes = Math.max(0, request.playingBytes - playingCap), loadingOverBytes = Math.max(0, request.loadingBytes - loadingCap);
    if (playingOverBytes === 0 && loadingOverBytes === 0) { if (this.warnings.delete(key)) this.notify(); return true; }
    if (!this.developer()) return false;
    const warning = Object.freeze({ ...request, playingCap, loadingCap, playingOverBytes, loadingOverBytes,
      ...(request.categories === undefined ? {} : { categories: Object.freeze({ ...request.categories }) }),
      ...(request.measured === undefined ? {} : { measured: Object.freeze({ ...request.measured }) }),
    });
    this.warnings.delete(key); this.warnings.set(key, warning);
    if (this.warnings.size > 64) {
      const oldest = this.warnings.keys().next().value; if (oldest !== undefined) this.warnings.delete(oldest);
    }
    this.notify(); return true;
  }
  /** Frozen reports in arrival order. The newest resident report includes the full page's category totals. */
  reports(): readonly MemoryAdmissionWarning[] { return Object.freeze([...this.warnings.values()]); }
  /** Scope-owned warning surfaces subscribe, then read reports. Existing pre-bootstrap warnings paint immediately. */
  subscribe(read: () => void): () => void { this.listeners.add(read); read(); return () => { this.listeners.delete(read); }; }
  /** Remove warnings for released resident claims after the total falls back under the envelope. */
  clearResidents(): void { let changed = false; for (const [key, row] of this.warnings) if (row.stage === 'resident') { this.warnings.delete(key); changed = true; } if (changed) this.notify(); }
  /** Whether a resident warning needs the allocator's current totals; other report stages keep their own ruler. */
  get hasResidentWarnings(): boolean {
    for (const row of this.warnings.values()) if (row.stage === 'resident') return true;
    return false;
  }
  /** Released claims stop warning; retained claims report the current full page total even while it remains over cap. */
  syncResidents(ids: ReadonlySet<string>, cost: { accounted: number; playing: number; loading: number; input: ContentCostInput }): void {
    let changed = false;
    for (const [key, row] of this.warnings) {
      if (row.stage !== 'resident') continue;
      const playingOverBytes = Math.max(0, cost.playing - row.playingCap), loadingOverBytes = Math.max(0, cost.loading - row.loadingCap);
      if (!ids.has(row.id) || playingOverBytes + loadingOverBytes === 0) { this.warnings.delete(key); changed = true; continue; }
      if (row.accountedBytes === cost.accounted) continue;
      this.warnings.set(key, Object.freeze({ ...row, accountedBytes: cost.accounted, playingBytes: cost.playing,
        loadingBytes: cost.loading, playingOverBytes, loadingOverBytes, categories: Object.freeze({ ...cost.input }) })); changed = true;
    }
    if (changed) this.notify();
  }
  /** Page disposal forgets every warning and listener; no later admission resurrects a UI subscription. */
  dispose(): void { this.warnings.clear(); this.listeners.clear(); }
  private notify(): void { for (const read of this.listeners) read(); }
}

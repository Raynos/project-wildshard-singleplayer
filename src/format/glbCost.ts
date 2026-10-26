/** Bounded GLB byte admission shared by build validation and runtime entry.
 * No product/schema graph is initialized to admit an equipment or skin model. */
import type { AssetCost } from './product';
import { glbBuffers, prepareGlbBuffers } from './glbBuffers';
import { glbImageCost } from './glbImages';
import { visitGlbGeometry, type GlbVertex } from './glbTriangles';
import { projectedLayerCoverage, type OverdrawEstimate } from './overdraw';

/** Await compressed-buffer readiness at the asynchronous model boundary. */
export function prepareGlbCost(): Promise<void> { return prepareGlbBuffers(); }

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

export function parseGlbData(bytes: Uint8Array, visit?: (triangle: readonly GlbVertex[]) => void, estimate?: OverdrawEstimate): AssetCost {
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
  const data = glbBuffers(doc, bytes.subarray(28 + length, 28 + length + binaryBytes)), views = data.views;
  const accessorBytes = new DataView(data.bytes.buffer, data.bytes.byteOffset, data.bytes.byteLength);
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
    const at = a.offset + row * a.stride + component * a.width;
    switch (a.component) {
      case 5120: return accessorBytes.getInt8(at);
      case 5121: return accessorBytes.getUint8(at);
      case 5122: return accessorBytes.getInt16(at, true);
      case 5123: return accessorBytes.getUint16(at, true);
      case 5125: return accessorBytes.getUint32(at, true);
      case 5126: return accessorBytes.getFloat32(at, true);
      default: throw new Error('unsupported GLB rig component');
    }
  };
  const checkedPositions = new Set<number>(), maximumIndices = new Map<number, number>();
  const materials = list(doc['materials'] ?? []).map(object);
  const imageCost = glbImageCost(doc, views, data.bytes); gpu += imageCost.gpu;
  const meshCosts = list(doc['meshes'] ?? []).map((mesh) => {
    let triangles = 0, draws = 0, layers = 0, blendedLayers = 0, maskedLayers = 0;
    for (const primitive of list(object(mesh)['primitives'])) {
      const p = object(primitive); if ((p['mode'] ?? 4) !== 4 || p['extensions'] !== undefined) throw new Error('unsupported GLB primitive');
      const attributes = object(p['attributes']);
      const positionId = count(attributes['POSITION'], 10_000), position = accessors[positionId];
      const indexId = count(p['indices'] ?? attributes['POSITION'], 10_000), index = accessors[indexId];
      // RM8.1: float32, or unnormalized Int16 on its node's grid (KHR_mesh_quantization; the node dequantizes it)
      if (position === undefined || position.type !== 'VEC3' || !(position.component === 5126 || (position.component === 5122 && !position.normalized)) || index === undefined || index.n % 3 !== 0) throw new Error('invalid GLB triangle accessor');
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
            const n = read(a, i, c);
            if (!Number.isFinite(n) || (key === 'SCALE' && (n <= 0 || n > 1000)) || (key === '_COLOR_0' && (n < 0 || n > 1))) throw new Error('invalid GLB instance transform');
            norm += n * n;
          }
          if (key === '_MATRIX') {
            const m = (c: number): number => read(a, i, c);
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
  if (length + binaryBytes + data.decoded + instanceCpu + rigCpu + imageCost.decoded > MAX_BYTES || gpu > MAX_BYTES || triangles > 400_000 || draws > 512) throw new Error('GLB resource cap');
  if (visit !== undefined) visitGlbGeometry({ nodes, meshes, accessors, parents, read }, visit);
  return { decoded: length + binaryBytes + data.decoded + instanceCpu + rigCpu + imageCost.decoded, gpu, triangles, draws };
}


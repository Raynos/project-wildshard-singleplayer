import { Box3, Matrix4, type MeshStandardMaterial, Quaternion, Vector3, type Object3D, type BufferGeometry } from 'three';
import { parseGlb } from '../assets';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
/** A primitive's geometry, material and optional instanced local transforms; textures are separate declared assets. */
export interface GlbPrimitive {
  geometry: BufferGeometry; material: MeshStandardMaterial; instances?: readonly Matrix4[]; castShadow?: boolean;
  /** Explicit glTF application semantic → geometry channel, e.g. `_SPLAT: 'splat'`; absent preserves old bytes. */
  customAttributes?: Readonly<Record<string, string>>;
}
/** A deterministic self-contained static GLB; names and vertex colours survive the ordinary engine GLTFLoader. */
export function staticGlb(primitives: readonly GlbPrimitive[], name = 'baked'): Uint8Array {
  const chunks: Uint8Array[] = [], views: Json[] = [], accessors: Json[] = [], meshes: Json[] = [], nodes: Json[] = [], materials: Json[] = [];
  let offset = 0;
  const accessor = (values: readonly number[], width: number, type: string, integer = false, bounds = false): number => {
    if (values.length === 0 || values.length % width !== 0 || values.some((n) => !Number.isFinite(n))) throw new Error('Invalid GLB attribute');
    const bytes = new Uint8Array(values.length * 4), v = new DataView(bytes.buffer);
    values.forEach((n, i) => integer ? v.setUint32(i * 4, n, true) : v.setFloat32(i * 4, n, true));
    const view = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }); chunks.push(bytes); offset += bytes.length;
    const a: Record<string, Json> = { bufferView: view, componentType: integer ? 5125 : 5126, count: values.length / width, type };
    if (bounds) { a['min'] = Array.from({ length: width }, (_, c) => values.reduce((n, sample, i) => i % width === c ? Math.min(n, sample) : n, Infinity)); a['max'] = Array.from({ length: width }, (_, c) => values.reduce((n, sample, i) => i % width === c ? Math.max(n, sample) : n, -Infinity)); }
    accessors.push(a); return accessors.length - 1;
  };
  for (const { geometry, material, instances, castShadow = true, customAttributes = {} } of primitives) {
    if (material.map !== null || material.normalMap !== null || material.roughnessMap !== null || material.metalnessMap !== null || material.alphaMap !== null) throw new Error('GLB textures must be external KTX2 declarations');
    if (!geometry.hasAttribute('position')) throw new Error('Missing GLB positions');
    const p = geometry.getAttribute('position'); if ( p.count > 400_000) throw new Error('Unsupported GLB geometry');
    const attributes: Record<string, Json> = {};
    for (const [key, semantic, width] of [['position', 'POSITION', 3], ['normal', 'NORMAL', 3], ['uv', 'TEXCOORD_0', 2], ['color', 'COLOR_0', 3]] as const) {
      const a = geometry.getAttribute(key); if (!geometry.hasAttribute(key)) continue;
      if (a.itemSize !== width || a.count !== p.count) throw new Error('Mismatched GLB attributes');
      attributes[semantic] = accessor(Array.from({ length: a.count * width }, (_, i) => a.getComponent(Math.floor(i / width), i % width)), width, `VEC${width}`, false, key === 'position');
    }
    const custom = Object.entries(customAttributes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    if (custom.length > 16) throw new Error('GLB custom attribute cap');
    for (const [semantic, channel] of custom) {
      if (!/^_[A-Z][A-Z0-9_]{0,63}$/.test(semantic) || !geometry.hasAttribute(channel)) throw new Error(`Invalid GLB custom attribute ${semantic}`);
      const a = geometry.getAttribute(channel), width = a.itemSize;
      if (!Number.isInteger(width) || width < 1 || width > 4 || a.count !== p.count) throw new Error(`Mismatched GLB custom attribute ${semantic}`);
      attributes[semantic] = accessor(Array.from({ length: a.count * width }, (_, i) => a.getComponent(Math.floor(i / width), i % width)), width, width === 1 ? 'SCALAR' : `VEC${width}`);
    }
    const index = geometry.getIndex(), indices = index === null ? Array.from({ length: p.count }, (_, i) => i) : Array.from(index.array);
    if (indices.length % 3 !== 0 || indices.some((i) => !Number.isInteger(i) || i < 0 || i >= p.count)) throw new Error('Invalid triangle indices');
    const materialIndex = materials.length;
    materials.push({ name: material.name, pbrMetallicRoughness: { baseColorFactor: [...material.color, material.opacity], metallicFactor: material.metalness, roughnessFactor: material.roughness }, doubleSided: material.side === 2, alphaMode: material.transparent ? 'BLEND' : 'OPAQUE' });
    meshes.push({ name, primitives: [{ attributes, indices: accessor(indices, 1, 'SCALAR', true), material: materialIndex }] });
    const node: Record<string, Json> = { name, mesh: meshes.length - 1, extras: { castShadow } };
    if (instances !== undefined) {
      if (instances.length === 0 || instances.length > 10_000) throw new Error('Invalid instance count');
      const t: number[] = [], r: number[] = [], s: number[] = [];
      for (const matrix of instances) {
        const position = new Vector3(), scale = new Vector3(), rotation = new Quaternion();
        matrix.decompose(position, rotation, scale);
        const composed = new Matrix4().compose(position, rotation, scale);
        if (matrix.elements.some((n, i) => !Number.isFinite(n) || Math.abs(n - (composed.elements[i] ?? Infinity)) > 1e-5) || scale.x <= 0 || scale.y <= 0 || scale.z <= 0) throw new Error('Instance must be a finite positive TRS transform');
        t.push(...position); r.push(...rotation); s.push(...scale);
      }
      node['extensions'] = { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: accessor(t, 3, 'VEC3'), ROTATION: accessor(r, 4, 'VEC4'), SCALE: accessor(s, 3, 'VEC3') } } };
    }
    nodes.push(node);
  }
  const doc: Record<string, Json> = { asset: { version: '2.0', generator: 'wildshard-static-v1' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials, accessors, bufferViews: views, buffers: [{ byteLength: offset }] };
  if (primitives.some((p) => p.instances !== undefined)) { doc['extensionsUsed'] = ['EXT_mesh_gpu_instancing']; doc['extensionsRequired'] = ['EXT_mesh_gpu_instancing']; }
  const raw = new TextEncoder().encode(JSON.stringify(doc)), length = Math.ceil(raw.length / 4) * 4, bytes = new Uint8Array(28 + length + offset), v = new DataView(bytes.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, bytes.length, true); v.setUint32(12, length, true); v.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + length); bytes.set(raw, 20);
  v.setUint32(20 + length, offset, true); v.setUint32(24 + length, 0x004e4942, true);
  let at = 28 + length; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  parseGlb(bytes); return bytes;
}
/** Collect world-space bounds without changing or flattening the generator's hierarchy. */
export function propBounds(root: Object3D): Box3 { root.updateMatrixWorld(true); return new Box3().setFromObject(root); }

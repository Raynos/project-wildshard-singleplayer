import { BufferAttribute, Float16BufferAttribute, Box3, Matrix4, type Color, type MeshStandardMaterial, Quaternion, Vector3, type Object3D, type BufferGeometry } from 'three';
import { parseGlb } from '../assets';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
/** A primitive's geometry, material and optional instanced local transforms; textures are separate declared assets. */
export interface GlbPrimitive {
  geometry: BufferGeometry; material: MeshStandardMaterial; instances?: readonly Matrix4[]; castShadow?: boolean;
  /** Optional unique glTF node/mesh name (letters, digits, underscore or hyphen); absent preserves the old byte path. */
  name?: string;
  /** Write exact float32 column-major MAT4 instances instead of decomposing TRS. */
  exactInstances?: true;
  /** Optional linear RGB instance colours, 0 … 1; count must match instances. */
  instanceColours?: readonly Color[];
  /** Explicit glTF application semantic → geometry channel, e.g. `_SPLAT: 'splat'`; absent preserves old bytes. */
  customAttributes?: Readonly<Record<string, string>>;
  /** Optional node transform (a finite positive TRS; not with `instances`); absent preserves the old byte path. */
  transform?: Matrix4;
  /** Keep original typed vertex channels as glTF application accessors with reconstruction metadata in node extras.
   * Half floats use uint16 bits (glTF has no float16); ordinary semantics remain portable float32. Also retains
   * double-precision source transforms in extras. Omitted: the existing byte path. */
  nativeAttributes?: true;
  /** Plain application rows, charged inside the GLB; reserved storage/transform extras remain baker-owned. */
  extras?: Readonly<Record<string, Json>>;
  /** `true` writes the index as built: none for a non-indexed geometry, 16-bit when it is 16-bit; absent always writes a 32-bit index (the old byte path). */
  compactIndex?: true;
}
/** A deterministic self-contained static GLB; names and vertex colours survive the ordinary engine GLTFLoader. */
export function staticGlb(primitives: readonly GlbPrimitive[], name = 'baked'): Uint8Array {
  const names = primitives.map(primitive => primitive.name ?? name);
  for (const primitive of primitives) {
    if (primitive.name !== undefined && (!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u.test(primitive.name)
      || names.filter(actual => actual === primitive.name).length !== 1)) throw new Error('GLB node names must be unique loader-safe identifiers');
  }
  const chunks: Uint8Array[] = [], views: Json[] = [], accessors: Json[] = [], meshes: Json[] = [], nodes: Json[] = [], materials: Json[] = [];
  let offset = 0;
  const accessor = (values: readonly number[], width: number, type: string, integer = false, bounds = false, short = false): number => {
    if (values.length === 0 || values.length % width !== 0 || values.some((n) => !Number.isFinite(n))) throw new Error('Invalid GLB attribute');
    // a 16-bit index's view is padded to 4 bytes so every later view stays aligned
    const size = short ? 2 : 4, bytes = new Uint8Array(Math.ceil(values.length * size / 4) * 4), v = new DataView(bytes.buffer);
    values.forEach((n, i) => short ? v.setUint16(i * 2, n, true) : integer ? v.setUint32(i * 4, n, true) : v.setFloat32(i * 4, n, true));
    const view = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: values.length * size }); chunks.push(bytes); offset += bytes.length;
    const a: Record<string, Json> = { bufferView: view, componentType: short ? 5123 : integer ? 5125 : 5126, count: values.length / width, type };
    if (bounds) { a['min'] = Array.from({ length: width }, (_, c) => values.reduce((n, sample, i) => i % width === c ? Math.min(n, sample) : n, Infinity)); a['max'] = Array.from({ length: width }, (_, c) => values.reduce((n, sample, i) => i % width === c ? Math.max(n, sample) : n, -Infinity)); }
    accessors.push(a); return accessors.length - 1;
  };
  const rawAccessor = (attribute: BufferAttribute): number => {
    const array = attribute.array;
    const componentType = array instanceof Float32Array ? 5126 : array instanceof Uint32Array ? 5125
      : array instanceof Uint16Array ? 5123 : array instanceof Int16Array ? 5122
      : array instanceof Uint8Array ? 5121 : array instanceof Int8Array ? 5120 : null;
    if (componentType === null) throw new Error('Native GLB attributes require a glTF component type');
    const length = attribute.count * attribute.itemSize * array.BYTES_PER_ELEMENT;
    const bytes = new Uint8Array(Math.ceil(length / 4) * 4);
    bytes.set(new Uint8Array(array.buffer, array.byteOffset, length));
    const view = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: length }); chunks.push(bytes); offset += bytes.length;
    accessors.push({ bufferView: view, componentType, count: attribute.count,
      type: attribute.itemSize === 1 ? 'SCALAR' : `VEC${attribute.itemSize}`,
      ...(attribute.normalized ? { normalized: true } : {}) });
    return accessors.length - 1;
  };
  const trs = (matrix: Matrix4): { position: Vector3; rotation: Quaternion; scale: Vector3 } => {
    const position = new Vector3(), scale = new Vector3(), rotation = new Quaternion();
    matrix.decompose(position, rotation, scale);
    const composed = new Matrix4().compose(position, rotation, scale);
    if (matrix.elements.some((n, i) => !Number.isFinite(n) || Math.abs(n - (composed.elements[i] ?? Infinity)) > 1e-5) || scale.x <= 0 || scale.y <= 0 || scale.z <= 0) throw new Error('Instance must be a finite positive TRS transform');
    return { position, rotation, scale };
  };
  for (const { geometry, material, instances, exactInstances, instanceColours, castShadow = true, customAttributes = {}, name: nodeName = name, transform, compactIndex, nativeAttributes, extras } of primitives) {
    if (material.map !== null || material.normalMap !== null || material.roughnessMap !== null || material.metalnessMap !== null || material.alphaMap !== null) throw new Error('GLB textures must be external KTX2 declarations');
    if (!geometry.hasAttribute('position')) throw new Error('Missing GLB positions');
    const p = geometry.getAttribute('position'); if ( p.count > 400_000) throw new Error('Unsupported GLB geometry');
    const attributes: Record<string, Json> = {};
    for (const [key, semantic, width] of [['position', 'POSITION', 3], ['normal', 'NORMAL', 3], ['uv', 'TEXCOORD_0', 2], ['color', 'COLOR_0', geometry.hasAttribute('color') ? geometry.getAttribute('color').itemSize : 3], ['tangent', 'TANGENT', 4]] as const) {
      const a = geometry.getAttribute(key); if (!geometry.hasAttribute(key)) continue;
      // A trusted whole shape may use the fourth normal component as a shader channel. glTF NORMAL is vec3:
      // retain the original vec4 as an application accessor below, never misdeclare the portable semantic.
      if (nativeAttributes === true && key === 'normal' && a.itemSize === 4 && a.count === p.count) continue;
      if (a.itemSize !== width || a.count !== p.count || (key === 'color' && width !== 3 && width !== 4)) throw new Error('Mismatched GLB attributes');
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
    const native: Record<string, Json> = {};
    if (nativeAttributes === true) {
      const channels = new Map<string, string>([['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0'], ['color', 'COLOR_0'], ['tangent', 'TANGENT'], ...custom.map(([semantic, channel]) => [channel, semantic] as [string, string])]);
      for (const [channel, semantic] of channels) {
        if (!geometry.hasAttribute(channel)) continue;
        const a = geometry.getAttribute(channel);
        if (!(a instanceof BufferAttribute)) throw new Error('Native GLB attributes must not be interleaved');
        let stored = semantic;
        if (!(a.array instanceof Float32Array) || (semantic === 'NORMAL' && a.itemSize !== 3)) {
          stored = `_WS_RAW_${semantic.replace(/^_/u, '')}`;
          if (Object.hasOwn(attributes, stored)) throw new Error(`Native GLB semantic collision ${stored}`);
          attributes[stored] = rawAccessor(a);
        }
        native[channel] = { semantic: stored, storage: a instanceof Float16BufferAttribute ? 'Float16Array' : a.array.constructor.name,
          normalized: a.normalized, itemSize: a.itemSize };
      }
    }
    const index = geometry.getIndex(), indices = index === null ? Array.from({ length: p.count }, (_, i) => i) : Array.from(index.array);
    if (indices.length % 3 !== 0 || indices.some((i) => !Number.isInteger(i) || i < 0 || i >= p.count)) throw new Error('Invalid triangle indices');
    const materialIndex = materials.length;
    materials.push({ name: material.name, pbrMetallicRoughness: { baseColorFactor: [...material.color, material.opacity], metallicFactor: material.metalness, roughnessFactor: material.roughness }, doubleSided: material.side === 2,
      alphaMode: material.transparent ? 'BLEND' : material.alphaTest > 0 ? 'MASK' : 'OPAQUE',
      ...(material.alphaTest > 0 ? { alphaCutoff: material.alphaTest } : {}),
      ...(material.emissive.r !== 0 || material.emissive.g !== 0 || material.emissive.b !== 0 ? { emissiveFactor: [...material.emissive].map(value => value * material.emissiveIntensity) } : {}),
    });
    const compact = compactIndex === true, short = compact && index !== null && index.array instanceof Uint16Array;
    meshes.push({ name: nodeName, primitives: [{ attributes, ...(compact && index === null ? {} : { indices: accessor(indices, 1, 'SCALAR', true, false, short) }), material: materialIndex }] });
    if (extras !== undefined && ['castShadow', 'nativeAttributes', 'matrix64', 'instances64'].some(key => Object.hasOwn(extras, key))) throw new Error('GLB application extras use a reserved key');
    const node: Record<string, Json> = { name: nodeName, mesh: meshes.length - 1, extras: { ...extras, castShadow, ...(nativeAttributes === true ? { nativeAttributes: native,
      ...(transform === undefined ? {} : { matrix64: transform.elements }),
      ...(instances === undefined ? {} : { instances64: instances.map(matrix => matrix.elements) }) } : {}) } };
    if (instances === undefined && (exactInstances !== undefined || instanceColours !== undefined)) throw new Error('Instance options need instances');
    if (instances !== undefined) {
      if (instances.length === 0 || instances.length > 10_000) throw new Error('Invalid instance count');
      let instanceAttributes: Record<string, Json>;
      if (exactInstances === true) instanceAttributes = { _MATRIX: accessor(instances.flatMap(matrix => matrix.elements), 16, 'MAT4') };
      else {
        const t: number[] = [], r: number[] = [], s: number[] = [];
        for (const matrix of instances) { const { position, rotation, scale } = trs(matrix); t.push(...position); r.push(...rotation); s.push(...scale); }
        instanceAttributes = { TRANSLATION: accessor(t, 3, 'VEC3'), ROTATION: accessor(r, 4, 'VEC4'), SCALE: accessor(s, 3, 'VEC3') };
      }
      if (instanceColours !== undefined) {
        if (instanceColours.length !== instances.length) throw new Error('Instance colours must match instance count');
        instanceAttributes['_COLOR_0'] = accessor(instanceColours.flatMap(colour => [colour.r, colour.g, colour.b]), 3, 'VEC3');
      }
      node['extensions'] = { EXT_mesh_gpu_instancing: { attributes: instanceAttributes } };
    }
    if (transform !== undefined) {
      if (instances !== undefined) throw new Error('A GLB node takes a transform or instances, not both');
      const { position, rotation, scale } = trs(transform);
      // only what differs from the identity, so a translated node keeps its exact translation
      if (position.x !== 0 || position.y !== 0 || position.z !== 0) node['translation'] = [position.x, position.y, position.z];
      if (rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0 || rotation.w !== 1) node['rotation'] = [rotation.x, rotation.y, rotation.z, rotation.w];
      if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) node['scale'] = [scale.x, scale.y, scale.z];
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

import { BufferAttribute, BufferGeometry, Float16BufferAttribute, type TypedArray, Material, Mesh, type Object3D } from 'three';
import { nativeWholeGeometry } from './nativeGeometry';

function isGeometryMesh(node: Object3D): node is Mesh {
  if (!(node instanceof Mesh)) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return geometry instanceof BufferGeometry && (material instanceof Material || (Array.isArray(material) && material.every((item: unknown) => item instanceof Material)));
}

const raw = (attribute: BufferAttribute): Uint8Array => new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
const storage = (value: unknown): value is (new(buffer: ArrayBuffer) => TypedArray) => [Float32Array, Float64Array, Uint32Array, Int32Array, Uint16Array, Int16Array, Uint8Array, Int8Array, Uint8ClampedArray].some(type => type === value);
function appendAttributes(parts: readonly BufferAttribute[]): BufferAttribute {
  const first = parts[0]; if (first === undefined) throw new Error('Missing geometry channel segment');
  const Constructor = first.array.constructor;
  if (!storage(Constructor) || parts.some(part => part.itemSize !== first.itemSize || part.normalized !== first.normalized || part.array.constructor !== Constructor || (part instanceof Float16BufferAttribute) !== (first instanceof Float16BufferAttribute))) throw new Error('Geometry segment channel storage differs');
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.array.byteLength, 0));
  let at = 0; for (const part of parts) { bytes.set(raw(part), at); at += part.array.byteLength; }
  const array = new Constructor(bytes.buffer);
  const result = first instanceof Float16BufferAttribute && array instanceof Uint16Array ? new Float16BufferAttribute(array, first.itemSize, first.normalized) : new BufferAttribute(array, first.itemSize, first.normalized);
  result.name = first.name; result.gpuType = first.gpuType; result.setUsage(first.usage); return result;
}
/** Restore physical storage segments into one native draw, without welding or changing index words. */
function restoreSegments(parts: readonly BufferGeometry[]): BufferGeometry {
  const first = parts[0]; if (first === undefined) throw new Error('Missing geometry segment');
  const names = Object.keys(first.attributes).sort(), indexed = first.index !== null;
  const attributes = new Map<string, BufferAttribute[]>();
  for (const part of parts) {
    if (JSON.stringify(Object.keys(part.attributes).sort()) !== JSON.stringify(names) || (part.index !== null) !== indexed) throw new Error('Geometry segment topology differs');
    for (const name of names) {
      const attribute = part.getAttribute(name); if (!(attribute instanceof BufferAttribute)) throw new Error('Geometry segments need plain channels');
      const channels = attributes.get(name) ?? [], original = channels[0];
      if (original !== undefined && (attribute.itemSize !== original.itemSize || attribute.normalized !== original.normalized || attribute.array.constructor !== original.array.constructor || (attribute instanceof Float16BufferAttribute) !== (original instanceof Float16BufferAttribute))) throw new Error('Geometry segment channel storage differs');
      if (indexed && original !== undefined) { const a = raw(original), b = raw(attribute); if (a.length !== b.length || a.some((word, i) => word !== b[i])) throw new Error('Indexed geometry segment vertices differ'); }
      channels.push(attribute); attributes.set(name, channels);
    }
  }
  const indices = parts.flatMap(part => part.index === null ? [] : [part.index]);
  const bytes = [...attributes.values()].reduce((sum, channels) => sum + channels.slice(0, indexed ? 1 : channels.length).reduce((total, channel) => total + channel.array.byteLength, 0), 0) + indices.reduce((sum, index) => sum + index.array.byteLength, 0);
  if (bytes > 25_000_000) throw new Error('Restored geometry byte cap');
  if (indices.some(index => index.itemSize !== 1 || index.normalized || index.count % 3 !== 0)) throw new Error('Geometry segment index storage differs');
  const result = new BufferGeometry();
  for (const [name, channels] of attributes) {
    const firstChannel = channels[0]; if (firstChannel === undefined) throw new Error('Missing geometry channel segment');
    result.setAttribute(name, indexed ? firstChannel.clone() : appendAttributes(channels));
  }
  if (indexed) result.setIndex(appendAttributes(indices));
  return result;
}

/** Offline model geometry intake. Load once before synchronous model placement, then take independent mutable copies.
 * Materials, animation and colliders stay with their existing runtime owners. No services are installed on import. */
export interface OwnedGeometry {
  /** Load immutable GLB storage. Optional ordered segments restore one native geometry;
   * indexed segments repeat identical vertex bytes and carry consecutive original index slices. */
  load: (bytes?: Uint8Array | BufferGeometry, segments?: readonly Uint8Array[]) => Promise<void>;
  /** Adopt an already owned geometry without copying; only an unloaded intake accepts it. */
  adopt: (geometry: BufferGeometry) => void;
  /** A deep attribute copy, safe to scale, merge, change collectible slots or release after GPU upload. */
  copy: () => BufferGeometry;
  /** Transfer a template into one owner; neither loader nor cache retains its attributes afterwards. */
  take: () => BufferGeometry;
}

/** A single identity-space, unquantized baked triangle mesh. Custom GLB channels map back to authored shader names. */
export function createOwnedGeometry(url: string, channels: Readonly<Record<string, string>> = {}): OwnedGeometry {
  let template: BufferGeometry | undefined, pending: Promise<void> | undefined;
  const load = async (bytes?: Uint8Array): Promise<void> => {
    const { createRigLoader } = await import('../anim/rig');
    let input = bytes;
    if (input === undefined) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Baked model load failed: ${url} (${response.status})`);
      input = new Uint8Array(await response.arrayBuffer());
    }
    const gltf = await createRigLoader().parseAsync(Uint8Array.from(input).buffer, '');
    const meshes: Mesh[] = [];
    gltf.scene.traverse(node => { if (isGeometryMesh(node)) meshes.push(node); });
    try {
      const [mesh] = meshes;
      if (mesh === undefined || meshes.length !== 1) throw new Error(`Baked model needs one mesh: ${url}`);
      gltf.scene.updateMatrixWorld(true);
      if (mesh.matrixWorld.elements.some((value, i) => value !== (i % 5 === 0 ? 1 : 0))) throw new Error(`Baked model needs identity space: ${url}`);
      // The parser and this intake are the only owners of this single mesh.
      // Borrowed BufferGeometry input still copies in load(); private GLB
      // attributes can pass directly into the intake instead of doubling them.
      const geometry = mesh.userData['nativeAttributes'] === undefined ? mesh.geometry : nativeWholeGeometry(mesh, 'take');
      const index = geometry.getIndex();
      // The deterministic GLB writer emits identity indices for an authored triangle soup; restore its original draw.
      if (mesh.userData['nativeAttributes'] === undefined && index !== null && index.count === geometry.getAttribute('position').count && index.array.every((value, i) => value === i)) geometry.setIndex(null);
      for (const [from, to] of Object.entries(channels)) {
        if (!geometry.hasAttribute(from)) { geometry.dispose(); throw new Error(`Baked model is missing ${from}: ${url}`); }
        geometry.setAttribute(to, geometry.getAttribute(from)); geometry.deleteAttribute(from);
      }
      template = geometry;
    } finally {
      for (const mesh of meshes) {
        if (mesh.geometry !== template) mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      }
    }
  };
  const start = async (bytes?: Uint8Array): Promise<void> => {
    try { await load(bytes); } catch (error: unknown) { pending = undefined; throw error; }
  };
  const segmented = async (bytes: readonly Uint8Array[]): Promise<void> => {
    const parts: BufferGeometry[] = [];
    try {
      for (const part of bytes) { const intake = createOwnedGeometry(url, channels); await intake.load(part); parts.push(intake.take()); }
      template = restoreSegments(parts);
    } catch (error) { pending = undefined; throw error; }
    finally { for (const part of parts) part.dispose(); }
  };
  return {
    load: (bytes, segments) => {
      if (segments !== undefined) {
        if (!(bytes instanceof Uint8Array)) return Promise.reject(new Error('Geometry segments require original GLB bytes'));
        if (segments.length === 0 || segments.length > 15 || bytes.byteLength + segments.reduce((sum, part) => sum + part.byteLength, 0) > 100_000_000) return Promise.reject(new Error('Geometry storage segment cap'));
        pending ??= segmented([bytes, ...segments]); return pending;
      }
      if (bytes instanceof BufferGeometry) { template?.dispose(); template = bytes.clone(); pending = Promise.resolve(); return pending; }
      pending ??= start(bytes);
      return pending;
    },
    adopt: (geometry) => {
      if (template !== undefined || pending !== undefined) throw new Error(`Baked model is already loaded: ${url}`);
      template = geometry; pending = Promise.resolve();
    },
    take: () => { if (template === undefined) throw new Error(`Baked model was not loaded: ${url}`); const geometry = template; template = undefined; pending = undefined; return geometry; },
    copy: () => { if (template === undefined) throw new Error(`Baked model was not loaded: ${url}`); return template.clone(); },
  };
}

/** A bounded declaration of owned templates. Register all handles before loading;
 * each handle keeps its own copy/adopt/take ownership and failed-load retry policy. */
export interface OwnedGeometryBatch {
  /** Admit an immutable slot/channel table; a repeated declaration must match. */
  declare: (rows: readonly { readonly slot: string; readonly channels: readonly (readonly [string, string])[] }[]) => void;
  /** Resolve a declared handle without allocating another template. */
  handle: (slot: string) => OwnedGeometry;
  /** All declared intakes completed their most recent batch load. */
  readonly ready: boolean;
  /** Declare one unique source/key (at most 128); retains no decoded attributes itself. */
  geometry: (url: string, channels?: Readonly<Record<string, string>>) => OwnedGeometry;
  /** Start every declared intake together. An absent map entry keeps the ordinary URL fetch path. */
  load: (bytes?: ReadonlyMap<string, Uint8Array | BufferGeometry>) => Promise<void>;
}

/** Group preloads without changing the single-template decoder or owning a second copy. */
export function createOwnedGeometryBatch(): OwnedGeometryBatch {
  const entries = new Map<string, OwnedGeometry>();
  let declaration: string | undefined, ready = false;
  const batch: OwnedGeometryBatch = {
    get ready() { return ready; },
    declare: rows => {
      const key = JSON.stringify(rows);
      if (declaration !== undefined) { if (key !== declaration) throw new Error('Owned geometry declaration changed'); return; }
      if (entries.size > 0 || rows.length === 0 || rows.length > 128 || new Set(rows.map(row => row.slot)).size !== rows.length
        || rows.some(row => !row.slot || row.channels.length > 8 || new Set(row.channels.map(([from]) => from)).size !== row.channels.length)) throw new Error('Invalid owned geometry declaration');
      for (const row of rows) batch.geometry(row.slot, Object.fromEntries(row.channels));
      declaration = key;
    },
    handle: slot => { const handle = entries.get(slot); if (handle === undefined) throw new Error(`Baked model was not loaded: ${slot}`); return handle; },
    geometry: (url, channels = {}) => {
      if (!url || entries.has(url) || entries.size >= 128 || declaration !== undefined) throw new Error('Invalid owned geometry declaration');
      const geometry = createOwnedGeometry(url, channels);
      entries.set(url, geometry);
      return geometry;
    },
    load: async (bytes) => {
      await Promise.all([...entries].map(([url, geometry]) => geometry.load(bytes?.get(url))));
      ready = true;
    },
  };
  return batch;
}

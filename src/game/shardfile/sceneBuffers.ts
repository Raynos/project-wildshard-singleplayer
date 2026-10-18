import { BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBuffer, InterleavedBufferAttribute, LOD, Mesh, Object3D, Points, Sphere, Vector3, type Material } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import type { Scope } from '@wildshard/engine/app/scope';
import { parseSceneBuffers, type SceneBuffers } from '@wildshard/format/sceneBuffers';
import type { PlumbingData } from '@wildshard/format/plumbing';
import { plumbingKnob } from '../shard/declaredPlumbing';

type Storage = Float32Array | Uint16Array | Uint8Array;
/** Decode every bounded source before scene allocation. Raw byte words retain signed zero and original storage. */
function decode(row: SceneBuffers): ReadonlyMap<string, Storage> {
  const result = new Map<string, Storage>();
  for (const buffer of row.buffers) {
    if (buffer.bytes.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(buffer.bytes) || /[=]/u.test(buffer.bytes.slice(0, -2))) throw new Error('Malformed scene buffer encoding');
    const bytes = Uint8Array.from(atob(buffer.bytes), char => char.codePointAt(0) ?? 0);
    const width = buffer.storage === 'f32' ? 4 : buffer.storage === 'u16' ? 2 : 1;
    if (bytes.byteLength % width !== 0) throw new Error('Misaligned scene buffer storage');
    const storage = buffer.storage === 'f32' ? new Float32Array(bytes.buffer) : buffer.storage === 'u16' ? new Uint16Array(bytes.buffer) : bytes;
    if (storage instanceof Float32Array && !storage.every(Number.isFinite)) throw new Error('Nonfinite scene buffer');
    if (buffer.stride !== undefined && storage.length % buffer.stride !== 0) throw new Error('Misaligned scene interleave');
    result.set(buffer.id, storage);
  }
  for (const attribute of row.attributes) {
    const buffer = row.buffers.find(value => value.id === attribute.buffer), storage = result.get(attribute.buffer);
    if (buffer === undefined || storage === undefined || storage.length % (buffer.stride ?? attribute.size) !== 0) throw new Error('Misaligned scene attribute');
  }
  return result;
}
/** Client-only typed field admission, performed before allocating materials or geometry. */
export function admitSceneBuffers(input: unknown): SceneBuffers {
  const row = parseSceneBuffers(input); decode(row); return row;
}
/** Reconstruct baked draws with shared attributes and interleaves. Data alone supplies topology, bounds, counts and LODs. */
export function createSceneBuffers(input: unknown, material: Material, scope: Scope, plumbing?: PlumbingData | null): Group {
  const row = parseSceneBuffers(input), storage = decode(row);
  if (scope.disposed) throw new Error('Scene buffer scope is disposed');
  const buffers = new Map<string, InterleavedBuffer>();
  for (const buffer of row.buffers) {
    if (buffer.stride === undefined) continue;
    const values = storage.get(buffer.id); if (values === undefined) throw new Error('Missing admitted scene storage');
    buffers.set(buffer.id, buffer.instanced ? new InstancedInterleavedBuffer(values, buffer.stride) : new InterleavedBuffer(values, buffer.stride));
  }
  const attributes = new Map<string, BufferAttribute | InterleavedBufferAttribute>();
  for (const attribute of row.attributes) {
    const source = row.buffers.find(value => value.id === attribute.buffer), values = storage.get(attribute.buffer);
    if (source === undefined || values === undefined) throw new Error('Missing admitted scene attribute');
    const interleaved = buffers.get(attribute.buffer);
    attributes.set(attribute.id, interleaved === undefined
      ? source.instanced ? new InstancedBufferAttribute(values, attribute.size, attribute.normalized) : new BufferAttribute(values, attribute.size, attribute.normalized)
      : new InterleavedBufferAttribute(interleaved, attribute.size, attribute.offset, attribute.normalized));
  }
  const geometries = new Map<string, BufferGeometry>(), owner = scope.child('buffered-draws');
  try {
    for (const definition of row.geometries) {
      const geometry = owner.own(definition.instances === undefined ? new BufferGeometry() : new InstancedBufferGeometry());
      for (const [name, id] of Object.entries(definition.attributes)) {
        const attribute = attributes.get(id); if (attribute === undefined) throw new Error('Missing admitted scene channel');
        geometry.setAttribute(name, attribute);
      }
      if (definition.index !== undefined) {
        const index = attributes.get(definition.index);
        if (!(index instanceof BufferAttribute) || index.normalized || !(index.array instanceof Uint16Array || index.array instanceof Uint8Array)) throw new Error('Invalid scene triangle index');
        if (!geometry.hasAttribute('position')) throw new Error('Scene index needs position vertices');
        const vertices = geometry.getAttribute('position').count;
        if (index.count % 3 !== 0 || index.array.some(value => value >= vertices)) throw new Error('Scene index exceeds its vertices');
        geometry.setIndex(index);
      }
      if (geometry instanceof InstancedBufferGeometry && definition.instances !== undefined) {
        const count = definition.instances;
        geometry.instanceCount = typeof count === 'number' ? count : plumbingKnob(plumbing, TIER, count.knob, 'number') >= count.threshold ? count.above : count.below;
        for (const attribute of Object.values(geometry.attributes)) {
          const instanced = attribute instanceof InstancedBufferAttribute || attribute instanceof InterleavedBufferAttribute && attribute.data instanceof InstancedInterleavedBuffer;
          if (instanced && geometry.instanceCount > attribute.count) throw new Error('Scene instance count exceeds its channel');
        }
      }
      if (definition.sphere !== undefined) geometry.boundingSphere = new Sphere(new Vector3(definition.sphere[0], definition.sphere[1], definition.sphere[2]), definition.sphere[3]);
      geometries.set(definition.id, geometry);
    }
    const group = new Group(); group.name = row.name;
    const make = (draw: NonNullable<SceneBuffers['draws'][number]['draw']> | undefined): Object3D => {
      if (draw === undefined) return new Object3D();
      const geometry = geometries.get(draw.geometry); if (geometry === undefined) throw new Error('Missing admitted scene geometry');
      const object = draw.kind === 'points' ? new Points(geometry, material) : new Mesh(geometry, material);
      object.position.set(...draw.at); object.frustumCulled = draw.frustum; return object;
    };
    for (const draw of row.draws) {
      let object: Object3D;
      if (draw.levels === undefined) object = make(draw.draw);
      else { const lod = new LOD(); for (const level of draw.levels) lod.addLevel(make(level.draw), level.from); object = lod; }
      object.name = draw.name; object.position.add(new Vector3(...draw.at)); group.add(object);
    }
    owner.onDispose(() => { group.removeFromParent(); });
    return group;
  } catch (error) { owner.dispose(); throw error; }
}

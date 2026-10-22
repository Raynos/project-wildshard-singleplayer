import { BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBuffer, InterleavedBufferAttribute, LOD, Mesh, Object3D, Points, Sphere, Vector3, type Material } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import type { Scope } from '@wildshard/engine/app/scope';
import type { App } from '@wildshard/engine/app/app';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { parseSceneBuffers, type SceneBuffers } from '@wildshard/format/sceneBuffers';
import type { PlumbingData } from '@wildshard/format/plumbing';
import { plumbingKnob } from '../shard/declaredPlumbing';

type Storage = Float32Array | Uint16Array | Uint8Array;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', BASE64 = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) BASE64[ALPHABET.codePointAt(i) ?? 0] = i;
/** O25: a validated base64 text's bytes. `Uint8Array.from(atob(text), callback)` spent ~90 ms per decode on Sky Reach's
 *  2.4 MB scene draws (twice per admission), one frame of 300+ ms entering the cell; this is ~20× faster, same bytes. */
function base64Bytes(text: string): Uint8Array {
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0, out = new Uint8Array(text.length / 4 * 3 - pad);
  for (let i = 0, o = 0; i < text.length; i += 4) {
    const at = (k: number): number => BASE64[text.codePointAt(i + k) ?? 0] ?? 0;
    const word = (at(0) << 18) | (at(1) << 12) | (at(2) << 6) | at(3);
    out[o++] = word >> 16;
    if (o < out.length) out[o++] = (word >> 8) & 255;
    if (o < out.length) out[o++] = word & 255;
  }
  return out;
}
/** Decode every bounded source before scene allocation. Raw byte words retain signed zero and original storage. */
function decode(row: SceneBuffers): ReadonlyMap<string, Storage> {
  const result = new Map<string, Storage>();
  for (const buffer of row.buffers) {
    if (buffer.bytes.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(buffer.bytes) || /[=]/u.test(buffer.bytes.slice(0, -2))) throw new Error('Malformed scene buffer encoding');
    const bytes = base64Bytes(buffer.bytes);
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
/** An admitted content URL and its authoritative resource owner, never an entered root or material. */
export interface SceneBufferReuse {
  readonly content: string;
  readonly assets: Pick<App['assets'], 'register' | 'acquireResource' | 'evictCached'>;
}
const builds = new WeakMap<SceneBufferReuse['assets'], Map<string, ReadonlyMap<string, BufferGeometry>>>();
function instanceCounts(row: SceneBuffers, plumbing: PlumbingData | null | undefined): readonly (number | undefined)[] {
  return row.geometries.map(definition => {
    const count = definition.instances;
    return typeof count === 'object' ? plumbingKnob(plumbing, TIER, count.knob, 'number') >= count.threshold ? count.above : count.below : count;
  });
}
function buildGeometries(row: SceneBuffers, counts: readonly (number | undefined)[], own: (geometry: BufferGeometry) => void): ReadonlyMap<string, BufferGeometry> {
  const storage = decode(row);
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
  const geometries = new Map<string, BufferGeometry>();
  for (const [geometryIndex, definition] of row.geometries.entries()) {
    const geometry = definition.instances === undefined ? new BufferGeometry() : new InstancedBufferGeometry();
    try {
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
        const count = counts[geometryIndex];
        if (count === undefined) throw new Error('Missing admitted instance count');
        geometry.instanceCount = count;
        for (const attribute of Object.values(geometry.attributes)) {
          const instanced = attribute instanceof InstancedBufferAttribute || attribute instanceof InterleavedBufferAttribute && attribute.data instanceof InstancedInterleavedBuffer;
          if (instanced && geometry.instanceCount > attribute.count) throw new Error('Scene instance count exceeds its channel');
        }
      }
      if (definition.sphere !== undefined) geometry.boundingSphere = new Sphere(new Vector3(definition.sphere[0], definition.sphere[1], definition.sphere[2]), definition.sphere[3]);
      own(geometry); geometries.set(definition.id, geometry);
    } catch (error) { geometry.dispose(); throw error; }
  }
  return geometries;
}
/** Fresh draw objects can borrow fixed storage through charged, pressure-evictable assets.
 * Content identity, tier and every resolved instance count isolate reusable builds. */
export function createSceneBuffers(input: unknown, material: Material, scope: Scope, plumbing?: PlumbingData | null, reuse?: SceneBufferReuse): Group {
  if (scope.disposed || scope.disposing) throw new Error('Scene buffer scope is disposed or retiring');
  const row = parseSceneBuffers(input), counts = instanceCounts(row, plumbing), owner = scope.child('buffered-draws');
  try {
    let geometries: ReadonlyMap<string, BufferGeometry>;
    if (reuse === undefined) geometries = buildGeometries(row, counts, geometry => { owner.own(geometry); });
    else {
      if (reuse.content.length === 0) throw new Error('Reusable scene buffers need admitted content identity');
      let memo = builds.get(reuse.assets);
      if (memo === undefined) { memo = new Map(); builds.set(reuse.assets, memo); }
      const key = JSON.stringify([reuse.content, TIER, counts]), known = memo.get(key);
      if (known !== undefined) {
        geometries = known;
        for (const geometry of geometries.values()) {
          const release = reuse.assets.acquireResource(geometry);
          if (release === null) throw new Error('Reusable scene geometry has retired');
          owner.onDispose(release);
        }
      } else {
        const registered: string[] = [];
        try {
          geometries = buildGeometries(row, counts, geometry => {
            const asset = `scene:${geometry.uuid}`;
            reuse.assets.register(asset, geometry, { retain: true, cache: true, reusable: true });
            registered.push(asset);
            const release = reuse.assets.acquireResource(geometry);
            if (release === null) throw new Error('New scene geometry has no owner');
            owner.onDispose(release);
          });
        } catch (error) {
          owner.dispose();
          for (const asset of registered) reuse.assets.evictCached(asset);
          throw error;
        }
        const cache = memo, built = geometries;
        memo.set(key, geometries);
        cacheUntilDisposed(geometries, () => { if (cache.get(key) === built) cache.delete(key); });
      }
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

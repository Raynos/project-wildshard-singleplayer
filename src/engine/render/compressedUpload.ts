import * as THREE from 'three';
import { resourceScope } from '../app/resources';
import { recordBootCheckpoint } from '../boot/bootTrace';
import type { Renderer } from './renderer';
import { retainCompressedMipmaps, finalizeCompressedMipmaps, compressedTextureKey } from './compressedMipmaps';

/** The actual renderer operations needed to isolate a compressed texture upload. */
type UploadTarget = Pick<Renderer, 'initTexture' | 'getContext' | 'properties'>;
interface UploadState {
  tail: Promise<void>;
  pending: WeakMap<THREE.Texture, { version: number; signature: string; promise: Promise<void> }>;
  failed: WeakMap<THREE.Texture, { allocation: unknown; error: Error }>;
}
const states = new WeakMap<UploadTarget, UploadState>();
const frame = (): Promise<void> => new Promise(resolve => {
  resourceScope().raf(() => { resourceScope().timeout(0, resolve); });
});

/** Once initial warm-up starts, late compressed consumers use the same renderer-wide queue. */
export function compressedUploadsActive(renderer: UploadTarget): boolean { return states.has(renderer); }

/** Upload one compressed 2D/array texture outside a draw, with a real paint and error round trip on each side.
 * Concurrent warm-up and late-load callers share one queue. A consumer may bind the texture only after this resolves.
 * Already resident versions reuse the result; cancellation and graphics faults never publish readiness.
 * A provisional loader fence retains mips until the final sampler's warm-up fence. */
export function uploadCompressedTexture(renderer: UploadTarget, texture: THREE.Texture,
  current: () => boolean = () => true, final = true): Promise<void> {
  if (!(texture instanceof THREE.CompressedTexture)) return Promise.resolve();
  let state = states.get(renderer);
  if (state === undefined) {
    state = { tail: Promise.resolve(), pending: new WeakMap(), failed: new WeakMap() };
    states.set(renderer, state);
  }
  const queue = state, version = texture.version, signature = compressedTextureKey(texture);
  const allocation = (): unknown => {
    const properties: unknown = renderer.properties.get(texture);
    return typeof properties === 'object' && properties !== null ? Reflect.get(properties, '__webglTexture') : undefined;
  };
  const resident = (): boolean => {
    const properties: unknown = renderer.properties.get(texture);
    const source: unknown = renderer.properties.get(texture.source);
    return typeof properties === 'object' && properties !== null
      && Reflect.get(properties, '__webglTexture') !== undefined
      && Reflect.get(properties, '__version') === version
      && Reflect.get(properties, '__cacheKey') === signature
      && typeof source === 'object' && source !== null && Reflect.get(source, '__version') === texture.source.version;
  };
  const check = (): void => {
    if (renderer.getContext().isContextLost()) throw new Error('Graphics context lost before compressed texture readiness');
    if (!current()) throw new Error('Shader warm-up owner left');
    if (texture.version !== version || compressedTextureKey(texture) !== signature) throw new Error('Compressed texture changed before upload completed');
  };
  const publish = (): void => { check(); if (final) finalizeCompressedMipmaps(texture); };
  const pending = queue.pending.get(texture);
  if (pending?.version === version && pending.signature === signature) return pending.promise.then(publish);
  const failure = queue.failed.get(texture);
  if (failure !== undefined && allocation() === failure.allocation) return Promise.reject(failure.error);
  if (resident()) {
    try { publish(); return Promise.resolve(); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error(String(error))); }
  }
  const promise = queue.tail.then(async () => {
    check(); await frame(); check();
    // Another caller or a draw may have uploaded this version while it waited in the queue.
    if (resident()) return undefined;
    if (texture.mipmaps.length === 0) throw new Error(`Compressed texture ${texture.name || texture.id} has no mipmaps and is not resident on this renderer`);
    retainCompressedMipmaps(texture);
    recordBootCheckpoint('texture:upload', { id: texture.id, version, name: texture.name, format: texture.format,
      mips: texture.mipmaps.length, width: texture.mipmaps[0]?.width ?? 0, height: texture.mipmaps[0]?.height ?? 0 });
    renderer.initTexture(texture);
    const gl = renderer.getContext(), error = gl.getError();
    if (error !== gl.NO_ERROR) {
      const fault = new Error(`Graphics error ${error} after compressed texture ${texture.name || texture.format}`);
      queue.failed.set(texture, { allocation: allocation(), error: fault });
      throw fault;
    }
    queue.failed.delete(texture);
    await frame(); check();
    return undefined;
  });
  queue.pending.set(texture, { version, signature, promise });
  const clear = (): void => { if (queue.pending.get(texture)?.promise === promise) queue.pending.delete(texture); };
  void promise.then(clear, clear);
  queue.tail = promise.catch(() => undefined);
  return promise.then(publish);
}

import * as THREE from 'three';
import { resourceScope } from '../app/resources';
import { recordBootCheckpoint } from '../boot/bootTrace';
import type { Renderer } from './renderer';

/** The actual renderer operations needed to isolate a compressed texture upload. */
type UploadTarget = Pick<Renderer, 'initTexture' | 'getContext'>;
interface UploadState {
  tail: Promise<void>;
  pending: WeakMap<THREE.Texture, { version: number; promise: Promise<void> }>;
  ready: WeakMap<THREE.Texture, number>;
}
const states = new WeakMap<UploadTarget, UploadState>();
const frame = (): Promise<void> => new Promise(resolve => {
  resourceScope().raf(() => { resourceScope().timeout(0, resolve); });
});

/** Once initial warm-up starts, late compressed consumers use the same renderer-wide queue. */
export function compressedUploadsActive(renderer: UploadTarget): boolean { return states.has(renderer); }

/** Upload one compressed 2D/array texture outside a draw, with a real paint and error round trip on each side.
 * Concurrent warm-up and late-load callers share one queue. A consumer may bind the texture only after this resolves.
 * Already uploaded versions reuse the result; cancellation and graphics faults never publish readiness. */
export function uploadCompressedTexture(renderer: UploadTarget, texture: THREE.Texture,
  current: () => boolean = () => true): Promise<void> {
  if (!(texture instanceof THREE.CompressedTexture)) return Promise.resolve();
  let state = states.get(renderer);
  if (state === undefined) {
    state = { tail: Promise.resolve(), pending: new WeakMap(), ready: new WeakMap() };
    states.set(renderer, state);
  }
  const queue = state, version = texture.version;
  const check = (): void => {
    if (!current()) throw new Error('Shader warm-up owner left');
    if (texture.version !== version) throw new Error('Compressed texture changed before upload completed');
  };
  if (queue.ready.get(texture) === version) {
    try { check(); return Promise.resolve(); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error(String(error))); }
  }
  const pending = queue.pending.get(texture);
  if (pending?.version === version) return pending.promise.then(check);
  const promise = queue.tail.then(async () => {
    check(); await frame(); check();
    recordBootCheckpoint('texture:upload', { id: texture.id, version, name: texture.name, format: texture.format,
      mips: texture.mipmaps.length, width: texture.mipmaps[0]?.width ?? 0, height: texture.mipmaps[0]?.height ?? 0 });
    renderer.initTexture(texture);
    const gl = renderer.getContext(), error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`Graphics error ${error} after compressed texture ${texture.name || texture.format}`);
    await frame(); check();
    queue.ready.set(texture, version);
    return undefined;
  });
  queue.pending.set(texture, { version, promise });
  const clear = (): void => { if (queue.pending.get(texture)?.promise === promise) queue.pending.delete(texture); };
  void promise.then(clear, clear);
  queue.tail = promise.catch(() => undefined);
  return promise;
}

import type { Texture } from 'three';

/** Three r186's storage/sampler key; repeat/offset are uniforms, not storage identity. */
export function compressedTextureKey(texture: Texture): string {
  const wrapR: unknown = Reflect.get(texture, 'wrapR');
  return [texture.wrapS, texture.wrapT, typeof wrapR === 'number' ? wrapR : 0,
    texture.magFilter, texture.minFilter, texture.anisotropy, texture.internalFormat,
    texture.format, texture.type, texture.generateMipmaps, texture.premultiplyAlpha,
    texture.flipY, texture.unpackAlignment, texture.colorSpace].join(',');
}

const retained = new WeakSet<Texture>();
const releasable = new WeakSet<Texture>();
const immutable = new WeakSet<Texture>();
const SAMPLER_FIELDS = ['wrapS', 'wrapT', 'wrapR', 'magFilter', 'minFilter', 'anisotropy', 'internalFormat',
  'format', 'type', 'generateMipmaps', 'premultiplyAlpha', 'flipY', 'unpackAlignment', 'colorSpace'] as const;
const retired = new WeakMap<Texture, { sampler: readonly unknown[]; version: number; sourceVersion: number }>();
/** D227 (Debug 'Retire texture mips at first draw', default off): textures retired when their upload completes, and the
 *  sources they shared: a texture drawn from such a source without mips of its own is a clone made after retirement */
const atUpload = new WeakSet<Texture>(), uploadRetiredSources = new WeakSet();

/** Fail before Three accesses released pixels after a sampler/storage/source mutation. */
export function assertCompressedMipmapsUnchanged(texture: Texture): void {
  const previous = retired.get(texture);
  if (previous === undefined) {
    // a clone after upload retirement shares the source but holds no mips: it would upload nothing, so it refuses loudly
    if (texture.mipmaps.length === 0 && uploadRetiredSources.has(texture.source)) {
      throw new Error(`Compressed texture ${texture.name || texture.id} copies a texture whose mips retired at upload; clone it before its upload`);
    }
    return;
  }
  const sampler = previous.sampler;
  // Keep the native sampler order and short circuit, using typed scalar loads.
  const changed = previous.version !== texture.version || previous.sourceVersion !== texture.source.version
    || texture.wrapS !== sampler[0] || texture.wrapT !== sampler[1] || Reflect.get(texture, 'wrapR') !== sampler[2]
    || texture.magFilter !== sampler[3] || texture.minFilter !== sampler[4] || texture.anisotropy !== sampler[5]
    || texture.internalFormat !== sampler[6] || texture.format !== sampler[7] || texture.type !== sampler[8]
    || texture.generateMipmaps !== sampler[9] || texture.premultiplyAlpha !== sampler[10]
    || texture.flipY !== sampler[11] || texture.unpackAlignment !== sampler[12] || texture.colorSpace !== sampler[13];
  if (changed) throw new Error(`Compressed texture ${texture.name || texture.id} changed after mip retirement; configure its sampler before first draw`);
}

/** Loader registrations keep their preparation fence. An explicit GPU-only declaration
 * has already finalized its sampler, but still waits for a successful native draw. */
export function registerCompressedMipmaps(texture: Texture, gpuOnly = false, retireAtUpload = false): void {
  releasable.add(texture);
  if (gpuOnly && !retired.has(texture)) immutable.add(texture);
  if (retireAtUpload && !retired.has(texture)) atUpload.add(texture);
}
/** Whether an explicit immutable declaration may retire at its first native draw. */
export function immutableCompressedMipmaps(texture: Texture): boolean { return immutable.has(texture); }

/** A provisional upload keeps the pixels needed by the consumer's final sampler. */
export function retainCompressedMipmaps(texture: Texture): void { retained.add(texture); }

/** Upload completion keeps pixels: only the renderer's successful real draw may retire them. A texture registered to retire at
 *  upload (D227's row: its sampler is final before upload) retires here: a loader upload of a prop never yet drawn kept its
 *  mips for good (Pine: 77 maps, 35.1 MB at 30 s of play). */
export function compressedMipmapsUploaded(texture: Texture): void {
  if (atUpload.has(texture) && !retired.has(texture)) {
    atUpload.delete(texture); uploadRetiredSources.add(texture.source); finalizeCompressedMipmaps(texture); return;
  }
  retained.add(texture);
}

/** Only a successful first draw retires a finalized loader's mip chain. */
export function finalizeCompressedMipmaps(texture: Texture): void {
  retained.delete(texture);
  if (releasable.has(texture)) {
    immutable.delete(texture);
    retired.set(texture, { sampler: SAMPLER_FIELDS.map((field): unknown => Reflect.get(texture, field)), version: texture.version, sourceVersion: texture.source.version });
    texture.mipmaps = [];
  }
}

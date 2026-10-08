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
const retired = new WeakMap<Texture, { key: string; version: number; sourceVersion: number }>();

/** Fail before Three accesses released pixels after a sampler/storage/source mutation. */
export function assertCompressedMipmapsUnchanged(texture: Texture): void {
  const previous = retired.get(texture);
  if (previous !== undefined && (previous.key !== compressedTextureKey(texture) || previous.version !== texture.version || previous.sourceVersion !== texture.source.version)) {
    throw new Error(`Compressed texture ${texture.name || texture.id} changed after mip retirement; configure its sampler before first draw`);
  }
}

/** Register the loader's CPU-copy retirement, without making an early upload final. */
export function registerCompressedMipmaps(texture: Texture): void { releasable.add(texture); }

/** A provisional upload keeps the pixels needed by the consumer's final sampler. */
export function retainCompressedMipmaps(texture: Texture): void { retained.add(texture); }

/** Upload completion keeps pixels: only the renderer's successful real draw may retire them. */
export function compressedMipmapsUploaded(texture: Texture): void {
  retained.add(texture);
}

/** Only a successful first draw retires a finalized loader's mip chain. */
export function finalizeCompressedMipmaps(texture: Texture): void {
  retained.delete(texture);
  if (releasable.has(texture)) {
    retired.set(texture, { key: compressedTextureKey(texture), version: texture.version, sourceVersion: texture.source.version });
    texture.mipmaps = [];
  }
}

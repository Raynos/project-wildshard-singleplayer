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

/** Register the loader's CPU-copy retirement, without making an early upload final. */
export function registerCompressedMipmaps(texture: Texture): void { releasable.add(texture); }

/** A provisional upload keeps the pixels needed by the consumer's final sampler. */
export function retainCompressedMipmaps(texture: Texture): void { retained.add(texture); }

/** The ordinary draw upload may release its immutable CPU copy unless a preparation owner still holds it. */
export function compressedMipmapsUploaded(texture: Texture): void {
  if (releasable.has(texture) && !retained.has(texture)) texture.mipmaps = [];
}

/** Only a successful final fence retires a provisional loader's mip chain. */
export function finalizeCompressedMipmaps(texture: Texture): void {
  retained.delete(texture);
  if (releasable.has(texture)) texture.mipmaps = [];
}

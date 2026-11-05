import { expect, test } from 'vitest';
import { CompressedTexture } from 'three';
import { assertCompressedMipmapsUnchanged, compressedMipmapsUploaded, finalizeCompressedMipmaps, registerCompressedMipmaps } from './compressedMipmaps';

const samplers = ['wrapS', 'wrapT', 'wrapR', 'magFilter', 'minFilter', 'anisotropy', 'internalFormat',
  'format', 'type', 'generateMipmaps', 'premultiplyAlpha', 'flipY', 'unpackAlignment', 'colorSpace'] as const;
function retiredTexture(): CompressedTexture {
  const texture = new CompressedTexture([], 1, 1);
  registerCompressedMipmaps(texture, true); finalizeCompressedMipmaps(texture);
  return texture;
}

test.each(samplers)('retired compressed storage refuses a changed %s before native use', field => {
  const texture = retiredTexture();
  try {
    expect(() => { assertCompressedMipmapsUnchanged(texture); }).not.toThrow();
    const prior: unknown = Reflect.get(texture, field);
    const changed = typeof prior === 'number' ? prior + 1 : typeof prior === 'boolean' ? !prior : prior === null ? 'changed' : 1;
    Reflect.set(texture, field, changed);
    expect(() => { assertCompressedMipmapsUnchanged(texture); }).toThrow('changed after mip retirement');
  } finally { texture.dispose(); }
});

test.each(['texture', 'source'] as const)('retired compressed storage refuses a new %s version', target => {
  const texture = retiredTexture();
  try {
    if (target === 'texture') texture.needsUpdate = true;
    else texture.source.needsUpdate = true;
    expect(() => { assertCompressedMipmapsUnchanged(texture); }).toThrow('changed after mip retirement');
  } finally { texture.dispose(); }
});

test('preparation remains mutable and a known retired mutation short circuits later getters', () => {
  const preparing = new CompressedTexture([], 1, 1), retired = retiredTexture();
  try {
    preparing.flipY = !preparing.flipY;
    expect(() => { assertCompressedMipmapsUnchanged(preparing); }).not.toThrow();
    retired.wrapS++;
    Object.defineProperty(retired, 'minFilter', {get: () => {throw new Error('Read after known storage mutation');}});
    expect(() => { assertCompressedMipmapsUnchanged(retired); }).toThrow('changed after mip retirement');
  } finally { preparing.dispose(); retired.dispose(); }
});

// D227 (the row's at-upload retirement): only a texture registered for it drops its mips when its upload completes
test('a texture registered to retire at upload drops its mips at upload completion; others keep them', () => {
  const level = { data: new Uint8Array(4), width: 1, height: 1 };
  const atUpload = new CompressedTexture([level], 1, 1), ordinary = new CompressedTexture([level], 1, 1);
  try {
    registerCompressedMipmaps(atUpload, false, true); registerCompressedMipmaps(ordinary);
    compressedMipmapsUploaded(atUpload); compressedMipmapsUploaded(ordinary);
    expect(atUpload.mipmaps).toEqual([]); expect(ordinary.mipmaps).toHaveLength(1);
  } finally { atUpload.dispose(); ordinary.dispose(); }
});

// wildshard-new's G872 guards: a clone made after upload retirement, and a sampler changed after it, refuse loudly
test('after upload retirement a clone refuses before it could upload no mips, and a sampler change refuses', () => {
  const texture = new CompressedTexture([{ data: new Uint8Array(4), width: 1, height: 1 }], 1, 1);
  try {
    registerCompressedMipmaps(texture, false, true); compressedMipmapsUploaded(texture);
    const clone = texture.clone();
    expect(() => { assertCompressedMipmapsUnchanged(clone); }).toThrow('copies a texture whose mips retired at upload');
    // three's copy marks the shared source for upload, so the original refuses too: never a silent mip-less draw
    expect(() => { assertCompressedMipmapsUnchanged(texture); }).toThrow('changed after mip retirement');
    clone.dispose();
  } finally { texture.dispose(); }
  const sampled = new CompressedTexture([{ data: new Uint8Array(4), width: 1, height: 1 }], 1, 1);
  try {
    registerCompressedMipmaps(sampled, false, true); compressedMipmapsUploaded(sampled);
    expect(() => { assertCompressedMipmapsUnchanged(sampled); }).not.toThrow();
    sampled.anisotropy += 1;
    expect(() => { assertCompressedMipmapsUnchanged(sampled); }).toThrow('changed after mip retirement');
  } finally { sampled.dispose(); }
});

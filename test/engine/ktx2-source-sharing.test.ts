import { expect, it } from 'vitest';
import { CompressedTexture, RGBA_S3TC_DXT5_Format, RGB_S3TC_DXT1_Format, RepeatWrapping } from 'three';
import { Ktx2Sources } from '../../src/engine/core/ktx2Sources';

function texture() {
  return new CompressedTexture([{ data: new Uint8Array(16).fill(17), width: 4, height: 4 }], 4, 4, RGBA_S3TC_DXT5_Format);
}

it('reuses only source identity across fresh decode waves and keeps fresh mips and sampler state', () => {
  const memo = new Ktx2Sources(), first = texture();
  memo.share(first, '/encoded/rock-a.ktx2', 0);
  first.mipmaps = []; first.dispose();
  const late = texture(), pixels = late.mipmaps;
  late.wrapS = RepeatWrapping; late.repeat.set(2, 3);
  memo.share(late, '/encoded/rock-a.ktx2', 0);
  expect(late.source).toBe(first.source);
  expect(late.mipmaps).toBe(pixels); expect(late.mipmaps[0]?.data.byteLength).toBe(16);
  expect(first.mipmaps).toEqual([]); expect(first.repeat.toArray()).toEqual([1, 1]);
  expect(late.repeat.toArray()).toEqual([2, 3]);
  expect(late.clone().source).toBe(first.source);
  late.dispose();
});

it('separates exact encoded URLs, selected mip levels and transcoded formats', () => {
  const memo = new Ktx2Sources(), first = texture(); memo.share(first, '/rock.ktx2', 0);
  for (const [url, level, format] of [
    ['/other.ktx2', 0, RGBA_S3TC_DXT5_Format], ['/rock.ktx2', 1, RGBA_S3TC_DXT5_Format],
    ['/rock.ktx2', 0, RGB_S3TC_DXT1_Format],
  ] as const) {
    const other = texture(); other.format = format; memo.share(other, url, level);
    expect(other.source).not.toBe(first.source); other.dispose();
  }
  first.dispose();
});

it('bounds weak identities even when all old sources are still live', () => {
  const memo = new Ktx2Sources(2), textures = [texture(), texture(), texture()];
  textures.forEach((value, index) => memo.share(value, `/file-${index}`, 0));
  const replacement = texture(); memo.share(replacement, '/file-0', 0);
  expect(replacement.source).not.toBe(textures[0]?.source);
  for (const value of [...textures, replacement]) value.dispose();
});

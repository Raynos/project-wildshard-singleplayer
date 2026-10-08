import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, CompressedArrayTexture, CompressedTexture, DataTexture, RGBA_S3TC_DXT5_Format } from 'three';
import { cachedResourceAllocations } from '../../src/engine/render/textureBytes';

it('deduplicates shared attribute/backing store identities and never resurrects released arrays', () => {
  const attribute = new BufferAttribute(new Float32Array(9), 3);
  const a = new BufferGeometry().setAttribute('position', attribute), b = new BufferGeometry().setAttribute('position', attribute);
  expect(cachedResourceAllocations(a)).toEqual(cachedResourceAllocations(b));
  expect(cachedResourceAllocations(a).map(row => row.bytes)).toEqual([36, 36]);
  Object.defineProperty(attribute, 'array', { get: () => { throw new Error('would read back'); }, configurable: true });
  expect(cachedResourceAllocations(a).map(row => row.bytes)).toEqual([36]);
});

it('counts exact compressed mip payloads before upload and preserves GPU allocation after CPU release', () => {
  const texture = new CompressedTexture([{ data: new Uint8Array(64), width: 8, height: 8 }, { data: new Uint8Array(16), width: 4, height: 4 }], 8, 8, RGBA_S3TC_DXT5_Format);
  const before = cachedResourceAllocations(texture);
  expect(before.filter(row => row.kind === 'gpu').reduce((sum, row) => sum + row.bytes, 0)).toBe(80);
  texture.mipmaps = [];
  expect(cachedResourceAllocations(texture).find(row => row.kind === 'gpu')).toEqual(before.find(row => row.kind === 'gpu'));
});

it('shares same-source texture uploads only for identical sampler/cache keys', () => {
  const texture = new DataTexture(new Uint8Array(64), 4, 4), clone = texture.clone();
  expect(cachedResourceAllocations(texture)).toEqual(cachedResourceAllocations(clone));
  clone.flipY = !texture.flipY;
  expect(cachedResourceAllocations(clone).find(row => row.kind === 'gpu')?.identity).not.toBe(cachedResourceAllocations(texture).find(row => row.kind === 'gpu')?.identity);
  expect(cachedResourceAllocations(clone).find(row => row.kind === 'cpu')?.identity).toBe(cachedResourceAllocations(texture).find(row => row.kind === 'cpu')?.identity);
});

it('charges uploaded compressed array blocks once rather than expanding to RGBA or multiplying the layers twice', () => {
  const texture = new CompressedArrayTexture([{ data: new Uint8Array(192), width: 8, height: 8 }, { data: new Uint8Array(48), width: 4, height: 4 }], 8, 8, 3, RGBA_S3TC_DXT5_Format);
  const rows = cachedResourceAllocations(texture);
  expect(rows.filter(row => row.kind === 'gpu').map(row => row.bytes)).toEqual([240]);
  expect(rows.filter(row => row.kind === 'cpu').reduce((sum, row) => sum + row.bytes, 0)).toBe(240);
  texture.mipmaps = [];
  expect(cachedResourceAllocations(texture).filter(row => row.kind === 'gpu')).toEqual(rows.filter(row => row.kind === 'gpu'));
});

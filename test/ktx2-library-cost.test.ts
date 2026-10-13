import { expect, it } from 'vitest';
import { textureMipBytes } from '../src/format/contentBounds';
import { parseKtx2 } from '../src/format/product';
import { deviceLibraryCost, textureLibrarySource, validateShardfileAssets } from '../src/format/assetAdmission';
import { worstContentCost } from '../src/format/budget';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';

const astc = { astc: true, bc7: false }, bc7 = { astc: false, bc7: true }, rgba = { astc: false, bc7: false };
function ktx(width = 1024, height = 512, levels = 11, model = 166): Uint8Array {
  const dfd = 80 + levels * 24, bytes = new Uint8Array(dfd + 24 + levels), view = new DataView(bytes.buffer);
  bytes.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  view.setUint32(20, width, true); view.setUint32(24, height, true); view.setUint32(36, 1, true); view.setUint32(40, levels, true);
  view.setUint32(48, dfd, true); view.setUint32(52, 24, true); bytes[dfd + 12] = model;
  for (let i = 0; i < levels; i++) { view.setBigUint64(80 + i * 24, BigInt(dfd + 24 + i), true); view.setBigUint64(88 + i * 24, 1n, true); view.setBigUint64(96 + i * 24, 1n, true); }
  return bytes;
}
function fixture(bytes = ktx()) {
  const hash = contentHash(bytes), full = parseKtx2(bytes);
  const source = emptyShardfile({ slug: 'texture-cost', name: 'Texture cost', author: 'test', seed: 1, revision: 1 });
  source.files = [{ hash, kind: 'ktx2', compressed: bytes.length, ...full, dependencies: [], critical: false }];
  source.library = [hash]; source.budgets.library = { resident: full.gpu, compressed: bytes.length };
  return { bytes, hash, source, assets: new Map([[hash, bytes]]) };
}
it('charges padded ASTC/BC7 blocks at every mip and retains full RGBA without trusted support', () => {
  const bytes = ktx(5, 3, 3);
  expect(parseKtx2(bytes).gpu).toBe(72);
  expect(parseKtx2(bytes, rgba).gpu).toBe(72);
  expect(parseKtx2(bytes, astc).gpu).toBe(64);
  expect(parseKtx2(bytes, bc7).gpu).toBe(64);
  expect(textureMipBytes(1, 1, 1, true)).toBe(16);
  expect(parseKtx2(ktx(1, 1, 1), astc).gpu).toBe(16);
  expect(() => textureMipBytes(4097, 1, 1, true)).toThrow('cap');
  expect(() => parseKtx2(ktx(4097, 1, 1), astc)).toThrow('cap');
});
it('discounts only an actually transcodable LDR source on its supported path', () => {
  const etc = ktx(1024, 512, 11, 163), unknown = ktx(1024, 512, 11, 1), raw = ktx();
  new DataView(raw.buffer).setUint32(12, 37, true);
  expect(parseKtx2(etc, astc)).toEqual(parseKtx2(etc));
  expect(parseKtx2(etc, bc7).gpu).toBeLessThan(parseKtx2(etc).gpu);
  expect(parseKtx2(unknown, astc)).toEqual(parseKtx2(unknown));
  expect(parseKtx2(raw, bc7)).toEqual(parseKtx2(raw));
});
it('applies the same exact admitted library cost to format totals and allocator claims on both device paths', () => {
  const { source, assets, bytes } = fixture();
  for (const support of [astc, bc7, rgba]) {
    expect(validateShardfileAssets(source, assets, contentHash, undefined, support)).toEqual(source);
    const projected = textureLibrarySource(source, assets, support), selected = parseKtx2(bytes, support).gpu;
    expect(projected.budgets.library.resident).toBe(selected);
    expect(deviceLibraryCost(source, assets, support)).toEqual(worstContentCost(projected));
    const allocator = new ResidencyAllocator(), scope = new Scope('texture-library');
    leaseClientLibrary(source, assets, { allocator, scope, owner: 'fixture', textures: support });
    expect(allocator.cost().input.libraries).toBe(selected);
    scope.dispose(); expect(allocator.entries()).toEqual([]);
  }
  expect(textureLibrarySource(source, assets)).toBe(source);
  expect(source.budgets.library.resident).toBe(parseKtx2(bytes).gpu);
});
it('preserves strict fallback/header/wire cost validation and deduplicates aliased roots', () => {
  const { source, assets, hash } = fixture();
  source.library.push(hash);
  expect(textureLibrarySource(source, assets, astc).budgets.library.resident).toBe(parseKtx2(assets.get(hash) ?? new Uint8Array(), astc).gpu);
  const file = source.files[0]; if (file === undefined) throw new Error('Missing fixture');
  file.gpu = 1;
  expect(() => validateShardfileAssets(source, assets, contentHash, undefined, astc)).toThrow('understated');
});

it('charges block padding above the RGBA fallback for a one-pixel library texture', () => {
  const { source, assets } = fixture(ktx(1, 1, 1));
  expect(source.budgets.library.resident).toBe(4);
  expect(textureLibrarySource(source, assets, astc).budgets.library.resident).toBe(16);
  const allocator = new ResidencyAllocator(), scope = new Scope('tiny-texture');
  leaseClientLibrary(source, assets, { allocator, scope, owner: 'fixture', textures: astc });
  expect(allocator.cost().input.libraries).toBe(16);
  scope.dispose();
});

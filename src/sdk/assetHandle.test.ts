import { expect, it } from 'vitest';
import { copyAssetBytes, hashAssetBytes, immutableAsset, verifyAssetBytes } from './assetHandle';
import { ownAssetBytes, withAssetOwner } from './assetOwner';
import { hashImmutableBytes } from './immutable';

it('carries a private snapshot through owned copies and refuses later mutation', () => {
  const source = new Uint8Array([3, 5, 7]), original = immutableAsset(source);
  const copy = copyAssetBytes(source);
  expect(copy).not.toBe(source);
  expect(immutableAsset(copy)).toBe(original);
  source.fill(9);
  expect(hashAssetBytes(source)).toBe(hashImmutableBytes(source));
  expect(hashAssetBytes(source)).not.toBe(original.hash);
  expect(original.copy()).toEqual(new Uint8Array([3, 5, 7]));
  copy[1] = 8;
  expect(immutableAsset(copy)).not.toBe(original);
  expect(original.copy()).toEqual(new Uint8Array([3, 5, 7]));
});

it('certifies actual disk bytes only against a genuine private snapshot', () => {
  const original = immutableAsset(new Uint8Array([2, 4, 6])), disk = original.copy();
  expect(verifyAssetBytes(disk, original.hash, original)).toBe(true);
  expect(immutableAsset(disk)).toBe(original);
  disk[0] = 10;
  expect(verifyAssetBytes(disk, original.hash, original)).toBe(false);
  const forged = { hash: original.hash, byteLength: 3, copy: () => disk };
  expect(verifyAssetBytes(disk, original.hash, forged)).toBe(false);
  expect(verifyAssetBytes(disk, hashImmutableBytes(disk), forged)).toBe(true);
});

it('checks the exact native view despite outside mutations or authored iteration', () => {
  const backing = new Uint8Array([0, 1, 2, 3, 0]), view = backing.subarray(1, 4), handle = immutableAsset(view);
  backing[0] = 9;
  expect(immutableAsset(view)).toBe(handle);
  backing[2] = 9;
  expect(immutableAsset(view)).not.toBe(handle);
  class AuthoredView extends Uint8Array {
    override *[Symbol.iterator](): ArrayIterator<number> { yield 8; yield 8; yield 8; }
  }
  const authored = new AuthoredView([1, 2, 3]);
  expect(immutableAsset(authored).copy()).toEqual(new Uint8Array([1, 2, 3]));
});

it('does not retain a mutable shared-memory identity', () => {
  const source = new Uint8Array(new SharedArrayBuffer(3));
  source.set([1, 2, 3]);
  const old = immutableAsset(source);
  source[0] = 7;
  expect(hashAssetBytes(source)).toBe(hashImmutableBytes(source));
  expect(hashAssetBytes(source)).not.toBe(old.hash);
  expect(old.copy()).toEqual(new Uint8Array([1, 2, 3]));
});

it('keeps explicit async producer ownership detached and propagates failures', async () => {
  const input = new Uint8Array([4, 5, 6]);
  const owned = await withAssetOwner(async () => {
    await Promise.resolve();
    return ownAssetBytes(input);
  });
  expect(owned.bytes).not.toBe(input);
  expect(owned.hash).toBe(hashImmutableBytes(input));
  input.fill(0);
  expect(owned.bytes).toEqual(new Uint8Array([4, 5, 6]));
  await expect(withAssetOwner(() => Promise.reject(new Error('author refused')))).rejects.toThrow('author refused');
  expect(ownAssetBytes(input).hash).toBe(hashImmutableBytes(input));
});

it('refuses other typed-array families at a JavaScript ownership boundary', () => {
  expect(() => { Reflect.apply(immutableAsset, undefined, [new Uint16Array([256])]); }).toThrow('Uint8Array');
  expect(() => { Reflect.apply(hashAssetBytes, undefined, [new Uint16Array(new SharedArrayBuffer(2))]); }).toThrow('Uint8Array');
});

import { expect } from 'vitest';
import { nineWorldProduct, nineLayoutWord } from '../../src/shards/nine-dragon-stack/generators/worldProduct';
import { prepareAssetDecoders } from '../../src/format/product';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import type { Shardfile } from '../../src/sdk/shardfile';
import { halfFloatBeforeControl } from './half-float-before-control';
import { nativeSignAtlas } from './nine-native-atlas';

await prepareAssetDecoders();
const changed = new Map<string, Uint8Array>();
/** Real cold predecessor construction: only Float16 axis reads reproduce the former storage-bit defect. */
export const beforeHalfWorld = await halfFloatBeforeControl(() => Promise.resolve(nineWorldProduct(nativeSignAtlas.atlas)), (before, current) => {
  const old = hashImmutableBytes(before);
  if (old !== hashImmutableBytes(current)) changed.set(old, current);
});
const reverse = new Map([...changed].map(([old, bytes]) => [hashImmutableBytes(bytes), old]));
const encode = (value: unknown): string => JSON.stringify(value, nineLayoutWord);
/** Only content references change; no arbitrary byte/hash is excluded from the oracle. */
function previousReferences<T>(value: T): T {
  return JSON.parse(encode(value).replace(/[a-f0-9]{64}/gu, hash => reverse.get(hash) ?? hash)) as T;
}
/** Native world files/library are explicitly hash-sorted by worldProduct. */
export function previousHalfWorldMetadata<T extends { shardfile: { files: { hash: string }[]; library: string[] } }>(metadata: T): T {
  const original = previousReferences(metadata);
  original.shardfile.files.sort((a, b) => a.hash.localeCompare(b.hash));
  original.shardfile.library.sort();
  return original;
}
/** Product declarations retain the same explicit sorted file/library collections. */
export function previousHalfDeclaration(product: Shardfile): Shardfile {
  const original = previousReferences(product);
  original.files.sort((a, b) => a.hash.localeCompare(b.hash));
  const size = beforeHalfWorld.metadata.shardfile.library.length;
  const prefix = original.library.slice(0, size).sort();
  expect(prefix).toEqual(beforeHalfWorld.metadata.shardfile.library);
  original.library.splice(0, size, ...prefix);
  original.props?.wholeLibrary?.sort();
  return original;
}
/** Every current asset must be the exact observed numeric-half writer result or an unchanged predecessor. */
export function expectHalfWorld(current: { readonly metadata: { shardfile: { files: { hash: string }[]; library: string[] } }; readonly layout: unknown; readonly assets: ReadonlyMap<string, Uint8Array> }): void {
  expect(current.assets.size).toBe(beforeHalfWorld.assets.size);
  for (const [old, bytes] of beforeHalfWorld.assets) {
    const expected = changed.get(old) ?? bytes, hash = hashImmutableBytes(expected), actual = current.assets.get(hash);
    if (actual === undefined) throw new Error(`Missing numeric-half world asset ${old} -> ${hash}`);
    expect(actual.byteLength, old).toBe(expected.byteLength);
    expect(hashImmutableBytes(actual), old).toBe(hash);
  }
  expect(encode(current.layout)).toBe(encode(beforeHalfWorld.layout));
  expect(encode(previousHalfWorldMetadata(current.metadata))).toBe(encode(beforeHalfWorld.metadata));
}

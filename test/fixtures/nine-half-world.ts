import { expect } from 'vitest';
import { nineWorldProduct, nineLayoutWord } from '../../src/shards/nine-dragon-stack/generators/worldProduct';
import { prepareAssetDecoders } from '../../src/format/product';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import type { Shardfile } from '../../src/sdk/shardfile';
import { halfFloatBeforeControl } from './half-float-before-control';
import { nativeSignAtlas } from './nine-native-atlas';
import { nineWorldProgram } from '../../src/shards/nine-dragon-stack/generators/worldProgram';

await prepareAssetDecoders();
const changed = new Map<string, Uint8Array>();
/** Real cold predecessor construction: only Float16 axis reads reproduce the former storage-bit defect. */
export const beforeHalfWorld = await halfFloatBeforeControl(() => Promise.resolve(nineWorldProduct(nativeSignAtlas.atlas)), (before, current) => {
  const old = hashImmutableBytes(before);
  if (old !== hashImmutableBytes(current)) changed.set(old, current);
});
/** Admit the real predecessor wires through unchanged publication/inventory/hash validation. */
export const beforeHalfSourceWorld = await nineWorldProgram({
  cached: () => Promise.resolve(new Map([
    ['world.json', new TextEncoder().encode(`${JSON.stringify(beforeHalfWorld.metadata, nineLayoutWord)}\n`)],
    ['layout.json', new TextEncoder().encode(JSON.stringify(beforeHalfWorld.layout, nineLayoutWord))],
    ...[...beforeHalfWorld.assets].map(([hash, bytes]) => [`blobs/${hash}`, bytes] as const),
  ])), asset: hashImmutableBytes,
}, nativeSignAtlas.atlas);
const encode = (value: unknown): string => JSON.stringify(value, nineLayoutWord);
/** NR2: the corrected kit merge keeps a kit's aFace / aPat half floats, so the layout bake labels them f16, not u16. */
export const halfKitLayout = (layout: string): string => layout.replace(/\["(aFace|aPat)","u16",/gu, '["$1","f16",');
const formerLayout = new TextEncoder().encode(encode(beforeHalfWorld.layout)), correctedLayout = new TextEncoder().encode(halfKitLayout(encode(beforeHalfWorld.layout)));
if (hashImmutableBytes(formerLayout) !== hashImmutableBytes(correctedLayout)) changed.set(hashImmutableBytes(formerLayout), correctedLayout);
const reverse = new Map([...changed].map(([old, bytes]) => [hashImmutableBytes(bytes), old]));
/** The same reference renaming on a wire's own text. */
export function previousHalfHashes(text: string): string { return text.replace(/[a-f0-9]{64}/gu, hash => reverse.get(hash) ?? hash); }
/** Only content references change; no arbitrary byte/hash is excluded from the oracle. */
export function previousHalfReferences<T>(value: T): T {
  return JSON.parse(encode(value).replace(/[a-f0-9]{64}/gu, hash => reverse.get(hash) ?? hash)) as T;
}
const SIZES = ['compressed', 'decoded', 'gpu'] as const;
const size = (row: object, key: string): number => { const value: unknown = Reflect.get(row, key); return typeof value === 'number' ? value : 0; };
const formerRows = new Map(beforeHalfWorld.metadata.shardfile.files.map(row => [row.hash, row]));
/** NR2: a corrected kit GLB names its half channel's storage (longer words), so its file row and the tiles holding it
 *  move by exactly that file's size difference; every other size stays as pinned. */
function previousSizes(files: readonly { hash: string }[], tiles: unknown, report?: unknown): ReadonlyMap<string, Record<string, number>> {
  const moved = new Map<string, Record<string, number>>();
  for (const row of files) {
    const former = changed.has(row.hash) ? formerRows.get(row.hash) : undefined; if (former === undefined) continue;
    const delta: Record<string, number> = {};
    for (const key of SIZES) if (Object.hasOwn(row, key)) { delta[key] = size(row, key) - size(former, key); Reflect.set(row, key, size(former, key)); }
    moved.set(row.hash, delta);
  }
  if (!Array.isArray(tiles)) return moved;
  const tileKey = (row: object): string => `${size(row, 'lod')}/${size(row, 'x')}/${size(row, 'z')}`, byTile = new Map<string, Record<string, number>>();
  for (const tile of tiles) {
    if (typeof tile !== 'object' || tile === null) continue;
    const held: unknown = Reflect.get(tile, 'files'), sum: Record<string, number> = {};
    if (Array.isArray(held)) for (const hash of held) { const delta = typeof hash === 'string' ? moved.get(hash) : undefined; if (delta !== undefined) for (const key of SIZES) sum[key] = (sum[key] ?? 0) + (delta[key] ?? 0); }
    for (const key of SIZES) if (Object.hasOwn(tile, key)) Reflect.set(tile, key, size(tile, key) - (sum[key] ?? 0));
    byTile.set(tileKey(tile), sum);
  }
  // the build report's per-tile resident (decoded + GPU) and compressed bytes, and the cap warnings that quote them
  if (Array.isArray(report)) for (const row of report) {
    if (typeof row !== 'object' || row === null) continue;
    const sum = byTile.get(tileKey(row)); if (sum === undefined) continue;
    const before = size(row, 'compressed'), after = before - (sum['compressed'] ?? 0);
    const held = size(row, 'resident'), resident = held - (sum['decoded'] ?? 0) - (sum['gpu'] ?? 0);
    Reflect.set(row, 'compressed', after); Reflect.set(row, 'resident', resident);
    const warnings: unknown = Reflect.get(row, 'warnings');
    if (Array.isArray(warnings)) Reflect.set(row, 'warnings', warnings.map(text => typeof text === 'string' ? text.replace(`compressed ${before} `, `compressed ${after} `).replace(`resident ${held} `, `resident ${resident} `) : text));
  }
  return moved;
}
/** Native world files/library are explicitly hash-sorted by worldProduct. */
export function previousHalfWorldMetadata<T extends { shardfile: { files: { hash: string }[]; library: string[] } }>(metadata: T): T {
  const original = previousHalfReferences(metadata);
  previousSizes(original.shardfile.files, Reflect.get(original.shardfile, 'tiles'), Reflect.get(original, 'report'));
  original.shardfile.files.sort((a, b) => a.hash.localeCompare(b.hash));
  original.shardfile.library.sort();
  return original;
}
/** Product declarations retain the same explicit sorted file/library collections. */
export function previousHalfDeclaration(product: Shardfile): Shardfile {
  const original = previousHalfReferences(product);
  const moved = previousSizes(original.files, original.tiles), library = original.budgets.library;
  // the library budget sums its files: compressed bytes, and resident decoded + GPU bytes
  for (const hash of original.library) {
    const delta = moved.get(hash); if (delta === undefined) continue;
    library.compressed -= delta['compressed'] ?? 0; library.resident -= (delta['decoded'] ?? 0) + (delta['gpu'] ?? 0);
  }
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
  expect(encode(current.layout)).toBe(halfKitLayout(encode(beforeHalfWorld.layout)));
  expect(encode(previousHalfWorldMetadata(current.metadata))).toBe(encode(beforeHalfWorld.metadata));
}

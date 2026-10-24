// oxlint-disable-next-line import/no-nodejs-modules -- Compile the actual authored guest source, without generated metadata.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import product, { nineProduct } from '../src/shards/nine-dragon-stack/generators/product';
import { nineOutput, output } from '../src/shards/nine-dragon-stack/generators/output';
import { nineOutput as emitNineOutput } from '../src/shards/nine-dragon-stack/generators/productOutput';

test('the product uses the supplied view memory while retaining every other declaration field', () => {
  expect(nineProduct({ pages: 1 })).toEqual(product);
  const larger = nineProduct({ pages: 2 });
  expect(larger.budgets.library.resident).toBe(product.budgets.library.resident + 131072);
  expect({ ...larger, budgets: product.budgets }).toEqual(product);
});

test('owned movers bytes replace only the file handoff and preserve all other emitted bytes and rows', async () => {
  const bytes = await compileScriptV2(readFileSync('src/shards/nine-dragon-stack/behaviour/movers.as', 'utf8'), { lane: 'view', ioBytes: 4096 });
  const hash = hashImmutableBytes(bytes);
  expect(hash).toBe('3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276');
  expect(bytes.byteLength).toBe(4859);
  const actual = nineOutput({ hash, bytes });
  const signature = (value: unknown): { bytes: number; hash: string } => {
    const source = new TextEncoder().encode(encodeCanonicalJson(value));
    return { bytes: source.byteLength, hash: hashImmutableBytes(source) };
  };
  const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values].filter(([key]) => key !== hash)
    .map(([key, value]) => [key, value.byteLength, hashImmutableBytes(value)]);
  expect(signature(product)).toEqual({ bytes: 734805, hash: 'c80c8026c7662c9bc3dff769ce6d5306d0cd5b573558128c6d02aa9ac94c0562' });
  expect(signature({ blobs: actual.blobs, namedFiles: actual.namedFiles.filter(row => row.name !== 'views/movers.wasm'),
    assets: physical(actual.assets), platform: { ...actual.platform, files: physical(actual.platform.files) } }))
    .toEqual({ bytes: 140949, hash: 'c8ac0b097ca25d1af5317693b4f1966a1122f1e1357eb0fd443aa92219d3d181' });
  // Supply distinct proof and decal rows directly, without a file-reader fallback.
  const supplied = emitNineOutput({ hash, bytes }, { entryProof: { lanes: 1, steps: 2, portalTransfers: 3 },
    heldDecals: { phone: { width: 1, height: 1, png: 'phone.png' }, desktop: { width: 2, height: 2, png: 'desktop.png' } } });
  expect(supplied.blobs.filter(row => row.name.startsWith('looks/jian-decal-')).map(row => row.source)).toEqual(['phone.png', 'desktop.png']);
  const constants = supplied.namedFiles.find(row => row.name === 'sim/headless-constants.json');
  const constantsBytes = constants === undefined ? undefined : supplied.assets.get(constants.hash);
  if (constantsBytes === undefined) throw new Error('Missing supplied headless constants');
  expect(JSON.parse(new TextDecoder().decode(constantsBytes))).toMatchObject({ entryProof: { lanes: 1, steps: 2, portalTransfers: 3 } });
  expect(actual.blobs).toEqual(output.blobs.filter(row => row.name !== 'views/movers.wasm'));
  expect(actual.namedFiles.filter(row => row.name !== 'views/movers.wasm')).toEqual(output.namedFiles);
  const mover = actual.namedFiles.find(row => row.name === 'views/movers.wasm');
  expect(mover).toMatchObject({ name: 'views/movers.wasm', hash, path: `blobs/wasm/${hash}.wasm`, compressed: 4859, critical: true });
  const owned = actual.assets.get(hash);
  if (owned === undefined) throw new Error('Missing owned movers bytes');
  expect(hashImmutableBytes(owned)).toBe(hash);
  const hashes = (assets: ReadonlyMap<string, Uint8Array>) => [...assets].filter(([key]) => key !== hash).map(([key, value]) => [key, hashImmutableBytes(value)]);
  expect(hashes(actual.assets)).toEqual(hashes(output.assets));
  expect(actual.platform).toEqual(output.platform);
  expect(() => nineOutput({ hash: '0'.repeat(64), bytes })).toThrow('bytes differ from module hash');
});

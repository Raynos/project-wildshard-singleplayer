// oxlint-disable-next-line import/no-nodejs-modules -- Compile the actual authored guest source, without generated metadata.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import product, { nineProduct, inputs } from './fixtures/nine-product-inputs';
import { output } from './fixtures/nine-source-program';
import nativeDecals from '../src/shards/nine-dragon-stack/data/nativeDecals.json' with { type: 'json' };
import before from './fixtures/nine-admitted-output.json' with { type: 'json' };
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { nineOutput as emitNineOutput } from '../src/shards/nine-dragon-stack/generators/productOutput';

test('the product uses the supplied view memory while retaining every other declaration field', () => {
  expect(nineProduct({ pages: 1 })).toEqual(product);
  const larger = nineProduct({ pages: 2 });
  expect(larger.budgets.library.resident).toBe(product.budgets.library.resident + 131072);
  expect({ ...larger, budgets: product.budgets }).toEqual(product);
});

test('source-owned files preserve the original complete output and executable byte oracles', async () => {
  const bytes = await compileScriptV2(readFileSync('src/shards/nine-dragon-stack/behaviour/movers.as', 'utf8'), { lane: 'view', ioBytes: 4096 });
  const hash = hashImmutableBytes(bytes);
  expect(hash).toBe('3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276');
  expect(bytes.byteLength).toBe(4859);
  const actual = output;
  const signature = (value: unknown): { bytes: number; hash: string } => {
    const source = new TextEncoder().encode(encodeCanonicalJson(value));
    return { bytes: source.byteLength, hash: hashImmutableBytes(source) };
  };
  const native = ['phone', 'desktop'] as const, nativeHashes = new Set(native.map(tier => nativeDecals[tier].hash));
  const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values].filter(([key]) => key !== hash && !nativeHashes.has(key))
    .map(([key, value]) => [key, value.byteLength, hashImmutableBytes(value)]);
  expect(signature(product)).toEqual({ bytes: 734805, hash: 'c80c8026c7662c9bc3dff769ce6d5306d0cd5b573558128c6d02aa9ac94c0562' });
  // Reconstruct only the two old source declarations for this unchanged raw-wire golden.
  // The effective admitted inventory is independently pinned for all 169 files.
  const oldDecalSources = native.map(tier => ({ name: `looks/jian-decal-${tier}.png`, kind: 'image', source: `assets/${nativeDecals[tier].hash}` }));
  expect(signature({ blobs: [...actual.blobs, ...oldDecalSources], namedFiles: actual.namedFiles.filter(row => row.name !== 'views/movers.wasm' && !nativeHashes.has(row.hash)),
    assets: physical(actual.assets), platform: { ...actual.platform, files: physical(actual.platform.files) } }))
    .toEqual({ bytes: 140949, hash: 'c8ac0b097ca25d1af5317693b4f1966a1122f1e1357eb0fd443aa92219d3d181' });
  // Supply distinct proof and decal rows directly, without a file-reader fallback.
  const burst = { name: 'fixture', shape: 'flake' as const, count: 1, life: .5 };
  const suppliedInputs = { held: inputs.held, construction: { seed: product.identity.seed, looks: Object.keys(product.look.materials) },
    scriptRevisions: SCRIPT_V2_REVISIONS, graphArmsSchema: { type: 'object' },
    bursts: { muzzle: burst, bite: burst, dock: burst, sparks: burst }, entryProof: { lanes: 1, steps: 2, portalTransfers: 3 },
    decals: { sources: { phone: { width: 1, height: 1, png: 'phone.png' }, desktop: { width: 2, height: 2, png: 'desktop.png' } } } };
  const supplied = emitNineOutput({ hash, bytes }, suppliedInputs);
  expect(supplied.blobs.filter(row => row.name.startsWith('looks/jian-decal-')).map(row => row.source)).toEqual(['phone.png', 'desktop.png']);
  const constants = supplied.namedFiles.find(row => row.name === 'sim/headless-constants.json');
  const constantsBytes = constants === undefined ? undefined : supplied.assets.get(constants.hash);
  if (constantsBytes === undefined) throw new Error('Missing supplied headless constants');
  expect(JSON.parse(new TextDecoder().decode(constantsBytes))).toMatchObject({ entryProof: { lanes: 1, steps: 2, portalTransfers: 3 } });
  const mover = actual.namedFiles.find(row => row.name === 'views/movers.wasm');
  expect(mover).toMatchObject({ name: 'views/movers.wasm', hash, path: `blobs/wasm/${hash}.wasm`, compressed: 4859, critical: true });
  const owned = actual.assets.get(hash);
  if (owned === undefined) throw new Error('Missing owned movers bytes');
  expect(hashImmutableBytes(owned)).toBe(hash);
  expect(actual.platform.sections).toEqual(before.platform.sections);
  expect([...actual.platform.files].map(([name, value]) => ({ name, bytes: value.length, hash: hashImmutableBytes(value) })).sort((a, b) => a.name.localeCompare(b.name)))
    .toEqual(before.platform.files);
  expect(() => emitNineOutput({ hash: '0'.repeat(64), bytes }, suppliedInputs)).toThrow('bytes differ from module hash');
});

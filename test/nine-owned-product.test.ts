import castBefore from './fixtures/nine-binary-outputs.json' with { type: 'json' };
import signBefore from './fixtures/nine-sign-source-files.json' with { type: 'json' };
import oldOwnedAssets from './fixtures/nine-raw-owned-assets.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- Compile the actual authored guest source, without generated metadata.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import product, { nineProduct, inputs } from './fixtures/nine-product-inputs';
import { output } from './fixtures/nine-source-program';
import nativeDecals from '../src/shards/nine-dragon-stack/data/nativeDecals.json' with { type: 'json' };
import before from './fixtures/nine-admitted-output.json' with { type: 'json' };
import worldFiles from './fixtures/nine-world-files.json' with { type: 'json' };
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
  const physical = (values: ReadonlyMap<string, Uint8Array>, oldOnly = false) => [...values].filter(([key]) => key !== hash && !nativeHashes.has(key) && (!oldOnly || oldOwnedAssets.includes(key)))
    .map(([key, value]) => [key, value.byteLength, hashImmutableBytes(value)]);
  // The declaration pinned at 734805 B / c80c8026 (ba4dab6764) moved twice. T8 (82ac81812d, e389eb998e, b1f6916531)
  // added the 16 L1 rows and the 12 coarse files only they draw, none in the library: without them it is 735799 B.
  // The rest is I3's regridded world (978526b2f7): every file row but 17 is a world file the independently
  // regenerated world fixture pins (f1af1023d3), and those 17 are pinned here by hash.
  const fine = new Set(product.tiles.filter(tile => tile.lod === 0).flatMap(tile => tile.files));
  const coarse = new Set(product.tiles.filter(tile => tile.lod === 1).flatMap(tile => tile.files).filter(file => !fine.has(file)));
  expect(coarse.size).toBe(12); expect(product.library.filter(file => coarse.has(file))).toEqual([]);
  expect(product.tiles.filter(tile => tile.lod !== 0 && tile.lod !== 1)).toEqual([]);
  expect(signature({ ...product, tiles: product.tiles.filter(tile => tile.lod === 0), files: product.files.filter(file => !coarse.has(file.hash)) }))
    .toEqual({ bytes: 735799, hash: '94903d85d60a7469ce118b23f7ae9d28d7a0b0e76d2094c6a209eba11a5985f2' });
  const world = new Set(worldFiles.map(row => row.hash));
  expect(signature(product.files.filter(file => !world.has(file.hash)).map(file => file.hash).sort()))
    .toEqual({ bytes: 1141, hash: '1ab081469b9ba1a809ea889eadf95e01f6dc9c617e66a71e5c70c6605aa52e6d' });
  expect(signature(product)).toEqual({ bytes: 741684, hash: '62ed0264485e75570c798d7b6cc85c137ffa092c8161a5838a6e8081e1f3731c' });
  // Reconstruct only the two old source declarations for this unchanged raw-wire golden.
  // The effective inventory pins all 212 files, including portal and card
  // channels whose complete original words have separate byte oracles.
  const legacyCasts = castBefore.castFiles.filter(row => row.kind === 'glb').map(row => ({ name: row.name, kind: 'glb',
    source: row.name === 'geometry/dragon-hook.glb' ? 'data/castHook.generated.glb' : `data/cast-${row.name.split('/').at(-1)?.replace('.glb', '')}.generated.glb` }));
  const castHashes = new Set(castBefore.castFiles.filter(row => row.kind === 'glb').map(row => row.hash));
  const castNames = new Set(castBefore.castFiles.filter(row => row.kind === 'glb').map(row => row.name));
  const signHashes = new Set(signBefore.admitted.map(row => row.hash));
  const legacySigns = signBefore.admitted.map(({ name, kind, decoded, gpu, triangles, draws, critical, dependencies }, index) => ({ name, kind, source: `data/signSource-${index}.generated.${kind}`, options: { decoded, gpu, triangles, draws, critical, dependencies } }));
  const oldDecalSources = native.map(tier => ({ name: `looks/jian-decal-${tier}.png`, kind: 'image', source: `assets/${nativeDecals[tier].hash}` }));
  const legacyPractice = { name: 'behaviour/practice.wasm', kind: 'wasm', source: 'behaviour/practice.generated.wasm',
    options: { critical: true, script: { abi: 1, pages: inputs.courseProgram.script.pages } } };
  expect(signature({ blobs: [legacyPractice, ...actual.blobs, ...legacyCasts, ...legacySigns, ...oldDecalSources], namedFiles: actual.namedFiles.filter(row => row.name !== 'views/movers.wasm' && row.name !== 'behaviour/practice.wasm' && !nativeHashes.has(row.hash) && !castHashes.has(row.hash) && !castNames.has(row.name) && !signHashes.has(row.hash)),
    assets: physical(actual.assets, true), platform: { ...actual.platform, files: physical(actual.platform.files) } }))
    .toEqual({ bytes: 159100, hash: 'df0e53e56eaa60cb3754080c41df6e7295d388fa064280c0371a8402ba69bb1e' });
  // Supply distinct proof and decal rows directly, without a file-reader fallback.
  const burst = { name: 'fixture', shape: 'flake' as const, count: 1, life: .5 };
  const suppliedInputs = { courseProgram: inputs.courseProgram, casts: inputs.casts, signs: inputs.signs, ownedWorld: inputs.ownedWorld, scenes: inputs.scenes, held: inputs.held, construction: { seed: product.identity.seed, looks: Object.keys(product.look.materials) },
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

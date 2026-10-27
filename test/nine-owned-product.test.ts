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
import { expectNineDeclaration } from './fixtures/nine-declaration-pins';
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
  expectNineDeclaration(product);
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
  // The golden is 9ca33409dc's (exactly reconstructed from its receipt). Since then the casts were re-encoded (39de31c1ec,
  // c877add154: excluded by name as well as hash) and I3 regridded the world (978526b2f7): geometry/layout.json and the
  // world/scenes section that names its files are projected back to their 9ca rows. Emitted asset tuples stay sorted by
  // hash and the held graph files keep their appended order, as the raw builder emits them.
  const OLD_LAYOUT = { hash: '2aba846bf08168efa0ab422ad2b938b021e37afc9e9cef56ed6400d4da64b0c1', bytes: 991195 };
  const OLD_SCENES = 'e009a97a13e27fba8590b65f1fa5533db605a184861106e22433f5f219a3ba8b';
  const named = actual.namedFiles.filter(row => row.name !== 'views/movers.wasm' && row.name !== 'behaviour/practice.wasm' && !nativeHashes.has(row.hash) && !castHashes.has(row.hash) && !(row.name !== undefined && castNames.has(row.name)) && !signHashes.has(row.hash));
  const layout = named.find(row => row.name === 'geometry/layout.json'); if (layout === undefined) throw new Error('Missing world layout row');
  const held = new Set(inputs.held.files.assets.keys()), oldOwned = physical(actual.assets, true);
  const projectedAssets = [...[...oldOwned.filter(row => !held.has(String(row[0]))), [OLD_LAYOUT.hash, OLD_LAYOUT.bytes, OLD_LAYOUT.hash]]
    .sort((a, b) => String(a[0]) < String(b[0]) ? -1 : 1), ...oldOwned.filter(row => held.has(String(row[0])))];
  expect(physical(actual.assets).some(row => row[0] === layout.hash)).toBe(true); expect(oldOwned.some(row => row[0] === OLD_LAYOUT.hash)).toBe(false);
  const oldLayout = { ...layout, hash: OLD_LAYOUT.hash, path: `blobs/json/${OLD_LAYOUT.hash}.json`, compressed: OLD_LAYOUT.bytes, decoded: OLD_LAYOUT.bytes };
  const scenes = actual.platform.sections.find(row => row.name === 'world/scenes'); if (scenes === undefined) throw new Error('Missing world scenes section');
  const oldScenes = { ...scenes, hash: OLD_SCENES };
  expect(signature({ blobs: [legacyPractice, ...actual.blobs, ...legacyCasts, ...legacySigns, ...oldDecalSources],
    namedFiles: named.map(row => row === layout ? oldLayout : row),
    assets: projectedAssets, platform: { ...actual.platform, sections: actual.platform.sections.map(row => row === scenes ? oldScenes : row),
      files: physical(actual.platform.files).map(row => row[0] === 'sections/world/scenes.json' ? [row[0], row[1], OLD_SCENES] : row) } }))
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

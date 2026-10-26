// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated cache and retain the original complete GLB oracle.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the real author folder and declared native input root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete byte arrays without expanding assertion objects.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import * as v from 'valibot';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { prepareProjectOutput } from '../src/sdk/projectOutput';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { sceneBakeFiles } from '../src/game/shardfile/sceneBakeFiles';
import type { SceneBakeSource } from '../src/game/shardfile/sceneSources';
import { BAKED_PIECES, BAKED_URLS, FAN_URL, FAN_POOL, SKY_CREATURES, SKY_CREATURE_RIGS } from '../src/shards/far-reach/generators/fileInventory';
import { nameBlob } from '../src/sdk/blobs';
import { BRIDGE_REST_URL, MILL_REST_URL } from '../src/shards/far-reach/generators/restFiles';
import { sceneRigFiles } from '../src/game/shardfile/sceneRigFiles';
import { skyProductRows } from '../src/shards/far-reach/generators/product';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { output, prepareOutput } from '../src/shards/far-reach/generators/sourceOutput';
import { emptyShardfile } from '../src/sdk/author';
import { projectAssets } from '../src/sdk/project';
import { SWARD_ATLAS_FILE, SWARD_ATLAS_SAMPLER } from '../src/shards/far-reach/generators/rows/swardAtlas';

const geometryName = 'world/geometry/prepared-models.glb', heroName = 'world/sources/heroes.json', bakeName = 'world/sources/bakes.json', skyName = 'world/sources/sky.json', bridgeName = 'world/geometry/bridge-rest.glb';
const hash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
const bridgeHash = '1a31cb2c7b426d9ffb14db4e39792aeb0bde86f6f01d0b1796130a3a0c7d8bf0';
const bridgeFile = { name: bridgeName, path: `blobs/glb/${bridgeHash}.glb`, kind: 'glb', hash: bridgeHash,
  compressed: 2_109_968, decoded: 2_109_940, gpu: 2_031_804, triangles: 35_709, draws: 126, dependencies: [], critical: false };
const millName = 'world/geometry/mill-rest.glb', millHash = '3b12beff5b5ae8fbb51433b27890591e85bdc9049dd999e19cc4700400603b37';
const mill = { file: { name: millName, path: `blobs/glb/${millHash}.glb`, kind: 'glb', hash: millHash,
  compressed: 1_828_044, decoded: 1_828_016, gpu: 1_825_056, triangles: 20_000, draws: 4, dependencies: [], critical: false } };
const fanName = 'world/geometry/fan.glb', fanHash = '5f5a9a056455af528c872807359347ee60007990dc6854e36f54f2e8db5b86d1';
const fanFile = { name: fanName, path: `blobs/glb/${fanHash}.glb`, kind: 'glb', hash: fanHash,
  compressed: 683_792, decoded: 683_764, gpu: 666_216, triangles: 15_136, draws: 28, dependencies: [], critical: false };
const original = readFileSync('public/assets/far-reach/baked/prepared-models.glb'), text = new TextDecoder();
const HeroRows = v.object({ rows: v.object({ meshes: v.array(v.string()), meshUrls: v.record(v.string(), v.string()),
  hd: v.array(v.string()), hdUrls: v.record(v.string(), v.string()), hdLooks: v.record(v.string(), v.never()), aoFloor: v.number(),
  geometryPools: v.array(v.object({ url: v.string(), parts: v.array(v.string()) })) }) });

test('owned geometry preserves all original bytes and costs, changing only its source addresses', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-prepared-output-'));
  let builds = 0;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) =>
      ctx.cached(step, inputs => { builds++; return generate(inputs); }) };
  };
  try {
    const owned = await prepareOutput(context()), geometry = owned.namedFiles.find(file => file.name === geometryName);
    if (geometry === undefined) throw new Error('Missing owned prepared geometry');
    expect(geometry).toEqual({ name: geometryName, path: `blobs/glb/${hash}.glb`, kind: 'glb', hash,
      compressed: 10_134_100, decoded: 10_134_072, gpu: 10_096_780, triangles: 203_025, draws: 48, critical: false, dependencies: [] });
    const bytes = owned.assets.get(hash); if (bytes === undefined) throw new Error('Missing owned GLB bytes');
    expect(Buffer.compare(bytes, original)).toBe(0);
    expect(owned.namedFiles).toHaveLength(output.namedFiles.length + 19);
    for (const file of output.namedFiles) {
      if (file.name === heroName || file.name === bakeName || file.name === skyName) continue;
      expect(owned.namedFiles.find(row => row.name === file.name)).toEqual(file);
      expect(owned.assets.get(file.hash)).toEqual(output.assets.get(file.hash));
    }
    expect(owned.platform).toBe(output.platform); expect(owned.blobs).toBe(output.blobs);
    const oldSky = output.namedFiles.find(file => file.name === skyName), newSky = owned.namedFiles.find(file => file.name === skyName);
    if (oldSky === undefined || newSky === undefined) throw new Error('Missing native library descriptor');
    let expectedSky = text.decode(output.assets.get(oldSky.hash))
      .replace(JSON.stringify(BRIDGE_REST_URL), JSON.stringify(bridgeName))
      .replace(JSON.stringify(MILL_REST_URL), JSON.stringify(millName))
      .replace(JSON.stringify(FAN_URL), JSON.stringify(fanName));
    for (const creature of SKY_CREATURES) expectedSky = expectedSky.replace(JSON.stringify(SKY_CREATURE_RIGS[creature]), JSON.stringify(`world/rigs/${creature}.glb`));
    expect(text.decode(owned.assets.get(newSky.hash))).toBe(expectedSky);
    for (const [name, path] of [...SKY_CREATURES.map(creature => [creature, `public/assets/far-reach/rigs/${creature}.glb`]),
      ['storm-roc.phone', 'public/assets/gpu/far-reach/rigs/storm-roc-70e5655f.glb']]) {
      if (name === undefined || path === undefined) throw new Error('Missing original rig oracle');
      const originalRig = readFileSync(path), declared = nameBlob(`world/rigs/${name}.glb`, 'glb', originalRig);
      expect(owned.namedFiles.find(file => file.name === declared.file.name)).toEqual(declared.file);
      const rigBytes = owned.assets.get(declared.file.hash);
      if (rigBytes === undefined) throw new Error('Missing published rig bytes');
      expect(Buffer.compare(rigBytes, originalRig)).toBe(0);
    }
    expect(owned.assets.has(oldSky.hash)).toBe(false);
    const bridge = { file: bridgeFile };
    expect(owned.namedFiles.find(file => file.name === bridgeName)).toEqual(bridge.file);
    const bridgeBytes = owned.assets.get(bridge.file.hash);
    if (bridgeBytes === undefined) throw new Error('Missing owned bridge geometry');
    expect(hashImmutableBytes(bridgeBytes)).toBe(bridgeHash); bridgeBytes.fill(0);

    expect(mill.file.hash).toBe(millHash);
    expect(owned.namedFiles.find(file => file.name === millName)).toEqual(mill.file);
    const millBytes = owned.assets.get(millHash);
    if (millBytes === undefined) throw new Error('Missing owned mill geometry');
    expect(hashImmutableBytes(millBytes)).toBe(millHash); millBytes.fill(0);

    expect(owned.namedFiles.find(file => file.name === fanName)).toEqual(fanFile);
    const fanBytes = owned.assets.get(fanHash);
    if (fanBytes === undefined) throw new Error('Missing owned fan pool');
    expect(hashImmutableBytes(fanBytes)).toBe(fanHash);
    fanBytes.fill(0);

    const atlas = owned.assets.get(SWARD_ATLAS_FILE.hash);
    if (atlas === undefined) throw new Error('Missing owned sward atlas');
    expect(hashImmutableBytes(atlas)).toBe(SWARD_ATLAS_FILE.hash); atlas.fill(0);

    const before = output.namedFiles.find(file => file.name === heroName), after = owned.namedFiles.find(file => file.name === heroName);
    if (before === undefined || after === undefined) throw new Error('Missing original or owned hero library');
    const beforeBytes = output.assets.get(before.hash), afterBytes = owned.assets.get(after.hash);
    if (beforeBytes === undefined || afterBytes === undefined) throw new Error('Missing complete hero descriptors');
    const baseline = text.decode(beforeBytes);
    expect(text.decode(afterBytes)).toBe(baseline.replace('"/assets/far-reach/baked/prepared-models.glb"', JSON.stringify(geometryName)));
    expect(owned.assets.has(before.hash)).toBe(false);
    expect(SKY_WORLD_TILE_ROWS.files).toHaveLength(22);
    for (const file of SKY_WORLD_TILE_ROWS.files) {
      const tile = owned.assets.get(file.hash);
      if (tile === undefined) throw new Error('Missing owned island tile');
      expect(Buffer.compare(tile, readFileSync(`src/shards/far-reach/assets/${file.hash}`))).toBe(0);
      tile.fill(0);
    }
    const oldBakes = output.namedFiles.find(file => file.name === bakeName), newBakes = owned.namedFiles.find(file => file.name === bakeName);
    if (oldBakes === undefined || newBakes === undefined) throw new Error('Missing original or owned bake descriptor');
    let expectedBakes = text.decode(output.assets.get(oldBakes.hash));
    for (const piece of BAKED_PIECES) expectedBakes = expectedBakes.replace(JSON.stringify(BAKED_URLS[piece]), JSON.stringify(`world/geometry/pieces/${piece}.glb`));
    expect(text.decode(owned.assets.get(newBakes.hash))).toBe(expectedBakes);
    expect(owned.assets.has(oldBakes.hash)).toBe(false);
    for (const piece of BAKED_PIECES) {
      const name = `world/geometry/pieces/${piece}.glb`, originalPiece = readFileSync(`public/assets/far-reach/baked/${piece}.glb`);
      const expected = nameBlob(name, 'glb', originalPiece), file = owned.namedFiles.find(row => row.name === name);
      expect(file).toEqual(expected.file);
      const pieceBytes = owned.assets.get(expected.file.hash);
      if (pieceBytes === undefined) throw new Error('Missing owned world piece');
      expect(Buffer.compare(pieceBytes, originalPiece)).toBe(0); pieceBytes.fill(0);
    }
    // Returned geometry cannot poison a later source-cache hit or the baseline output.
    bytes.fill(0);
    const hit = await prepareOutput(context()), hitBytes = hit.assets.get(hash);
    if (hitBytes === undefined) throw new Error('Missing cache-hit GLB');
    expect(Buffer.compare(hitBytes, original)).toBe(0); expect(builds).toBe(9);
    for (const file of SKY_WORLD_TILE_ROWS.files) {
      const tile = hit.assets.get(file.hash);
      if (tile === undefined) throw new Error('Missing cache-hit island tile');
      expect(Buffer.compare(tile, readFileSync(`src/shards/far-reach/assets/${file.hash}`))).toBe(0);
    }
    for (const piece of BAKED_PIECES) {
      const originalPiece = readFileSync(`public/assets/far-reach/baked/${piece}.glb`);
      const pieceBytes = hit.assets.get(hashImmutableBytes(originalPiece));
      if (pieceBytes === undefined) throw new Error('Missing cache-hit world piece');
      expect(Buffer.compare(pieceBytes, originalPiece)).toBe(0);
    }
    expect(text.decode(output.assets.get(before.hash))).toBe(baseline);
    const hitBridge = hit.assets.get(bridge.file.hash);
    if (hitBridge === undefined) throw new Error('Missing cache-hit bridge geometry');
    expect(hashImmutableBytes(hitBridge)).toBe(bridgeHash);
    const hitMill = hit.assets.get(millHash);
    if (hitMill === undefined) throw new Error('Missing cache-hit mill geometry');
    expect(hashImmutableBytes(hitMill)).toBe(millHash);
    const hitFan = hit.assets.get(fanHash);
    if (hitFan === undefined) throw new Error('Missing cache-hit fan pool');
    expect(hashImmutableBytes(hitFan)).toBe(fanHash);
    const hitAtlas = hit.assets.get(SWARD_ATLAS_FILE.hash);
    if (hitAtlas === undefined) throw new Error('Missing cache-hit sward atlas');
    expect(hashImmutableBytes(hitAtlas)).toBe(SWARD_ATLAS_FILE.hash);

  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('normal output admission and the actual native pool resolver consume the owned name', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-prepared-admission-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'd'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const owned = await prepareOutput(ctx), prepared = await prepareProjectOutput(resolve('src/shards/far-reach'), owned);
    const geometry = prepared.blobs.find(row => row.file.name === geometryName);
    if (geometry === undefined) throw new Error('Normal admission lost prepared geometry');
    expect(hashImmutableBytes(geometry.bytes)).toBe(hash);
    const product = createShardProduct({ slug: 'far-reach', revision: 1, shardfile: skyProductRows(), sections: new Map(),
      files: new Map(prepared.blobs.flatMap(row => row.file.name === undefined ? []
        : [[row.file.name, { hash: row.file.hash, url: `/shardfiles/far-reach/${row.file.path}` }]])),
      read: key => {
        const bytes = prepared.assets.get(key);
        if (bytes === undefined) throw new Error('Missing admitted product file');
        return Promise.resolve(bytes);
      } });
    const hero = v.parse(HeroRows, await product.json(heroName)), resolved = sceneRigFiles(hero.rows, product);
    expect(resolved.geometryPools?.[0]?.url).toBe(`/shardfiles/far-reach/blobs/glb/${hash}.glb`);
    expect(hero.rows.geometryPools[0]?.url).toBe(geometryName);
    expect(Buffer.compare(await product.file(geometryName), original)).toBe(0);
    const sky = v.parse(HeroRows, await product.json(skyName)), native = sceneRigFiles(sky.rows, product);
    const bridge = { file: bridgeFile };
    const poolIndex = sky.rows.geometryPools.findIndex(pool => pool.url === bridgeName);
    expect(poolIndex).toBeGreaterThanOrEqual(0);
    expect(native.geometryPools?.[poolIndex]?.url).toBe(`/shardfiles/far-reach/${bridge.file.path}`);
    expect(hashImmutableBytes(await product.file(bridgeName))).toBe(bridgeHash);

    const millPool = sky.rows.geometryPools.findIndex(pool => pool.url === millName);
    expect(millPool).toBeGreaterThanOrEqual(0);
    expect(native.geometryPools?.[millPool]?.url).toBe(`/shardfiles/far-reach/${mill.file.path}`);
    expect(hashImmutableBytes(await product.file(millName))).toBe(millHash);

    const fanPool = sky.rows.geometryPools.findIndex(pool => pool.url === fanName);
    expect(fanPool).toBeGreaterThanOrEqual(0);
    expect(sky.rows.geometryPools[fanPool]?.parts).toEqual(FAN_POOL.parts);
    expect(native.geometryPools?.[fanPool]?.url).toBe(`/shardfiles/far-reach/${fanFile.path}`);
    expect(native.geometryPools?.[fanPool]?.parts).toEqual(FAN_POOL.parts);
    expect(hashImmutableBytes(await product.file(fanName))).toBe(fanHash);

    const bakes = await product.json<SceneBakeSource>(bakeName), bakeFiles = sceneBakeFiles(bakes, product);
    expect(Object.keys(bakes.urls)).toEqual([...BAKED_PIECES]);
    for (const piece of BAKED_PIECES) {
      const name = `world/geometry/pieces/${piece}.glb`, file = prepared.blobs.find(row => row.file.name === name);
      if (file === undefined) throw new Error('Missing admitted world piece');
      expect(bakes.urls[piece]).toBe(name);
      expect(bakeFiles.urls[piece]).toBe(`/shardfiles/far-reach/${file.file.path}`);
      expect(Buffer.compare(await product.file(name), readFileSync(`public/assets/far-reach/baked/${piece}.glb`))).toBe(0);
    }
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the active output preparation bundles without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/sourceOutput.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing owned output bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

test('the original atlas admits from owned output in an empty project with unchanged sampling and costs', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-atlas-admission-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'f'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const owned = await prepareOutput(ctx), bytes = owned.assets.get(SWARD_ATLAS_FILE.hash);
    if (bytes === undefined) throw new Error('Missing owned sward atlas');
    expect(hashImmutableBytes(bytes)).toBe('607c53f28dbdd88423b39fd32419ba735f9a13c3c1ecabaf1cadb68715d63f0b');
    const prepared = await prepareProjectOutput(resolve('src/shards/far-reach'), owned);
    const base = emptyShardfile({ slug: 'atlas-publication', name: 'Atlas', author: 'Fixture', revision: 1, seed: 6417 });
    const shard = { ...base, files: [{ ...SWARD_ATLAS_FILE, dependencies: [] }], library: [SWARD_ATLAS_FILE.hash],
      budgets: { ...base.budgets, library: { compressed: 663_989, resident: 2_359_296 } } };
    const empty = mkdtempSync(resolve(cache, 'project-'));
    const admitted = projectAssets(empty, shard, 'project', prepared.assets);
    expect(readdirSync(empty)).toEqual([]);
    expect([...admitted.keys()]).toEqual([SWARD_ATLAS_FILE.hash]);
    expect(hashImmutableBytes(admitted.get(SWARD_ATLAS_FILE.hash) ?? new Uint8Array())).toBe(SWARD_ATLAS_FILE.hash);
    const declaration = skyProductRows();
    expect(declaration.files.find(file => file.hash === SWARD_ATLAS_FILE.hash)).toEqual(SWARD_ATLAS_FILE);
    const samplers = declaration.look.samplers;
    if (samplers === undefined) throw new Error('Missing original sampler declarations');
    expect(samplers[SWARD_ATLAS_FILE.hash]).toEqual({ filter: 'linear', mips: 'gpu', anisotropy: 4 });
    expect(SWARD_ATLAS_SAMPLER).toEqual(samplers[SWARD_ATLAS_FILE.hash]);
    const missing = new Map(prepared.assets); missing.delete(SWARD_ATLAS_FILE.hash);
    expect(() => projectAssets(empty, shard, 'project', missing)).toThrow('ENOENT');
    const short = new Map(prepared.assets); short.set(SWARD_ATLAS_FILE.hash, new Uint8Array());
    expect(() => projectAssets(empty, shard, 'project', short)).toThrow('Project asset differs from its declared wire size');
    const corrupt = new Map(owned.assets); corrupt.set(SWARD_ATLAS_FILE.hash, new Uint8Array(bytes.byteLength));
    await expect(prepareProjectOutput(resolve('src/shards/far-reach'), { ...owned, assets: corrupt }))
      .rejects.toThrow('Authored output asset hash differs from its bytes');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});


test('output preparation refuses incomplete cached tiles despite physical writer files', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-tile-output-refusal-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const files = skyWorldTileSource(), first = SKY_WORLD_TILE_ROWS.files[0];
    if (first === undefined) throw new Error('Missing original tile declaration');
    files.delete(`assets/${first.hash}`);
    // A self-consistent smaller cache bank still cannot satisfy the original declaration.
    const metadata = files.get('data/props.json');
    if (metadata === undefined) throw new Error('Missing original tile metadata');
    const schema = v.object({ files: v.array(v.object({ hash: v.string() })) });
    const rows = v.parse(schema, JSON.parse(text.decode(metadata)));
    files.set('data/props.json', new TextEncoder().encode(JSON.stringify({ files: rows.files.filter(file => file.hash !== first.hash)
      .map(file => ({ hash: file.hash, compressed: files.get(`assets/${file.hash}`)?.byteLength })) })));
    await expect(prepareOutput({ ...ctx, cached: (step, generate) => step.id === 'world-tiles'
      ? Promise.resolve(files) : ctx.cached(step, generate) })).rejects.toThrow('Sky world tile publication inventory differs');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

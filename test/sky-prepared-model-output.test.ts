import { originalSkyMovers } from './fixtures/sky-movers';
import { originalSkyNavigation } from './fixtures/sky-navigation';
// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated cache scopes for mutation and admission controls.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the real author folder and declared native input root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare detached byte buffers without constructing multi-megabyte assertion diffs.
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
import { BAKED_PIECES, FAN_POOL } from '../src/shards/far-reach/generators/fileInventory';
import { sceneRigFiles } from '../src/game/shardfile/sceneRigFiles';
import { skyProductRows } from '../src/shards/far-reach/generators/product';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { prepareOutput } from '../src/shards/far-reach/generators/sourceOutput';
import { emptyShardfile } from '../src/sdk/author';
import { projectAssets } from '../src/sdk/project';
import { SWARD_ATLAS_FILE, SWARD_ATLAS_SAMPLER } from '../src/shards/far-reach/generators/rows/swardAtlas';

const geometryName = 'world/geometry/prepared-models.glb', heroName = 'world/sources/heroes.json', bakeName = 'world/sources/bakes.json', skyName = 'world/sources/sky.json';
const bridgeName = 'world/geometry/bridge-rest.glb', millName = 'world/geometry/mill-rest.glb', fanName = 'world/geometry/fan.glb';
const text = new TextDecoder();
const HeroRows = v.object({ rows: v.object({ meshes: v.array(v.string()), meshUrls: v.record(v.string(), v.string()),
  hd: v.array(v.string()), hdUrls: v.record(v.string(), v.string()), hdLooks: v.record(v.string(), v.never()), aoFloor: v.number(),
  geometryPools: v.array(v.object({ url: v.string(), parts: v.array(v.string()) })) }) });

test('caller mutations cannot poison cached output or its named inventory', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-prepared-output-'));
  let builds = 0;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], generate: Parameters<typeof ctx.cached>[1]) =>
      ctx.cached(step, inputs => { builds++; return generate(inputs); }) };
  };
  try {
    const owned = await prepareOutput(context());
    const inventory = structuredClone(owned.namedFiles);
    const before = new Map([...owned.assets].map(([hash, bytes]) => [hash, bytes.slice()]));
    for (const bytes of owned.assets.values()) bytes.fill(0);
    const completedBuilds = builds;
    const hit = await prepareOutput(context());
    expect(builds).toBe(completedBuilds);
    expect(hit.namedFiles).toEqual(inventory);
    for (const [hash, bytes] of before) {
      const restored = hit.assets.get(hash);
      if (restored === undefined) throw new Error('Missing cache-hit bytes');
      expect(restored).not.toBe(owned.assets.get(hash));
      expect(Buffer.compare(restored, bytes)).toBe(0);
    }
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
    expect(hashImmutableBytes(geometry.bytes)).toBe(geometry.file.hash);
    const product = createShardProduct({ slug: 'far-reach', revision: 1, shardfile: skyProductRows(originalSkyNavigation(), originalSkyMovers()), sections: new Map(),
      files: new Map(prepared.blobs.flatMap(row => row.file.name === undefined ? []
        : [[row.file.name, { hash: row.file.hash, url: `/shardfiles/far-reach/${row.file.path}` }]])),
      read: key => {
        const bytes = prepared.assets.get(key);
        if (bytes === undefined) throw new Error('Missing admitted product file');
        return Promise.resolve(bytes);
      } });
    const hero = v.parse(HeroRows, await product.json(heroName)), resolved = sceneRigFiles(hero.rows, product);
    expect(resolved.geometryPools?.[0]?.url).toBe(`/shardfiles/far-reach/${geometry.file.path}`);
    expect(hero.rows.geometryPools[0]?.url).toBe(geometryName);
    expect(Buffer.compare(await product.file(geometryName), geometry.bytes)).toBe(0);
    const sky = v.parse(HeroRows, await product.json(skyName)), native = sceneRigFiles(sky.rows, product);
    const bridge = prepared.blobs.find(row => row.file.name === bridgeName);
    const mill = prepared.blobs.find(row => row.file.name === millName);
    const fan = prepared.blobs.find(row => row.file.name === fanName);
    if (bridge === undefined || mill === undefined || fan === undefined) throw new Error('Missing admitted named pools');
    const poolIndex = sky.rows.geometryPools.findIndex(pool => pool.url === bridgeName);
    expect(poolIndex).toBeGreaterThanOrEqual(0);
    expect(native.geometryPools?.[poolIndex]?.url).toBe(`/shardfiles/far-reach/${bridge.file.path}`);
    expect(Buffer.compare(await product.file(bridgeName), bridge.bytes)).toBe(0);

    const millPool = sky.rows.geometryPools.findIndex(pool => pool.url === millName);
    expect(millPool).toBeGreaterThanOrEqual(0);
    expect(native.geometryPools?.[millPool]?.url).toBe(`/shardfiles/far-reach/${mill.file.path}`);
    expect(Buffer.compare(await product.file(millName), mill.bytes)).toBe(0);

    const fanPool = sky.rows.geometryPools.findIndex(pool => pool.url === fanName);
    expect(fanPool).toBeGreaterThanOrEqual(0);
    expect(sky.rows.geometryPools[fanPool]?.parts).toEqual(FAN_POOL.parts);
    expect(native.geometryPools?.[fanPool]?.url).toBe(`/shardfiles/far-reach/${fan.file.path}`);
    expect(native.geometryPools?.[fanPool]?.parts).toEqual(FAN_POOL.parts);
    expect(Buffer.compare(await product.file(fanName), fan.bytes)).toBe(0);

    const bakes = await product.json<SceneBakeSource>(bakeName), bakeFiles = sceneBakeFiles(bakes, product);
    expect(Object.keys(bakes.urls)).toEqual([...BAKED_PIECES]);
    for (const piece of BAKED_PIECES) {
      const name = `world/geometry/pieces/${piece}.glb`, file = prepared.blobs.find(row => row.file.name === name);
      if (file === undefined) throw new Error('Missing admitted world piece');
      expect(bakes.urls[piece]).toBe(name);
      expect(bakeFiles.urls[piece]).toBe(`/shardfiles/far-reach/${file.file.path}`);
      expect(Buffer.compare(await product.file(name), file.bytes)).toBe(0);
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
    const prepared = await prepareProjectOutput(resolve('src/shards/far-reach'), owned);
    const base = emptyShardfile({ slug: 'atlas-publication', name: 'Atlas', author: 'Fixture', revision: 1, seed: 6417 });
    const shard = { ...base, files: [{ ...SWARD_ATLAS_FILE, dependencies: [] }], library: [SWARD_ATLAS_FILE.hash],
      budgets: { ...base.budgets, library: { compressed: SWARD_ATLAS_FILE.compressed, resident: SWARD_ATLAS_FILE.decoded + SWARD_ATLAS_FILE.gpu } } };
    const empty = mkdtempSync(resolve(cache, 'project-'));
    const admitted = projectAssets(empty, shard, 'project', prepared.assets);
    expect(readdirSync(empty)).toEqual([]);
    expect([...admitted.keys()]).toEqual([SWARD_ATLAS_FILE.hash]);
    expect(hashImmutableBytes(admitted.get(SWARD_ATLAS_FILE.hash) ?? new Uint8Array())).toBe(SWARD_ATLAS_FILE.hash);
    const declaration = skyProductRows(originalSkyNavigation(), originalSkyMovers());
    expect(declaration.files.find(file => file.hash === SWARD_ATLAS_FILE.hash)).toEqual(SWARD_ATLAS_FILE);
    const samplers = declaration.look.samplers;
    if (samplers === undefined) throw new Error('Missing original sampler declarations');
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

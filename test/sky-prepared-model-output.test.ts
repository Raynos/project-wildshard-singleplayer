// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated cache and retain the original complete GLB oracle.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import { BAKED_PIECES, BAKED_URLS } from '../src/shards/far-reach/generators/fileInventory';
import { nameBlob } from '../src/sdk/blobs';
import { BRIDGE_REST_URL } from '../src/shards/far-reach/generators/restFiles';
import { sceneRigFiles } from '../src/game/shardfile/sceneRigFiles';
import { skyProductRows } from '../src/shards/far-reach/generators/product';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { skyWorldTileSource } from '../src/shards/far-reach/generators/worldTileBytes';
import { output, prepareOutput } from '../src/shards/far-reach/generators/sourceOutput';

const geometryName = 'world/geometry/prepared-models.glb', heroName = 'world/sources/heroes.json', bakeName = 'world/sources/bakes.json', skyName = 'world/sources/sky.json', bridgeName = 'world/geometry/bridge-rest.glb';
const hash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
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
    expect(owned.namedFiles).toHaveLength(output.namedFiles.length + 12);
    for (const file of output.namedFiles) {
      if (file.name === heroName || file.name === bakeName || file.name === skyName) continue;
      expect(owned.namedFiles.find(row => row.name === file.name)).toEqual(file);
      expect(owned.assets.get(file.hash)).toEqual(output.assets.get(file.hash));
    }
    expect(owned.platform).toBe(output.platform); expect(owned.blobs).toBe(output.blobs);
    const oldSky = output.namedFiles.find(file => file.name === skyName), newSky = owned.namedFiles.find(file => file.name === skyName);
    if (oldSky === undefined || newSky === undefined) throw new Error('Missing native library descriptor');
    expect(text.decode(owned.assets.get(newSky.hash))).toBe(text.decode(output.assets.get(oldSky.hash))
      .replace(JSON.stringify(BRIDGE_REST_URL), JSON.stringify(bridgeName)));
    expect(owned.assets.has(oldSky.hash)).toBe(false);
    const bridgeOriginal = readFileSync(`public${BRIDGE_REST_URL}`), bridge = nameBlob(bridgeName, 'glb', bridgeOriginal);
    expect(owned.namedFiles.find(file => file.name === bridgeName)).toEqual(bridge.file);
    const bridgeBytes = owned.assets.get(bridge.file.hash);
    if (bridgeBytes === undefined) throw new Error('Missing owned bridge geometry');
    expect(Buffer.compare(bridgeBytes, bridgeOriginal)).toBe(0); bridgeBytes.fill(0);

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
    expect(Buffer.compare(hitBytes, original)).toBe(0); expect(builds).toBe(4);
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
    expect(Buffer.compare(hitBridge, bridgeOriginal)).toBe(0);

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
    const bridgeOriginal = readFileSync(`public${BRIDGE_REST_URL}`), bridge = nameBlob(bridgeName, 'glb', bridgeOriginal);
    const poolIndex = sky.rows.geometryPools.findIndex(pool => pool.url === bridgeName);
    expect(poolIndex).toBeGreaterThanOrEqual(0);
    expect(native.geometryPools?.[poolIndex]?.url).toBe(`/shardfiles/far-reach/${bridge.file.path}`);
    expect(Buffer.compare(await product.file(bridgeName), bridgeOriginal)).toBe(0);

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

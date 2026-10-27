import { skyMapPixels, skyMapProgram } from '../src/shards/far-reach/generators/mapProgram';
import { SKY_MAP_INPUTS } from '../src/shards/far-reach/generators/bake-map.mjs';
import { originalSkyMapInputs } from './fixtures/sky-map-source';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { generatedProjectMap } from '../src/sdk/projectMap';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated sealed cache and compare complete original map bytes.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omission catalogues and producer outputs to repository scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the original native level-nine pack writer byte for byte.
import { deflateSync } from 'node:zlib';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyMapWorldSources } from '../src/shards/far-reach/generators/mapWorldSources';
import { BAKED_PIECES } from '../src/shards/far-reach/generators/fileInventory';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { MILL_REST_INPUTS } from '../src/shards/far-reach/generators/millRestProgram';
import { PREPARED_MODEL_INPUTS } from '../src/shards/far-reach/generators/preparedModelProgram';

const handoff = 'public/assets/far-reach/baked/prepared-models.glb';
const hash = 'a4d2c58042946dc131c67027993aa567121d45bab1e33759248acb8aa704728d';
const worldHandoffs = [...BAKED_PIECES.map(piece => `../../../public/assets/far-reach/baked/${piece}.glb`),
  '../../../public/assets/far-reach/baked/isles.bin', 'data/isles.json', 'data/geometries.json', 'owned-ground.json', 'owned-world-rows.json'];
const millHandoffs = ['public/assets/far-reach/baked/mill-rest.glb', 'src/shards/far-reach/data/millRest.generated.json'];
const bridgeHandoffs = ['public/assets/far-reach/baked/bridge-rest.glb', 'src/shards/far-reach/data/bridgeRest.generated.json'];
const originalWorldInputs: Readonly<Record<string, { readonly bytes: number; readonly hash: string }>> = {
  "../../../public/assets/far-reach/baked/winch-house.glb": {
    "bytes": 284152,
    "hash": "0946ca25b8bb75aca6386cf177f31dd12c324c7acb30450a0ce2b223afc00d09"
  },
  "../../../public/assets/far-reach/baked/roost.glb": {
    "bytes": 114424,
    "hash": "9e13f71c1ab243908ad51c6ae0ceffb33a5d2b58a33d3329f046cf54bff7f685"
  },
  "../../../public/assets/far-reach/baked/docks.glb": {
    "bytes": 14692,
    "hash": "216d946b01189d068313ee631b3f6688964c5c2b22a239de62c3146f681b494a"
  },
  "../../../public/assets/far-reach/baked/crown.glb": {
    "bytes": 14288,
    "hash": "1cb9c09a391ec1cf3282f3d9ce08938c0fc054694c8cbef8dad7b8f1c8866fcb"
  },
  "../../../public/assets/far-reach/baked/mill.glb": {
    "bytes": 1021940,
    "hash": "80d4702049e4ea208058d759593e1538373edadac9c5bf96b1520564a12af3f2"
  },
  "../../../public/assets/far-reach/baked/book-stand.glb": {
    "bytes": 8912,
    "hash": "ff18bc072d5b9ac9657fb0eedcea8e56f53352dd7287c8b2ea1ad657d4cc5151"
  },
  "../../../public/assets/far-reach/baked/knolls.glb": {
    "bytes": 54004,
    "hash": "97e919d64a10aedd7258bb7c76cf01a78cef95764b8c5233b22c92435a5fa2a6"
  },
  "../../../public/assets/far-reach/baked/geometries.glb": {
    "bytes": 116224,
    "hash": "cb33dc7b8f36985fabda61b01084b271b59ae3aa5dbd0f2fe5b00fef9d111576"
  },
  "../../../public/assets/far-reach/baked/islet-rig.glb": {
    "bytes": 5624,
    "hash": "49b8daf1fe50d93991c4d63ae9a2a7358b027d37d8825dae4a4f6f3c89496f47"
  },
  "../../../public/assets/far-reach/baked/dressing.glb": {
    "bytes": 592924,
    "hash": "c20fab6b445be7ca507389ba87266cf36e4c2c89af22dd99650ec5a6357e22dc"
  },
  "../../../public/assets/far-reach/baked/isles.bin": {
    "bytes": 824867,
    "hash": "5823d227f130672fc7cdf97ac8edfeb4fbdf22423362c79557215145901185cc"
  },
  "data/isles.json": {
    "bytes": 1841,
    "hash": "948a0162669414f82ce933ca20e3c45c59ae6dfdfd5d0f3657e8dd8063e5f12a"
  },
  "data/geometries.json": {
    "bytes": 1615,
    "hash": "3e770922599e1ff74629e90fa1cc29a9e9843c366a8660381b0c4c3095271a93"
  },
  "owned-world-rows.json": {
    "bytes": 65347,
    "hash": "3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d"
  },
  "owned-ground.json": {
    "bytes": 17705,
    "hash": "b72fb9d2372640b84d8b00ebe7ca6ba82a2673be3f430c0ab7002c5b8dfc1660"
  }
};
const rootPath = (file: string): string => file.startsWith('../../../public/') ? file.slice(9) : `src/shards/far-reach/${file}`;

test('the source map owns every native input and retains the complete original image and RGBA identity', async () => {
  for (const url of [...PREPARED_MODEL_INPUTS, ...MILL_REST_INPUTS]) expect(SKY_MAP_INPUTS).toContain(url);
  for (const file of [handoff, ...bridgeHandoffs, ...millHandoffs, ...worldHandoffs.map(rootPath)]) expect(SKY_MAP_INPUTS).not.toContain(file);
  const cache = mkdtempSync(resolve('tmp/sky-map-native-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await skyMapProgram(ctx), encoded = await generatedProjectMap(cold, 'a'.repeat(64));
    expect(cold.pixels.byteLength).toBe(4_000_000);
    const prefix = new TextEncoder().encode('map-rgba8/1\u00001000x1000\u0000'), stamped = new Uint8Array(prefix.length + cold.pixels.length);
    stamped.set(prefix); stamped.set(cold.pixels, prefix.length);
    expect(hashImmutableBytes(stamped)).toBe('39a0770cfbeebbf625bcb62fed48113a2c37ea436467fb9cfa1339c5912c420a');
    expect(encoded.map.bytes.byteLength).toBe(17_566); expect(hashImmutableBytes(encoded.map.bytes)).toBe(hash);
    const original = hashImmutableBytes(cold.pixels); cold.pixels.fill(0);
    expect(hashImmutableBytes((await skyMapProgram(ctx)).pixels)).toBe(original);
    await expect(skyMapProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('cache inventory differs');
    const missing = createProjectGeneration(resolve('src/shards/far-reach'), 'a'.repeat(64), new Map(), resolve(cache, 'missing'));
    await expect(skyMapProgram(missing)).rejects.toThrow('exactly one declared root');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test.each(['/assets/far-reach/fan/hand-hd.glb', ...MILL_REST_INPUTS])('the source map refuses omitted original native model %s', async url => {
  const inputs = originalSkyMapInputs(); expect(inputs.has(url)).toBe(true); inputs.delete(url);
  await expect(skyMapPixels(inputs)).rejects.toThrow('native input inventory differs');
});

test('owned map world inputs preserve every original native payload and metadata without stored handoffs', () => {
  const settings: unknown = JSON.parse(readFileSync('src/shards/far-reach/data/map.json', 'utf8'));
  expect(settings).toHaveProperty('inputs');
  if (typeof settings !== 'object' || settings === null || !('inputs' in settings) || !Array.isArray(settings.inputs)) {
    throw new Error('Missing map input authority');
  }
  expect(settings.inputs).not.toContain('data/millRest.generated.json');
  expect(settings.inputs).not.toContain('data/groundScene.generated.json');
  expect(settings.inputs).not.toContain('../../../public/assets/far-reach/baked/mill-rest.glb');
  for (const url of MILL_REST_INPUTS) expect(settings.inputs).toContain(`../../../public${url}`);
  const check = (files: ReadonlyMap<string, Uint8Array>): void => {
    expect([...files.keys()].sort()).toEqual([...worldHandoffs].sort());
    for (const file of worldHandoffs) {
      expect(settings.inputs).not.toContain(file);
      const bytes = files.get(file);
      if (bytes === undefined) throw new Error('Missing owned map input');
      const original = originalWorldInputs[file];
      if (original === undefined) throw new Error('Missing original full map input pin');
      expect(bytes.byteLength, file).toBe(original.bytes);
      expect(hashImmutableBytes(bytes), file).toBe(original.hash);
    }
  };
  const compress = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateSync(bytes, { level: 9 }));
  const first = skyMapWorldSources(compress); check(first);
  for (const bytes of first.values()) bytes.fill(0);
  check(skyMapWorldSources(compress));
});

test('the map world source bundles without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/mapProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing map world source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    for (const leaf of ['mapWorldSources.ts', 'groundScene.ts', 'knoll.ts', 'isletRigRows.ts', 'bridgeRest.ts', 'mapProgram.ts']) {
      expect(Object.keys(chunk.modules).some(path => path.endsWith(`/${leaf}`)), leaf).toBe(true);
    }
  }
});


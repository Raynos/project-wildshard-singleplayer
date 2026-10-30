import { skyMapPixels, skyMapProgram } from '../src/shards/far-reach/generators/mapProgram';
import { SKY_MAP_INPUTS } from '../src/shards/far-reach/generators/bake-map.mjs';
import { originalSkyMapInputs } from './fixtures/sky-map-source';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated cache and inspect declared source input authority.
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
const worldHandoffs = [...BAKED_PIECES.map(piece => `../../../public/assets/far-reach/baked/${piece}.glb`),
  '../../../public/assets/far-reach/baked/isles.bin', 'data/isles.json', 'data/geometries.json', 'owned-ground.json', 'owned-world-rows.json'];
const millHandoffs = ['public/assets/far-reach/baked/mill-rest.glb', 'src/shards/far-reach/data/millRest.generated.json'];
const bridgeHandoffs = ['public/assets/far-reach/baked/bridge-rest.glb', 'src/shards/far-reach/data/bridgeRest.generated.json'];
const rootPath = (file: string): string => file.startsWith('../../../public/') ? file.slice(9) : `src/shards/far-reach/${file}`;

test('the source map owns native inputs and isolates cached pixel mutations', async () => {
  for (const url of [...PREPARED_MODEL_INPUTS, ...MILL_REST_INPUTS]) expect(SKY_MAP_INPUTS).toContain(url);
  for (const file of [handoff, ...bridgeHandoffs, ...millHandoffs, ...worldHandoffs.map(rootPath)]) expect(SKY_MAP_INPUTS).not.toContain(file);
  const cache = mkdtempSync(resolve('tmp/sky-map-native-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await skyMapProgram(ctx);
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

test('owned map world inputs isolate returned bytes without stored handoffs', () => {
  const settings: unknown = JSON.parse(readFileSync('src/shards/far-reach/data/map.json', 'utf8'));
  expect(settings).toHaveProperty('inputs');
  if (typeof settings !== 'object' || settings === null || !('inputs' in settings) || !Array.isArray(settings.inputs)) {
    throw new Error('Missing map input authority');
  }
  expect(settings.inputs).not.toContain('data/millRest.generated.json');
  expect(settings.inputs).not.toContain('data/groundScene.generated.json');
  expect(settings.inputs).not.toContain('../../../public/assets/far-reach/baked/mill-rest.glb');
  for (const url of MILL_REST_INPUTS) expect(settings.inputs).toContain(`../../../public${url}`);
  const compress = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateSync(bytes, { level: 9 }));
  const first = skyMapWorldSources(compress);
  for (const file of first.keys()) expect(settings.inputs).not.toContain(file);
  const before = new Map([...first].map(([name, bytes]) => [name, bytes.slice()]));
  for (const bytes of first.values()) bytes.fill(0);
  expect(skyMapWorldSources(compress)).toEqual(before);
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


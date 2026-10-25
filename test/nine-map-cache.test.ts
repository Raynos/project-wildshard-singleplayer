// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated cache and read the original declared native inputs.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the original author input root explicitly.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the predecessor's dimension-prefixed complete pixel digest.
import { createHash } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { generatedProjectMap } from '../src/sdk/projectMap';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nineMap, nineMapPixels, NINE_MAP_INPUTS } from '../src/shards/nine-dragon-stack/generators/mapProgram';
import before from './fixtures/nine-map-files.json' with { type: 'json' };

mkdirSync('tmp', { recursive: true });
const cache = mkdtempSync(resolve('tmp', 'nine-map-cache-'));
afterAll(() => { rmSync(cache, { recursive: true, force: true }); });
const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), '7'.repeat(64), new Map(), cache,
  [{ prefix: '/assets/', directory: resolve('public/assets') }]);
const pixelHash = (pixels: Uint8Array): string => createHash('sha256').update('map-rgba8/1\u00001000x1000\u0000').update(pixels).digest('hex');
let paints = 0;
// Cold admission precedes the hit cases: all complete original oracles stay
// inside their unchanged 30-second test deadlines.
const ctx = context(), cold = await nineMap({ cached: (step, generate) => ctx.cached(step, inputs => {
  paints++; expect(step).toEqual({ id: 'world-map', native: true, inputs: NINE_MAP_INPUTS });
  return generate(inputs);
}) });

test('cold source map retains every original pixel and lossless image byte', async () => {
  expect(cold.length).toBe(4_000_000);
  expect(pixelHash(cold)).toBe('131bc5c356d05f490ee4516b0e305af0785056fdb9657b950b4c8f64edebb2b5');
  const image = await generatedProjectMap({ pixels: cold }, 'f'.repeat(64)), original = before[2];
  if (original === undefined) throw new Error('Missing original Nine map image');
  expect(image.map.bytes.length).toBe(original.bytes);
  expect(hashImmutableBytes(image.map.bytes)).toBe(original.hash);
});

test('persistent hit reuses the paint while returning independent complete pixels', async () => {
  const hit = context();
  const pixels = await nineMap({ cached: (step, generate) => hit.cached(step, inputs => { paints++; return generate(inputs); }) });
  expect(paints).toBe(1); expect(pixels).not.toBe(cold);
  expect(pixelHash(pixels)).toBe(pixelHash(cold)); pixels.fill(0);
  expect(pixelHash(cold)).toBe('131bc5c356d05f490ee4516b0e305af0785056fdb9657b950b4c8f64edebb2b5');
});

test('missing/extra inputs, altered native bytes and malformed map caches refuse', async () => {
  const inputs = new Map(NINE_MAP_INPUTS.map(name => [name, new Uint8Array(readFileSync(resolve(`public${name}`)))]));
  await expect(nineMapPixels(new Map())).rejects.toThrow('Nine map input inventory differs');
  await expect(nineMapPixels(new Map([...inputs, ['extra', new Uint8Array([1])]]))).rejects.toThrow('Nine map input inventory differs');
  inputs.set('/assets/nine-dragon/authored/sign-atlas/signAtlas.json', new Uint8Array([1]));
  await expect(nineMapPixels(inputs)).rejects.toThrow('Nine native atlas bytes differ');
  for (const files of [new Map<string, Uint8Array>(), new Map([['map.rgba', new Uint8Array(1)]]),
    new Map([['map.rgba', new Uint8Array(4_000_000)], ['extra', new Uint8Array([1])]])]) {
    await expect(nineMap({ cached: () => Promise.resolve(files) })).rejects.toThrow('Nine map lattice cache inventory differs');
  }
});

test('the source map requires an explicit native asset root on cold and hit paths', async () => {
  await expect(nineMap(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), '7'.repeat(64), new Map(), cache)))
    .rejects.toThrow('Generation input needs exactly one declared root');
});

test('the actual map producer bundles without file, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/mapProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing Nine map program bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

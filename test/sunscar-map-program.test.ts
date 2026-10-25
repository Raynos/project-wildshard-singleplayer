// oxlint-disable-next-line import/no-nodejs-modules -- The real program proof owns its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind author input roots explicitly, never infer them in the SDK.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare all original pixels using the existing map stamp's dimension-prefixed digest.
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { generatedProjectMap } from '../src/sdk/projectMap';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { signalMap, signalMapSources, SIGNAL_MAP_INPUTS } from '../src/shards/sunscar-dunes/generators/mapProgram';
import { signalWorldFiles } from '../src/shards/sunscar-dunes/generators/worldProgram';
import original from './fixtures/sunscar-world-files.json' with { type: 'json' };

const pixelHash = (pixels: Uint8Array): string => createHash('sha256').update('map-rgba8/1\u00001000x1000\u0000').update(pixels).digest('hex');
const before = 'a7fc31f43e02c0575dc09044199a5303b9dfb027e9c4d2cda74acda2fe8c9297';

test('cold and cached source maps retain every original world input, pixel and encoded image byte', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-map-program-'));
  try {
    let paints = 0;
    const context = () => createProjectGeneration(resolve('src/shards/sunscar-dunes'), '9'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const ctx = context(), world = await signalWorldFiles(ctx);
    const pixels = await signalMap({ cached: (step, generate) => ctx.cached(step, inputs => {
      if (step.id === 'world-map') {
        paints++; expect(step.native).toBe(true); expect(step.inputs).toEqual(SIGNAL_MAP_INPUTS);
        expect(inputs.has('assets/models/dry-well.glb')).toBe(true);
        const sources = signalMapSources(world, inputs);
        for (const [name, expected] of Object.entries(original)) {
          if (name === 'plait.bin') continue;
          const path = name.endsWith('.json') ? `data/${name}` : `../../../public/assets/sunscar-dunes/baked/${name}`;
          const bytes = sources.input(path);
          expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(expected);
        }
        expect(() => sources.input('ungranted.glb')).toThrow('Missing declared map input');
      }
      return generate(inputs);
    }) });
    expect(pixels.length).toBe(4_000_000); expect(pixelHash(pixels)).toBe(before);
    const encoded = await generatedProjectMap({ pixels }, 'f'.repeat(64));
    expect(encoded.map.bytes.length).toBe(172348);
    expect(hashImmutableBytes(encoded.map.bytes)).toBe('bac9393474d96298d9bd4a407197d0bc86be913b872c8430e8f2e0aabd5cb399');
    pixels.fill(0);
    const hit = await signalMap({ cached: (step, generate) => context().cached(step, inputs => { if (step.id === 'world-map') paints++; return generate(inputs); }) });
    expect(hit === pixels).toBe(false); expect(pixelHash(hit)).toBe(before); expect(paints).toBe(1);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('missing/extended input banks and incomplete/extended/resized map caches refuse', async () => {
  const world = new Map(Object.keys(original).map(name => [name, new Uint8Array([1])]));
  const inputs = new Map(SIGNAL_MAP_INPUTS.map(name => [name, new Uint8Array([1])]));
  expect(() => signalMapSources(world, new Map())).toThrow('Map input inventory differs');
  expect(() => signalMapSources(world, new Map([...inputs, ['extra', new Uint8Array([1])]]))).toThrow('Map input inventory differs');
  for (const files of [new Map<string, Uint8Array>(), new Map([['map.rgba', new Uint8Array(1)]]),
    new Map([['map.rgba', new Uint8Array(4_000_000)], ['extra', new Uint8Array([1])]])]) {
    await expect(signalMap({ cached: step => Promise.resolve(step.id === 'world-geometry' ? world : files) }))
      .rejects.toThrow('Map lattice cache inventory differs');
  }
});

test('public models require the caller to declare their input root', async () => {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'sunscar-map-no-root-'));
  try {
    await expect(signalMap(createProjectGeneration(resolve('src/shards/sunscar-dunes'), '8'.repeat(64), new Map(), cache)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('the complete map program bundles without filesystem/module/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/sunscar-dunes/generators/mapProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing source-map program bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});

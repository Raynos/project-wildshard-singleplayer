// oxlint-disable-next-line import/no-nodejs-modules -- Prove handoff absence and own isolated source/cache fixtures.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the real sealed producer and source bundle to this checkout.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare full rasters without expanding millions of assertion elements.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Independently decode the original lossless numerical texture.
import { zstdDecompressSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { parseKtx2 } from '../src/format/ktx2Cost';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { bakeSkySwardAtlas, bakeSwardAtlasTexture } from '../src/shards/far-reach/generators/swardAtlas';
import { skySwardAtlasProgram } from '../src/shards/far-reach/generators/swardAtlasProgram';

// Identity of the retired handoff path, not an expected current output digest.
const retiredHandoffHash = '607c53f28dbdd88423b39fd32419ba735f9a13c3c1ecabaf1cadb68715d63f0b';
const check = (bytes: Uint8Array, expected: { bytes: number; hash: string }): void => {
  expect(bytes.byteLength).toBe(expected.bytes);
  expect(hashImmutableBytes(bytes)).toBe(expected.hash);
};

test('the current sward texture preserves numerical strand channels and linear single-level costs', async () => {
  const made = await bakeSwardAtlasTexture();
  const view = new DataView(made.buffer, made.byteOffset, made.byteLength);
  expect([view.getUint32(12, true), view.getUint32(20, true), view.getUint32(24, true), view.getUint32(40, true)])
    .toEqual([37, 1152, 512, 1]);
  expect(made[118]).toBe(1);
  const offset = Number(view.getBigUint64(80, true)), size = Number(view.getBigUint64(88, true));
  const pixels = zstdDecompressSync(made.subarray(offset, offset + size));
  expect(pixels.byteLength).toBe(2_359_296);
  expect(Buffer.compare(pixels, bakeSkySwardAtlas())).toBe(0);
  expect(parseKtx2(made)).toMatchObject({ gpu: 2_359_296, triangles: 0, draws: 0 });
});

test.each(['swardAtlas', 'swardAtlasProgram'])('%s bundles without generated imports or file/compiler services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing sward atlas source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test('cold and persistent atlas hits preserve the complete current texture and detach caller mutations', async () => {
  const cache = mkdtempSync(resolve('tmp/sky-sward-cache-')), project = mkdtempSync(resolve(cache, 'project-'));
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(project, identity.repeat(64), new Map(), resolve(cache, 'cache'));
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'sward-atlas', native: true, inputs: [] });
      return ctx.cached(step, inputs => { expect(inputs.size).toBe(0); builds++; return generate(inputs); });
    } };
  };
  try {
    const first = await skySwardAtlasProgram(context());
    const expected = { bytes: first.byteLength, hash: hashImmutableBytes(first) };
    check(first, expected); first.fill(0);
    check(await skySwardAtlasProgram(context()), expected); expect(builds).toBe(1);
    check(await skySwardAtlasProgram(context('b')), expected); expect(builds).toBe(2);
    expect(readdirSync(project)).toEqual([]);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test('unexpected source inputs and missing, empty or extra cached atlas files refuse', async () => {
  await expect(skySwardAtlasProgram({ cached: (_step, generate) => Promise.resolve(generate(new Map([['foreign', new Uint8Array([1])]]))) }))
    .rejects.toThrow('Sky sward atlas input inventory differs');
  for (const files of [new Map<string, Uint8Array>(), new Map([['sward.ktx2', new Uint8Array()]]),
    new Map([['sward.ktx2', new Uint8Array([1])], ['foreign', new Uint8Array([1])]])]) {
    await expect(skySwardAtlasProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky sward atlas cache inventory differs');
  }
});

test('the atlas scheduler and all declared handoff readers are retired', () => {
  const handoff = `src/shards/far-reach/assets/${retiredHandoffHash}`;
  expect(existsSync(handoff)).toBe(false);
});

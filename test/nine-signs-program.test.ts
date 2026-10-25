// oxlint-disable-next-line import/no-nodejs-modules -- This fixture owns and removes only its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the real author root without copying its source.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nineSignsProgram } from '../src/shards/nine-dragon-stack/generators/signsProgram';
import before from './fixtures/nine-sign-source-files.json' with { type: 'json' };
import nativeInputs from '../src/shards/nine-dragon-stack/data/nativeSignAtlas.json' with { type: 'json' };
import { nineNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/nativeSignAtlas';
import { nineNativeGlyphs } from '../src/shards/nine-dragon-stack/generators/nativeGlyphs';
import glyphInputs from '../src/shards/nine-dragon-stack/data/nativeGlyphs.json' with { type: 'json' };

async function coldFixture() {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-signs-cache-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'd'.repeat(64), new Map(), cache, [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const native = await nineNativeSignAtlas(context(), nativeInputs), glyphs = await nineNativeGlyphs(context(), glyphInputs);
    const cold = await nineSignsProgram(context(), native, glyphs);
    return { cold, native, glyphs, context, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
// Cold native production is fixture admission; byte and hit oracles keep their ordinary 30s budgets.
const fixture = await coldFixture();
afterAll(fixture.dispose);

test('all 28 original sign files retain every byte and the same admitted file costs', () => {
  expect(before.files).toHaveLength(28); expect(fixture.cold.files.size).toBe(before.files.length);
  for (const row of before.files) {
    const bytes = fixture.cold.files.get(row.path); if (bytes === undefined) throw new Error(`Missing original sign ${row.path}`);
    expect(bytes.byteLength, row.path).toBe(row.bytes); expect(hashImmutableBytes(bytes), row.path).toBe(row.hash);
  }
  const metadata = fixture.cold.files.get('data/signSources.generated.json'); if (metadata === undefined) throw new Error('Missing sign manifest');
  const value: unknown = JSON.parse(new TextDecoder().decode(metadata));
  expect(value).toHaveProperty('rows.phone'); expect(value).toHaveProperty('rows.desktop');
  expect(fixture.cold.blobs).toHaveLength(27);
  expect(fixture.cold.blobs.map(row => row.file)).toStrictEqual(before.admitted);
});

test('a hit never rebuilds, owns every byte and republishes identical named metadata', async () => {
  const ctx = fixture.context();
  const hit = await nineSignsProgram({ ...ctx, cached: step => ctx.cached(step, () => { throw new Error('Hit must not rebuild'); }) }, fixture.native, fixture.glyphs);
  expect(hit.atlas).toEqual(fixture.native.atlas);
  expect(hit.blobs.map(row => row.file)).toStrictEqual(fixture.cold.blobs.map(row => row.file));
  for (const [name, bytes] of hit.files) {
    const cold = fixture.cold.files.get(name); if (cold === undefined) throw new Error(`Missing cold sign ${name}`);
    expect(hashImmutableBytes(bytes), name).toBe(hashImmutableBytes(cold)); expect(bytes === cold).toBe(false);
  }
});

test('changed supplied native lamps cannot reuse earlier sign bytes', async () => {
  const ctx = fixture.context(), atlas = fixture.native.atlas;
  const lamp = { at: [0, 130, 0], color: [1, 0, 0], w: 3, h: 3, power: 1, spill: 1 };
  const changed = { ...fixture.native, atlas: { ...atlas, phone: { ...atlas.phone, lights: [...atlas.phone.lights, lamp] } } };
  await expect(nineSignsProgram({ ...ctx, cached: step => ctx.cached(step, () => { throw new Error('Changed native signs must rebuild'); }) }, changed, fixture.glyphs))
    .rejects.toThrow('Changed native signs must rebuild');
});

test('missing, extra, malformed and incorrectly published sign results refuse', async () => {
  const ctx = fixture.context(), missing = new Map(fixture.cold.files); missing.delete('data/signSource-0.generated.glb');
  await expect(nineSignsProgram({ ...ctx, cached: () => Promise.resolve(missing) }, fixture.native, fixture.glyphs)).rejects.toThrow('inventory differs');
  const extra = new Map(fixture.cold.files); extra.set('unexpected.bin', new Uint8Array());
  await expect(nineSignsProgram({ ...ctx, cached: () => Promise.resolve(extra) }, fixture.native, fixture.glyphs)).rejects.toThrow('inventory differs');
  const corrupt = new Map(fixture.cold.files); corrupt.set('data/signSources.generated.json', new Uint8Array([255]));
  await expect(nineSignsProgram({ ...ctx, cached: () => Promise.resolve(corrupt) }, fixture.native, fixture.glyphs)).rejects.toThrow();
  await expect(nineSignsProgram({ ...ctx, cached: () => Promise.resolve(fixture.cold.files), asset: () => '0'.repeat(64) }, fixture.native, fixture.glyphs)).rejects.toThrow('publication differs');
});

test('changed supplied glyph metrics and bytes cannot reuse earlier sign results', async () => {
  const ctx = fixture.context(), glyphs = fixture.glyphs.glyphs;
  const changed = { ...fixture.glyphs, glyphs: { ...glyphs, phone: { ...glyphs.phone, layout: { ...glyphs.phone.layout, spread: glyphs.phone.layout.spread + 1 } } } };
  const refuse = { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0]) => ctx.cached(step, () => { throw new Error('Changed glyphs must rebuild'); }) };
  await expect(nineSignsProgram(refuse, fixture.native, changed)).rejects.toThrow('Changed glyphs must rebuild');
  const bytes = new Map(fixture.glyphs.files); bytes.set('glyphs-phone-0.bin', new Uint8Array([0]));
  await expect(nineSignsProgram(refuse, fixture.native, { ...fixture.glyphs, files: bytes })).rejects.toThrow('Changed glyphs must rebuild');
});

test('missing supplied native bytes refuse before the cache result can publish', async () => {
  const missing = new Map(fixture.glyphs.files); missing.delete('glyphs-phone-0.bin');
  await expect(nineSignsProgram(fixture.context(), fixture.native, { ...fixture.glyphs, files: missing })).rejects.toThrow('Missing Nine native sign glyphs-phone-0.bin');
});

test('the sign program bundles without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/signsProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing sign bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

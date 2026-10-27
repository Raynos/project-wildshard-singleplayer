// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only the fixture's isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the defining author project and declared public input root.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { ownedWorld } from './fixtures/nine-product-inputs';
import { beforeHalfSourceWorld, expectHalfWorld, previousHalfReferences } from './fixtures/nine-half-world';
import { nineDeclarationsProgram, nineDeclarationFiles } from '../src/shards/nine-dragon-stack/generators/declarationsProgram';
import { worldPartitionIds } from '../src/shards/nine-dragon-stack/generators/worldRows';
import before from './fixtures/nine-declaration-files.json' with { type: 'json' };

async function coldFixture() {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-declaration-cache-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'f'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await nineDeclarationsProgram(context(), ownedWorld);
    const predecessor = await nineDeclarationsProgram(context(), beforeHalfSourceWorld);
    return { cold, predecessor, context, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
// Cold production belongs to fixture admission; all complete byte/hit oracles keep their ordinary budgets.
const fixture = await coldFixture();
afterAll(fixture.dispose);
const digest = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('the source declaration retains both original canonical wires and every partition owner', () => {
  expect(fixture.cold.files.size).toBe(2);
  expectHalfWorld(ownedWorld);
  for (const [name, bytes] of fixture.cold.files) {
    const old = fixture.predecessor.files.get(name);
    if (old === undefined) throw new Error(`Missing predecessor declaration ${name}`);
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    expect(encodeCanonicalJson(previousHalfReferences(value)), name).toBe(encodeCanonicalJson(JSON.parse(new TextDecoder().decode(old))));
  }
  for (const row of before) {
    const key = row.file === 'declarations.generated.json' ? 'declarations.json' : 'world-rows.json';
    const bytes = fixture.predecessor.files.get(key); if (bytes === undefined) throw new Error(`Missing declaration ${key}`);
    expect(bytes.byteLength, key).toBe(row.bytes); expect(hashImmutableBytes(bytes), key).toBe(row.hash);
  }
  expect(fixture.cold.world.rows.records).toBe(fixture.cold.world.records.length);
  expect(Object.keys(fixture.cold.world.wholeTiles).length).toBeGreaterThan(0);
});

test('a hit never rebuilds and returns independently owned canonical wires and rows', async () => {
  const ctx = fixture.context();
  const hit = await nineDeclarationsProgram({ cached: step => ctx.cached(step, () => { throw new Error('A hit must not rebuild'); }) }, ownedWorld);
  expect(digest(hit.world)).toBe(digest(fixture.cold.world)); expect(hit.world).not.toBe(fixture.cold.world);
  for (const [name, bytes] of hit.files) {
    expect(bytes).not.toBe(fixture.cold.files.get(name)); expect(hashImmutableBytes(bytes)).toBe(hashImmutableBytes(fixture.cold.files.get(name) ?? new Uint8Array()));
  }
});

test('missing, extra, invalid and mismatched row/audio results remain refusals', async () => {
  const missing = new Map(fixture.cold.files); missing.delete('declarations.json');
  await expect(nineDeclarationsProgram({ cached: () => Promise.resolve(missing) }, ownedWorld)).rejects.toThrow('file inventory differs');
  const extra = new Map(fixture.cold.files); extra.set('unexpected.bin', new Uint8Array());
  await expect(nineDeclarationsProgram({ cached: () => Promise.resolve(extra) }, ownedWorld)).rejects.toThrow('file inventory differs');
  const corrupt = new Map(fixture.cold.files); corrupt.set('world-rows.json', new Uint8Array([255]));
  await expect(nineDeclarationsProgram({ cached: () => Promise.resolve(corrupt) }, ownedWorld)).rejects.toThrow();
  const audio = new Map(fixture.cold.files); audio.set('declarations.json', new TextEncoder().encode('{}\n'));
  await expect(nineDeclarationsProgram({ cached: () => Promise.resolve(audio) }, ownedWorld)).rejects.toThrow('audio declaration differs');
  const records = new Map(fixture.cold.files); records.set('world-rows.json', new TextEncoder().encode(encodeCanonicalJson({ ...fixture.cold.world, records: [] })));
  await expect(nineDeclarationsProgram({ cached: () => Promise.resolve(records) }, ownedWorld)).rejects.toThrow('record inventory differs');
});

test('undeclared crowd bytes and invalid partition GLBs refuse before publication', async () => {
  const ctx = fixture.context();
  await expect(nineDeclarationsProgram({ cached: (step, generate) => ctx.cached({ ...step, id: 'missing-declaration-input' }, inputs => {
    const missing = new Map(inputs); missing.delete('/assets/nine-dragon/lab/walker.glb'); return generate(missing);
  }) }, ownedWorld)).rejects.toThrow('Missing Nine declaration input');
  expect(() => worldPartitionIds(new Uint8Array(16))).toThrow('truncated');
  const missing = { ...ownedWorld, assets: new Map<string, Uint8Array>() };
  await expect(nineDeclarationFiles(missing, () => { throw new Error('Missing declared crowd input'); })).rejects.toThrow('Missing declared crowd input');
});

test('the declaration program bundles without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/declarationsProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing declaration bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

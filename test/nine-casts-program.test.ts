// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this isolated cache fixture.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the existing authored public input root.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nineCastsProgram } from '../src/shards/nine-dragon-stack/generators/castsProgram';
import before from './fixtures/nine-cast-files.json' with { type: 'json' };
import admitted from './fixtures/nine-binary-outputs.json' with { type: 'json' };

async function coldCastsFixture() {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-casts-cache-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'c'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    let captured: ReadonlyMap<string, Uint8Array> | undefined;
    const ctx = context(), cold = await nineCastsProgram({ ...ctx, cached: (step, generate) => ctx.cached(step, async inputs => {
      captured = await generate(inputs); return captured;
    }) });
    if (captured === undefined) throw new Error('Missing cold casts receipt');
    return { cold, captured, context, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
const fixture = await coldCastsFixture();
afterAll(fixture.dispose);
const keyFor = (path: string): string => {
  const file = path.split('/').at(-1); if (file === undefined) throw new Error('Missing cast filename');
  if (path.startsWith('public/')) return `raw/${file}`;
  if (file.startsWith('cast-')) return `packed/${file.slice(5).replace('.generated', '')}`;
  const keys = new Map([['castHook.generated.glb', 'hook.glb'], ['castHook.generated.json', 'hook.json'],
    ['deckFloors.generated.json', 'floors.json'], ['fixedKits.generated.json', 'fixed.json']]);
  const key = keys.get(file); if (key === undefined) throw new Error(`Unexpected old cast ${file}`); return key;
};

test('cold casts preserve all 78 original raw, packed and metadata files plus admitted costs', () => {
  expect(fixture.captured.size).toBe(before.length); expect(before).toHaveLength(78);
  for (const row of before) {
    const bytes = fixture.captured.get(keyFor(row.path)); if (bytes === undefined) throw new Error(`Missing cast ${row.path}`);
    expect(bytes.byteLength, row.path).toBe(row.bytes); expect(hashImmutableBytes(bytes), row.path).toBe(row.hash);
  }
  expect(fixture.cold.blobs.map(row => row.file)).toStrictEqual(admitted.castFiles.filter(row => row.kind === 'glb'));
});

test('a hit never rebuilds and owns every original cast byte independently', async () => {
  const ctx = fixture.context(), hit = await nineCastsProgram({ ...ctx, cached: step => ctx.cached(step, () => { throw new Error('A hit must not rebuild'); }) });
  expect(hit.material).toStrictEqual(fixture.cold.material);
  expect(hit.blobs.map(row => row.file)).toStrictEqual(fixture.cold.blobs.map(row => row.file));
  for (const [name, bytes] of hit.raw) {
    const cold = fixture.cold.raw.get(name); if (cold === undefined) throw new Error(`Missing original cast ${name}`);
    expect(hashImmutableBytes(bytes)).toBe(hashImmutableBytes(cold)); expect(bytes === cold).toBe(false);
  }
});

test('missing, extra, invalid and wrongly published casts refuse', async () => {
  const ctx = fixture.context(), missing = new Map(fixture.captured); missing.delete('hook.glb');
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(missing) })).rejects.toThrow('inventory differs');
  const extra = new Map(fixture.captured); extra.set('unexpected.bin', new Uint8Array());
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(extra) })).rejects.toThrow('inventory differs');
  const corrupt = new Map(fixture.captured); corrupt.set('packed/lion.glb', new Uint8Array(16));
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(corrupt) })).rejects.toThrow();
  await expect(nineCastsProgram({ ...ctx, cached: () => Promise.resolve(fixture.captured), asset: () => '0'.repeat(64) })).rejects.toThrow('publication differs');
});

test('casts cache bundles without filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/castsProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing cast program bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

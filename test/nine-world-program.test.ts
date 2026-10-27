// oxlint-disable-next-line import/no-nodejs-modules -- Own only this isolated immutable cache fixture.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the explicit author root and its private cache.
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareAssetDecoders } from '../src/format/product';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { nineLayoutWord } from '../src/shards/nine-dragon-stack/generators/worldProduct';
import { nineWorldProgram } from '../src/shards/nine-dragon-stack/generators/worldProgram';
import before from './fixtures/nine-world-files.json' with { type: 'json' };
import nativeAtlas from '../public/assets/nine-dragon/authored/sign-atlas/signAtlas.json' with { type: 'json' };
import { parseNativeSignAtlas } from '../src/shards/nine-dragon-stack/generators/sections';

const atlas = parseNativeSignAtlas(nativeAtlas);

/** Prepare one genuinely empty cache; production work is fixture setup, never an assertion-time benchmark. */
async function coldWorldFixture() {
  await prepareAssetDecoders();
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-world-cache-'));
  try {
    const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), '8'.repeat(64), new Map(), cache);
    let captured: ReadonlyMap<string, Uint8Array> | undefined;
    const c = context(), cold = await nineWorldProgram({ ...c, cached: (step, generate) => c.cached(step, async inputs => {
      captured = await generate(inputs); return captured;
    }) }, atlas);
    if (captured === undefined) throw new Error('Missing cold world receipt');
    return { captured, cold, context, dispose: () => { rmSync(cache, { recursive: true, force: true }); } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
}
const fixture = await coldWorldFixture();
afterAll(() => { fixture.dispose(); });

test('cold source world preserves all 411 pinned wires and every geometry byte', () => {
  const { captured } = fixture;
  expect(captured.size).toBe(411);
  for (const row of before) {
    const key = row.path === 'data/layout.generated.json' ? 'layout.json' : row.path === 'data/world.generated.json' ? 'world.json' : row.path.replace('assets/', 'blobs/');
    const bytes = captured.get(key); if (bytes === undefined) throw new Error(`Missing original ${key}`);
    expect(bytes.byteLength, key).toBe(row.bytes); expect(hashImmutableBytes(bytes), key).toBe(row.hash);
  }
});

test('a cache hit never rebuilds and retains complete rows and independently owned geometry', async () => {
  const { cold, context } = fixture;
  const h = context(), hit = await nineWorldProgram({ ...h, cached: step => h.cached(step, () => { throw new Error('A hit must not rebuild'); }) }, structuredClone(atlas));
  const digest = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value, nineLayoutWord)));
  expect(digest(hit.metadata)).toBe(digest(cold.metadata)); expect(digest(hit.layout)).toBe(digest(cold.layout));
  expect(hit.assets.size).toBe(409); expect(cold.assets.size).toBe(409);
  for (const [hash, bytes] of hit.assets) { expect(hashImmutableBytes(bytes)).toBe(hash); expect(bytes === cold.assets.get(hash)).toBe(false); }
});

test('changed native lamps cannot hit an earlier world cache', async () => {
  const h = fixture.context(), lamp = { at: [0, 130, 0], color: [1, 0, 0], w: 3, h: 3, power: 1, spill: 1 };
  const changed = { ...atlas, phone: { ...atlas.phone, lights: [...atlas.phone.lights, lamp] } };
  await expect(nineWorldProgram({ ...h, cached: step => h.cached(step, () => { throw new Error('Changed native atlas must rebuild'); }) }, changed))
    .rejects.toThrow('Changed native atlas must rebuild');
});

test('missing, extra, corrupt and wrongly published world bytes remain refusals', async () => {
  const { captured, context } = fixture, h = context();
  const bad = new Map(captured); bad.delete('layout.json');
  await expect(nineWorldProgram({ ...h, cached: () => Promise.resolve(bad) }, atlas)).rejects.toThrow('Missing owned Nine world layout.json');
  const extra = new Map(captured); extra.set('unexpected.bin', new Uint8Array());
  await expect(nineWorldProgram({ ...h, cached: () => Promise.resolve(extra) }, atlas)).rejects.toThrow('file inventory differs');
  const first = before.find(row => row.path.startsWith('assets/')); if (first === undefined) throw new Error('Missing original geometry');
  const corrupt = new Map(captured), key = first.path.replace('assets/', 'blobs/');
  corrupt.set(key, new Uint8Array(first.bytes));
  await expect(nineWorldProgram({ ...h, cached: () => Promise.resolve(corrupt) }, atlas)).rejects.toThrow('world bytes differ');
  await expect(nineWorldProgram({ ...h, asset: () => '0'.repeat(64), cached: () => Promise.resolve(captured) }, atlas)).rejects.toThrow('publication differs');
});

test('the source world cache closure bundles without publication, filesystem or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/worldProgram.ts'), formats: ['es'] }, rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing source world bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});

// oxlint-disable-next-line import/no-nodejs-modules -- Independent native oracle and isolated cache for this producer proof.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { afterAll, expect, test } from 'vitest';
import { pineGeneration } from './fixtures/pine-generation';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { returnModule } from '../src/shards/pine-hollow/generators/sourceOutput';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import original from './fixtures/pine-life-program.json' with { type: 'json' };

const hash = '260eee8839d76af399fadc27a383c92ef8f75a0bbab154bce727d973d24e3594';
const oracle = new Uint8Array(readFileSync('test/fixtures/pine-life-program.wasm'));
const cache = mkdtempSync('tmp/pine-life-author-');
afterAll(() => rmSync(cache, { recursive: true, force: true }));
const context = pineGeneration('pine-life-author-v1', cache);

test('Pine life metadata and its original executable remain exact without inline authoring bytes', async () => {
  // GR8: the product compiles the declared row; the page file names the compiled row with no bytes (Pine's built product,
  // CI's build or the matching local cache: the whole output is not rebuilt inside the case)
  const pine = await loadHeadlessProduct(builtProduct('pine-hollow'));
  const pageRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await pine.file('actors/page-life.json')));
  expect(pageRows).toMatchObject({ program: original });
  // the producer: the life guest alone, compiled through the real decision compiler and cache
  const life = await returnModule(context, 'life');
  expect(life.file.name).toBe('behaviour/pine.life.wasm');
  expect(life.file.hash).toBe(hash);
  const bytes = life.bytes;
  expect(bytes).toEqual(oracle);
  expect(oracle.byteLength).toBe(9133);
  expect(hashImmutableBytes(oracle)).toBe(hash);
  expect(original.script.module).toBe(`blobs/wasm/${hash}.wasm`);
  bytes.fill(0);
  const warm = await returnModule(context, 'life');
  expect(warm.bytes).toEqual(oracle);
  expect(warm.bytes).not.toBe(bytes);
});

test('Pine life refuses changed compiler metadata and missing, extra or substituted cached bytes', async () => {
  const compiler = context.compileDecisionRows;
  if (compiler === undefined) throw new Error('Real decision compiler required');
  const cold = { ...context, cached: (_step: Parameters<typeof context.cached>[0], generate: Parameters<typeof context.cached>[1]) =>
    Promise.resolve(generate(new Map(['life', 'stag', 'shelter'].map(name => [
      `behaviour/${name}.as`, new Uint8Array(readFileSync(`src/shards/pine-hollow/behaviour/${name}.as`)),
    ])))) };
  await expect(returnModule({ ...cold, compileDecisionRows: async (...args) => {
    const built = await compiler(...args);
    return { ...built, rows: built.rows.map(row => { const changed = structuredClone(row); if (changed.id === original.script.id) changed.pages = 2; return changed; }) };
  } }, 'life')).rejects.toThrow('life metadata is stale');
  const row = new TextEncoder().encode(JSON.stringify(original.script));
  for (const { files, message } of [
    { files: new Map<string, Uint8Array>(), message: 'Missing life bytes' },
    { files: new Map([['life.wasm', new Uint8Array([0])], ['life.json', row]]), message: 'Invalid or oversized module' },
    { files: new Map([['life.wasm', oracle], ['life.json', row], ['extra.wasm', oracle]]), message: 'Missing life bytes' },
    { files: new Map([['life.wasm', new Uint8Array(readFileSync('test/fixtures/pine-shelter-program.wasm'))], ['life.json', row]]), message: 'module differs from metadata' },
  ]) {
    await expect(returnModule({ ...context, cached: (step, generate) => step.id === 'life-program'
      ? Promise.resolve(files) : context.cached(step, generate) }, 'life')).rejects.toThrow(message);
  }
});

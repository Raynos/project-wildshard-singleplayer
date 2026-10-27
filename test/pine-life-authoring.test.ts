// oxlint-disable-next-line import/no-nodejs-modules -- Independent native oracle and isolated cache for this producer proof.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { afterAll, expect, test } from 'vitest';
import { pineGeneration } from './fixtures/pine-generation';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareOutput } from '../src/shards/pine-hollow/generators/sourceOutput';
import original from './fixtures/pine-life-program.json' with { type: 'json' };

const hash = '260eee8839d76af399fadc27a383c92ef8f75a0bbab154bce727d973d24e3594';
const oracle = new Uint8Array(readFileSync('test/fixtures/pine-life-program.wasm'));
const cache = mkdtempSync('tmp/pine-life-author-');
afterAll(() => rmSync(cache, { recursive: true, force: true }));
const context = pineGeneration('pine-life-author-v1', cache);

test('Pine life metadata and its original executable remain exact without inline authoring bytes', async () => {
  const output = await prepareOutput(context);
  // GR8: the product compiles the declared row; the page file names the compiled row with no bytes.
  const page = output.namedFiles.find(row => row.name === 'actors/page-life.json');
  const pageBytes = page === undefined ? undefined : output.assets.get(page.hash);
  const pageRows: unknown = pageBytes === undefined ? undefined : JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(pageBytes));
  expect(pageRows).toMatchObject({ program: original });
  const file = output.namedFiles.find(row => row.name === 'behaviour/pine.life.wasm');
  expect(file?.hash).toBe(hash);
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  expect(bytes).toEqual(oracle);
  expect(oracle.byteLength).toBe(9133);
  expect(hashImmutableBytes(oracle)).toBe(hash);
  expect(original.script.module).toBe(`blobs/wasm/${hash}.wasm`);
  bytes?.fill(0);
  const warm = await prepareOutput(context);
  expect(warm.assets.get(hash)).toEqual(oracle);
  expect(warm.assets.get(hash)).not.toBe(bytes);
});

test('Pine life refuses changed compiler metadata and missing, extra or substituted cached bytes', async () => {
  const compiler = context.compileDecisionRows;
  if (compiler === undefined) throw new Error('Real decision compiler required');
  const cold = { ...context, cached: (_step: Parameters<typeof context.cached>[0], generate: Parameters<typeof context.cached>[1]) =>
    Promise.resolve(generate(new Map(['life', 'stag', 'shelter'].map(name => [
      `behaviour/${name}.as`, new Uint8Array(readFileSync(`src/shards/pine-hollow/behaviour/${name}.as`)),
    ])))) };
  await expect(prepareOutput({ ...cold, compileDecisionRows: async (...args) => {
    const built = await compiler(...args);
    return { ...built, rows: built.rows.map(row => { const changed = structuredClone(row); if (changed.id === original.script.id) changed.pages = 2; return changed; }) };
  } })).rejects.toThrow('life metadata is stale');
  const row = new TextEncoder().encode(JSON.stringify(original.script));
  for (const { files, message } of [
    { files: new Map<string, Uint8Array>(), message: 'Missing life bytes' },
    { files: new Map([['life.wasm', new Uint8Array([0])], ['life.json', row]]), message: 'Invalid or oversized module' },
    { files: new Map([['life.wasm', oracle], ['life.json', row], ['extra.wasm', oracle]]), message: 'Missing life bytes' },
    { files: new Map([['life.wasm', new Uint8Array(readFileSync('test/fixtures/pine-shelter-program.wasm'))], ['life.json', row]]), message: 'module differs from metadata' },
  ]) {
    await expect(prepareOutput({ ...context, cached: (step, generate) => step.id === 'life-program'
      ? Promise.resolve(files) : context.cached(step, generate) })).rejects.toThrow(message);
  }
});

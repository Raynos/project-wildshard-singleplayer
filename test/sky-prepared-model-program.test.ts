// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated source/cache fixture and compare original bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine input copies to this repository's scratch directory.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the complete 10 MB output without expanding assertion objects.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { prepareAssetDecoders } from '../src/format/product';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { PREPARED_MODEL_INPUTS, preparedModelProgram, preparedModelSource } from '../src/shards/far-reach/generators/preparedModelProgram';

const original = readFileSync('public/assets/far-reach/baked/prepared-models.glb');
const originalHash = 'bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580';
await prepareAssetDecoders();

test('owned cold geometry and persistent hits retain every original byte, part, bound and keeper pivot', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-prepared-program-')), source = resolve(scratch, 'source');
  const prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'prepared-models', native: true, inputs: PREPARED_MODEL_INPUTS });
      return ctx.cached(step, inputs => { builds++; return generate(inputs); });
    } };
  };
  const check = (bytes: Uint8Array): void => {
    expect(bytes.byteLength).toBe(10_134_100); expect(hashImmutableBytes(bytes)).toBe(originalHash);
    expect(Buffer.compare(bytes, original)).toBe(0);
  };
  try {
    for (const name of PREPARED_MODEL_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await preparedModelProgram(context()); check(cold); cold.fill(0);
    const hit = await preparedModelProgram(context()); check(hit); expect(builds).toBe(1);
    // An ignored GLB author label changes input identity without changing geometry.
    const keeper = resolve(source, 'models/keeper-hd/keeper-hd.glb'), changed = readFileSync(keeper);
    const label = changed.indexOf('glTF-Transform v4.5.0'); expect(label).not.toBe(-1);
    if (label === -1) throw new Error('Missing original keeper author label');
    changed[label] = 71; writeFileSync(keeper, changed);
    check(await preparedModelProgram(context())); expect(builds).toBe(2);
    check(await preparedModelProgram(context('b'))); expect(builds).toBe(3);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty or extra source/cache files refuse without a generated or public fallback', async () => {
  const inputs = new Map(PREPARED_MODEL_INPUTS.map(name => [name, new Uint8Array([1])]));
  const absent = new Map(inputs); absent.delete(PREPARED_MODEL_INPUTS[0] ?? '');
  const empty = new Map(inputs); empty.set(PREPARED_MODEL_INPUTS[0] ?? '', new Uint8Array());
  for (const bank of [absent, empty, new Map([...inputs, ['extra', new Uint8Array([1])]])]) {
    await expect(preparedModelSource(bank)).rejects.toThrow('Prepared model input inventory differs');
  }
  for (const files of [new Map<string, Uint8Array>(), new Map([['prepared-models.glb', new Uint8Array()]]),
    new Map([['prepared-models.glb', new Uint8Array([1])], ['extra', new Uint8Array([1])]])]) {
    await expect(preparedModelProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Prepared model cache inventory differs');
  }
});

test('the complete source/cache entry bundles without generated metadata or file services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/preparedModelProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing prepared-model source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.') || path.endsWith('/skyIsleFrames.json'))).toBe(false);
  }
});

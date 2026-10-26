// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated input/cache fixtures and compare original packed files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine explicit model inputs and cache files to repository scratch.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete native binaries without expanding assertion arrays.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { prepareAssetDecoders } from '../src/format/product';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { skyWorldPackSource, WORLD_PACK_FILES, WORLD_PACK_INPUTS } from '../src/shards/far-reach/generators/worldPackBytes';
import { skyWorldPackProgram } from '../src/shards/far-reach/generators/worldPackProgram';

await prepareAssetDecoders();

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(WORLD_PACK_FILES);
  for (const [name, bytes] of files) {
    const original = name.startsWith('baked/') ? `public/assets/far-reach/${name}` : `src/shards/far-reach/${name}`;
    expect(Buffer.compare(bytes, readFileSync(original)), name).toBe(0);
  }
};

test('native cold geometry and persistent hits retain every original compressed byte and ordered metadata row', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-world-packs-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'c'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'world-packs', native: true, inputs: WORLD_PACK_INPUTS });
      return ctx.cached(step, inputs => { builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of WORLD_PACK_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyWorldPackProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyWorldPackProgram(context())); expect(builds).toBe(1);
    const name = WORLD_PACK_INPUTS[0]; if (name === undefined) throw new Error('Missing original bridge input');
    const path = resolve(source, name.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
    if (label === -1) throw new Error('Missing original model author label');
    changed[label] = 71; writeFileSync(path, changed);
    check(await skyWorldPackProgram(context())); expect(builds).toBe(2);
    check(await skyWorldPackProgram(context('d'))); expect(builds).toBe(3);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra model or cache inventories refuse without a published-file fallback', async () => {
  const source = new Map(WORLD_PACK_INPUTS.map(name => [name, new Uint8Array([1])]));
  const missing = new Map(source), empty = new Map(source), first = WORLD_PACK_INPUTS[0];
  if (first === undefined) throw new Error('Missing original pack input');
  missing.delete(first); empty.set(first, new Uint8Array());
  for (const inputs of [missing, empty, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPackSource(inputs, bytes => bytes)).rejects.toThrow('Sky world pack input inventory differs');
  }
  const cached = new Map(WORLD_PACK_FILES.map(name => [name, new Uint8Array([1])])), absent = new Map(cached), blank = new Map(cached);
  const file = WORLD_PACK_FILES[0]; if (file === undefined) throw new Error('Missing original pack file');
  absent.delete(file); blank.set(file, new Uint8Array());
  for (const files of [absent, blank, new Map([...cached, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPackProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky world pack cache inventory differs');
  }
});

test.each(['worldPackBytes', 'worldPackProgram'])('%s bundles without generated imports or file/compiler services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing world pack source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

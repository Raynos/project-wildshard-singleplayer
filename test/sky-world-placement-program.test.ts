// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated model roots/cache fixtures and compare original metadata bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine native model fixtures to repository scratch and bind source bundles.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original JSON transport without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { WORLD_PLACEMENT_FILES, WORLD_PLACEMENT_INPUTS, skyWorldPlacementSource } from '../src/shards/far-reach/generators/worldPlacementBytes';
import { skyWorldPlacementProgram } from '../src/shards/far-reach/generators/worldPlacementProgram';

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(WORLD_PLACEMENT_FILES);
  for (const [name, bytes] of files) expect(Buffer.compare(bytes, readFileSync(`src/shards/far-reach/${name}`)), name).toBe(0);
};

test('cold and persistent hits preserve every original frame, pine and standalone/cell placement byte', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-world-placements-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'world-placements', native: true, inputs: WORLD_PLACEMENT_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(WORLD_PLACEMENT_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of WORLD_PLACEMENT_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyWorldPlacementProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyWorldPlacementProgram(context())); expect(builds).toBe(1);
    const first = WORLD_PLACEMENT_INPUTS[0]; if (first === undefined) throw new Error('Missing original island model');
    const path = resolve(source, first.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
    if (label === -1) throw new Error('Missing original model author label');
    changed[label] = 71; writeFileSync(path, changed);
    check(await skyWorldPlacementProgram(context())); expect(builds).toBe(2);
    check(await skyWorldPlacementProgram(context('b'))); expect(builds).toBe(3);
    await expect(skyWorldPlacementProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra source or cache inventories refuse without a generated metadata fallback', async () => {
  const source = new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array([1])]));
  const missing = new Map(source), empty = new Map(source), first = WORLD_PLACEMENT_INPUTS[0];
  if (first === undefined) throw new Error('Missing original island model');
  missing.delete(first); empty.set(first, new Uint8Array());
  for (const inputs of [missing, empty, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPlacementSource(inputs)).rejects.toThrow('Sky world placement input inventory differs');
  }
  const cached = new Map(WORLD_PLACEMENT_FILES.map(name => [name, new Uint8Array([1])])), absent = new Map(cached), blank = new Map(cached);
  const file = WORLD_PLACEMENT_FILES[0]; if (file === undefined) throw new Error('Missing original placement file');
  absent.delete(file); blank.set(file, new Uint8Array());
  for (const files of [absent, blank, new Map([...cached, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPlacementProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky world placement cache inventory differs');
  }
});

test.each(['worldPlacementBytes', 'worldPlacementProgram'])('%s bundles without generated imports or file/compiler services', async entry => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(`src/shards/far-reach/generators/${entry}.ts`), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing world placement source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

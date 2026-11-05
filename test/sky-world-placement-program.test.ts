// oxlint-disable-next-line import/no-nodejs-modules -- Read original model inputs and compare complete native metadata bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the current source module for its boundary check.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original JSON transport without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sharddev/configBoundary';
import { WORLD_PLACEMENT_FILES, WORLD_PLACEMENT_INPUTS, skyWorldPlacementSource } from '../src/shards/far-reach/generators/worldPlacementBytes';

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(WORLD_PLACEMENT_FILES);
  for (const [name, bytes] of files) expect(Buffer.compare(bytes, readFileSync(`src/shards/far-reach/${name}`)), name).toBe(0);
};

test('current placement source retains every original byte and ordered metadata row', async () => {
  const inputs = new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, Uint8Array.from(readFileSync(`public${name}`))]));
  check(await skyWorldPlacementSource(inputs));
});

test('missing, empty and extra source input inventories refuse without a generated metadata fallback', async () => {
  const source = new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array([1])]));
  const missing = new Map(source), empty = new Map(source), first = WORLD_PLACEMENT_INPUTS[0];
  if (first === undefined) throw new Error('Missing original island model');
  missing.delete(first); empty.set(first, new Uint8Array());
  for (const inputs of [missing, empty, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPlacementSource(inputs)).rejects.toThrow('Sky world placement input inventory differs');
  }
});

test.each(['worldPlacementBytes'])('%s bundles without generated imports or file/compiler services', async entry => {
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

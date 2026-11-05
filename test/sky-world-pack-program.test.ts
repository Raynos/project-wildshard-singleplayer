// oxlint-disable-next-line import/no-nodejs-modules -- Read original input bytes and compare complete native packed files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the current source module for its boundary check.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete native binaries without expanding assertion arrays.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { prepareAssetDecoders } from '@wildshard/format/product';
import { encodeBuildBytes } from '../src/sdk/bake/byteCodec';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyWorldPackSource, WORLD_PACK_FILES, WORLD_PACK_INPUTS } from '../src/shards/far-reach/generators/worldPackBytes';

await prepareAssetDecoders();

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(WORLD_PACK_FILES);
  for (const [name, bytes] of files) {
    const original = name.startsWith('baked/') ? `public/assets/far-reach/${name}` : `src/shards/far-reach/${name}`;
    expect(Buffer.compare(bytes, readFileSync(original)), name).toBe(0);
  }
};

test('current pack source retains every original byte and ordered metadata row', async () => {
  const inputs = new Map(WORLD_PACK_INPUTS.map(name => [name, Uint8Array.from(readFileSync(`public${name}`))]));
  check(await skyWorldPackSource(inputs, bytes => encodeBuildBytes(bytes, 'deflate', 9, 'native')));
});

test('missing, empty and extra model input inventories refuse without a published-file fallback', async () => {
  const source = new Map(WORLD_PACK_INPUTS.map(name => [name, new Uint8Array([1])]));
  const missing = new Map(source), empty = new Map(source), first = WORLD_PACK_INPUTS[0];
  if (first === undefined) throw new Error('Missing original pack input');
  missing.delete(first); empty.set(first, new Uint8Array());
  for (const inputs of [missing, empty, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyWorldPackSource(inputs, bytes => bytes)).rejects.toThrow('Sky world pack input inventory differs');
  }
});

test.each(['worldPackBytes'])('%s bundles without generated imports or file/compiler services', async entry => {
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

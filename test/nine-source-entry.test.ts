// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual author entry and source modules in its bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import entry, { generate } from '../src/shards/nine-dragon-stack/shard.config';
import product from '../src/shards/nine-dragon-stack/generators/product';
import { generated } from './fixtures/nine-source-program';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';

test('the source entry owns both outputs and preserves the complete original declaration', () => {
  expect(entry).toBe(generate);
  expect(generated.shard).toEqual(product);
  const bytes = new TextEncoder().encode(encodeCanonicalJson(generated.shard));
  expect(bytes.length).toBe(734805);
  expect(hashImmutableBytes(bytes)).toBe('c80c8026c7662c9bc3dff769ce6d5306d0cd5b573558128c6d02aa9ac94c0562');
  const mover = generated.output.namedFiles.find(row => row.name === 'views/movers.wasm');
  expect(mover).toMatchObject({ compressed: 4859, hash: '3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276' });
});

test('the real import closure seals source helpers without a manual scheduler root list', async () => {
  const options = { configFile: false as const, logLevel: 'silent' as const, build: { write: false as const, minify: false as const,
    lib: { entry: resolve('src/shards/nine-dragon-stack/shard.config.ts'), formats: ['es' as const] } } };
  await expect(build({ ...options, plugins: [{ name: 'missing-source-helper', enforce: 'pre',
    resolveId(source) { if (source === './moversProgram') throw new Error('Missing source helper moversProgram'); } }] })).rejects.toThrow('Missing source helper moversProgram');
  const result = await build(options), built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing Nine entry bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    for (const name of ['moversProgram.ts', 'nativeDecals.ts', 'entryProof.ts']) {
      expect(Object.keys(chunk.modules).some(path => path.endsWith(`/generators/${name}`)), name).toBe(true);
    }
  }
});

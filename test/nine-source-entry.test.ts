// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual author entry and source modules in its bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import entry, { generate } from '../src/shards/nine-dragon-stack/shard.config';
import product from './fixtures/nine-product-inputs';
import { generated } from './fixtures/nine-source-program';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { generatedProjectMap, packProjectMap } from '../src/sdk/projectMap';

test('the source entry owns both outputs and preserves the complete original declaration', () => {
  expect(entry).toBe(generate);
  expect(generated.shard).toEqual(product);
  const bytes = new TextEncoder().encode(encodeCanonicalJson(generated.shard));
  expect(bytes.length).toBe(734805);
  expect(hashImmutableBytes(bytes)).toBe('c80c8026c7662c9bc3dff769ce6d5306d0cd5b573558128c6d02aa9ac94c0562');
  const mover = generated.output.namedFiles.find(row => row.name === 'views/movers.wasm');
  expect(mover).toMatchObject({ compressed: 4859, hash: '3548c07ed2ac758a530cb973e7fe45962f084a76135701152486ffdb013bb276' });
});

test('the actual source entry publishes the original charged map and logical image name', async () => {
  expect(generated.map?.name).toBe('ui/images/map');
  const { map } = await generatedProjectMap(generated.map, 'f'.repeat(64));
  expect(map.bytes.byteLength).toBe(16556);
  expect(hashImmutableBytes(map.bytes)).toBe('cbc4ca4ed3a0f116cd9d80adf2786e999e5e98c97ae9eea6dd0995d0da4d4e40');
  const packed = packProjectMap(generated.shard, map), image = packed.shard.files.find(file => file.hash === packed.hash);
  expect(image).toEqual({ hash: packed.hash, kind: 'image', compressed: 16556, decoded: 4066224, gpu: 4000000,
    triangles: 0, draws: 0, dependencies: [], critical: false });
  expect(packed.shard.map).toEqual({ image: packed.hash, tilesHash: 'f'.repeat(64) });
  expect(packed.shard.library).toContain(packed.hash);
});

test('the real import closure seals source helpers without a manual scheduler root list', async () => {
  const options = { configFile: false as const, logLevel: 'silent' as const, build: { write: false as const, minify: false as const,
    lib: { entry: resolve('src/shards/nine-dragon-stack/shard.config.ts'), formats: ['es' as const] }, rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } };
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

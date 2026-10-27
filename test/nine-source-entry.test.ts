// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual author entry and source modules in its bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import entry, { generate } from '../src/shards/nine-dragon-stack/shard.config';
import product from './fixtures/nine-product-inputs';
import { expectNineDeclaration } from './fixtures/nine-declaration-pins';
import { generated } from './fixtures/nine-source-program';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { generatedProjectMap, packProjectMap } from '../src/sdk/projectMap';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { admitScriptContract } from '../src/format/scriptContract';
import { parseFixedPractice } from '../src/shards/nine-dragon-stack/generators/sections';

test('the source entry owns both outputs and preserves the complete original declaration', () => {
  expect(entry).toBe(generate);
  expect(generated.shard).toEqual(product);
  expectNineDeclaration(generated.shard);
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

test('the source entry shares one admitted practice contract across raw output and scene/controller rows', () => {
  const output = generated.output, module = output.namedFiles.find(file => file.name === 'behaviour/practice.wasm');
  expect(module).toEqual({ name: 'behaviour/practice.wasm', kind: 'wasm',
    path: 'blobs/wasm/6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102.wasm',
    hash: '6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102', compressed: 9786, decoded: 9786,
    gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  if (module === undefined) throw new Error('Missing owned practice module');
  const binary = output.assets.get(module.hash), rows = output.platform.files.get('sections/actors/return-scripts.json');
  const fixed = output.namedFiles.find(file => file.name === 'geometry/fixed-kits.json');
  if (binary === undefined || rows === undefined || fixed === undefined) throw new Error('Missing owned practice output');
  const sceneBytes = output.assets.get(fixed.hash);
  if (sceneBytes === undefined) throw new Error('Missing owned practice scene');
  expect(binary.byteLength).toBe(9786); expect(hashImmutableBytes(binary)).toBe(module.hash);
  expect(() => admitScriptContract(binary, { abi: 1, pages: 1 })).not.toThrow();
  const scripts = parseDecisionScripts(JSON.parse(new TextDecoder().decode(rows)));
  expect(scripts).toHaveLength(1);
  const script = scripts[0]; if (script === undefined) throw new Error('Missing owned practice contract');
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ script })))).toBe('9127647ac9e42b887da2e4affd59f7e74e3a2d9c9e22263fa35991c20675e8a9');
  expect(parseFixedPractice(JSON.parse(new TextDecoder().decode(sceneBytes))).practice.program).toEqual({ script, bytes: '' });
  expect(output.blobs.some(file => file.source.includes('practice.generated'))).toBe(false);
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
    for (const name of ['moversProgram.ts', 'nativeDecals.ts', 'entryProof.ts', 'practiceProgram.ts']) {
      expect(Object.keys(chunk.modules).some(path => path.endsWith(`/generators/${name}`)), name).toBe(true);
    }
  }
});

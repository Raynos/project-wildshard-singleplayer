// oxlint-disable-next-line import/no-nodejs-modules -- Check the actual author entry and source modules in its bundle.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { generated } from './fixtures/nine-source-program';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { admitScriptContract } from '../src/format/scriptContract';
import { parseFixedPractice } from '../src/shards/nine-dragon-stack/generators/sections';

test('the source entry shares one admitted practice contract across raw output and scene/controller rows', () => {
  const output = generated.output, module = output.namedFiles.find(file => file.name === 'behaviour/practice.wasm');
  expect(module).toMatchObject({ name: 'behaviour/practice.wasm', kind: 'wasm', critical: true });
  if (module === undefined) throw new Error('Missing owned practice module');
  const binary = output.assets.get(module.hash), rows = output.platform.files.get('sections/actors/return-scripts.json');
  const fixed = output.namedFiles.find(file => file.name === 'geometry/fixed-kits.json');
  if (binary === undefined || rows === undefined || fixed === undefined) throw new Error('Missing owned practice output');
  const sceneBytes = output.assets.get(fixed.hash);
  if (sceneBytes === undefined) throw new Error('Missing owned practice scene');
  expect(binary.byteLength).toBe(module.compressed); expect(hashImmutableBytes(binary)).toBe(module.hash);
  expect(() => admitScriptContract(binary, { abi: 1, pages: 1 })).not.toThrow();
  const scripts = parseDecisionScripts(JSON.parse(new TextDecoder().decode(rows)));
  expect(scripts).toHaveLength(1);
  const script = scripts[0]; if (script === undefined) throw new Error('Missing owned practice contract');
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

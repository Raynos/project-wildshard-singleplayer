// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated model roots/cache fixtures and compare original metadata bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine native model fixtures to repository scratch and bind source bundles.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { BRIDGE_REST_FILES, BRIDGE_REST_INPUTS, skyBridgeRestSource, skyBridgeRestProgram } from '../src/shards/far-reach/generators/bridgeRestProgram';

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(BRIDGE_REST_FILES);
  for (const [name, bytes] of files) {
    if (name === 'bridge-rest.glb') {
      expect(bytes.byteLength).toBe(2_109_968);
      expect(hashImmutableBytes(bytes)).toBe('1a31cb2c7b426d9ffb14db4e39792aeb0bde86f6f01d0b1796130a3a0c7d8bf0');
    }
    else {
      expect(bytes.byteLength).toBe(59_699);
      expect(hashImmutableBytes(bytes)).toBe('ae5faee1125143aa75aa053cfbd418f9899c1b1a9907b617280a97e00c538bb4');
    }
  }
};

test('cold and persistent bridge hits preserve every original native geometry and hierarchy byte', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-bridge-rest-program-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'bridge-rest', native: true, inputs: BRIDGE_REST_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(BRIDGE_REST_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of BRIDGE_REST_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyBridgeRestProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyBridgeRestProgram(context())); expect(builds).toBe(1);
    const first = BRIDGE_REST_INPUTS[0]; if (first === undefined) throw new Error('Missing original bridge deck');
    const path = resolve(source, first.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
    if (label === -1) throw new Error('Missing original model author label');
    changed[label] = 71; writeFileSync(path, changed);
    check(await skyBridgeRestProgram(context())); expect(builds).toBe(2);
    check(await skyBridgeRestProgram(context('b'))); expect(builds).toBe(3);
    await expect(skyBridgeRestProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra source or cache inventories refuse without a physical geometry or metadata fallback', async () => {
  const source = new Map(BRIDGE_REST_INPUTS.map(name => [name, new Uint8Array([1])]));
  const missing = new Map(source), empty = new Map(source), first = BRIDGE_REST_INPUTS[0];
  if (first === undefined) throw new Error('Missing original bridge deck');
  missing.delete(first); empty.set(first, new Uint8Array());
  for (const inputs of [missing, empty, new Map([...source, ['extra', new Uint8Array([1])]])]) {
    await expect(skyBridgeRestSource(inputs)).rejects.toThrow('Sky bridge rest input inventory differs');
  }
  const cached = new Map(BRIDGE_REST_FILES.map(name => [name, new Uint8Array([1])])), absent = new Map(cached), blank = new Map(cached);
  const file = BRIDGE_REST_FILES[0]; if (file === undefined) throw new Error('Missing original bridge rest file');
  absent.delete(file); blank.set(file, new Uint8Array());
  for (const files of [absent, blank, new Map([...cached, ['extra', new Uint8Array([1])]])]) {
    await expect(skyBridgeRestProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky bridge rest cache inventory differs');
  }
});

test('bridge source and cache bundle without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/bridgeRestProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing bridge rest source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

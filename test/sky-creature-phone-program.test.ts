// oxlint-disable-next-line import/no-nodejs-modules -- Explicit native source/cache fixtures use complete immutable shipped byte oracles.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all cache fixture paths inside the checkout.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { CREATURE_RIG_INPUTS } from '../src/shards/far-reach/generators/creatureRigProgram';
import { CREATURE_PHONE_FILE, skyCreaturePhoneSource, skyCreaturePhoneProgram, type CreaturePhoneEncoder } from '../src/shards/far-reach/generators/creaturePhoneProgram';

const original = readFileSync('public/assets/gpu/far-reach/rigs/storm-roc-70e5655f.glb');
const originalHash = '70e5655f969dfb40edba0109d16d7baddc6faef7bede8d10d91c2e2661f7d8ad';
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Missing fixture object');
  return value as Record<string, unknown>;
};
function paint(): Uint8Array {
  const header = new DataView(original.buffer, original.byteOffset, original.byteLength), n = header.getUint32(12, true);
  const doc = object(JSON.parse(new TextDecoder().decode(original.subarray(20, 20 + n)))), images = doc['images'], views = doc['bufferViews'];
  if (!Array.isArray(images) || !Array.isArray(views)) throw new Error('Missing original paint');
  const id = object(images[0])['bufferView'];
  if (typeof id !== 'number') throw new Error('Missing original image view');
  const view = object(views[id]), offset = view['byteOffset'], size = view['byteLength'];
  if (typeof offset !== 'number' || typeof size !== 'number') throw new Error('Missing original image range');
  return new Uint8Array(original.subarray(28 + n + offset, 28 + n + offset + size));
}
function encoder(identity = 'a'.repeat(64)): CreaturePhoneEncoder {
  return { identity, encode: input => {
    expect(hashImmutableBytes(input.bytes)).toBe('b733672394bcaa39db2cce16e8abe160e7784ad4a1a3c999df6fcd769ed4df7f');
    return paint();
  } };
}
function check(files: ReadonlyMap<string, Uint8Array>): void {
  expect([...files.keys()]).toEqual([CREATURE_PHONE_FILE]);
  const bytes = files.get(CREATURE_PHONE_FILE);
  if (bytes === undefined) throw new Error('Missing phone rig');
  expect(bytes.byteLength).toBe(2_053_504); expect(hashImmutableBytes(bytes)).toBe(originalHash);
}

test('the source owns the full original phone GLB from the three native models and injected paint encoder', async () => {
  const source = new Map<string, Uint8Array>(CREATURE_RIG_INPUTS.map(name => [name, readFileSync(`public${name}`)]));
  check(await skyCreaturePhoneSource(source, encoder()));
  for (const name of CREATURE_RIG_INPUTS) {
    const missing = new Map(source), empty = new Map(source); missing.delete(name); empty.set(name, new Uint8Array());
    await expect(skyCreaturePhoneSource(missing, encoder())).rejects.toThrow('Sky creature rig input inventory differs');
    await expect(skyCreaturePhoneSource(empty, encoder())).rejects.toThrow('Sky creature rig input inventory differs');
  }
  await expect(skyCreaturePhoneSource(new Map([...source, ['/foreign.glb', new Uint8Array([1])]]), encoder())).rejects.toThrow('Sky creature rig input inventory differs');
});

test('cold and persistent cache hits detach bytes and rekey every native source, program and encoder', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-phone-cache-')), directory = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (program = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), program.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory }]);
    return { cached: (step, generate) => {
      expect(step.native).toBe(true); expect(step.inputs).toEqual(CREATURE_RIG_INPUTS);
      return ctx.cached(step, inputs => { builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of CREATURE_RIG_INPUTS) {
      const path = resolve(directory, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyCreaturePhoneProgram(context(), encoder()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyCreaturePhoneProgram(context(), encoder())); expect(builds).toBe(1);
    for (const [index, name] of CREATURE_RIG_INPUTS.entries()) {
      const path = resolve(directory, name.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
      if (label === -1) throw new Error('Missing native author label');
      changed[label] = 71; writeFileSync(path, changed);
      check(await skyCreaturePhoneProgram(context(), encoder())); expect(builds).toBe(index + 2);
    }
    check(await skyCreaturePhoneProgram(context('b'), encoder())); expect(builds).toBe(5);
    check(await skyCreaturePhoneProgram(context('b'), encoder('b'.repeat(64)))); expect(builds).toBe(6);
    for (const name of CREATURE_RIG_INPUTS) {
      const path = resolve(directory, name.slice(prefix.length)), bytes = readFileSync(path); unlinkSync(path);
      await expect(skyCreaturePhoneProgram(context(), encoder())).rejects.toThrow();
      writeFileSync(path, bytes);
    }
    expect(builds).toBe(6);
    await expect(skyCreaturePhoneProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch), encoder()))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('an exact encoder identity is mandatory even when a cache adapter offers an existing result', async () => {
  let calls = 0;
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: () => { calls++; return Promise.resolve(new Map([[CREATURE_PHONE_FILE, original]])); } };
  for (const identity of ['', 'basisu', 'a'.repeat(63), 'A'.repeat(64)]) {
    await expect(skyCreaturePhoneProgram(ctx, encoder(identity))).rejects.toThrow('Sky phone encoder needs an exact tool/recipe identity');
  }
  expect(calls).toBe(0);
  for (const files of [new Map<string, Uint8Array>(), new Map([[CREATURE_PHONE_FILE, new Uint8Array()]]), new Map([[CREATURE_PHONE_FILE, original], ['foreign.glb', original]])]) {
    await expect(skyCreaturePhoneProgram({ cached: () => Promise.resolve(files) }, encoder())).rejects.toThrow('Sky phone rig cache inventory differs');
  }
});

test('the source/cache remains a config-safe chunk with no native build adapter or generated imports', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/creaturePhoneProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing source/cache bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect([...chunk.imports, ...chunk.dynamicImports].filter(name => name !== chunk.fileName)).toEqual([]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

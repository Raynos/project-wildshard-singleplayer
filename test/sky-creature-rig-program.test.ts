// oxlint-disable-next-line import/no-nodejs-modules -- Confine native input/cache fixtures and compare complete original GLBs.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native roots, bundles and sealed-driver scratch inside the checkout.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { originalSkyRigs } from './fixtures/sky-original-rigs';
import { CREATURE_RIG_INPUTS, CREATURE_RIG_FILES, skyCreatureRigSource, skyCreatureRigProgram } from '../src/shards/far-reach/generators/creatureRigProgram';

const originals: Readonly<Record<string, readonly [number, string]>> = {
  'storm-roc.glb': [492_772, '1c057979c81e5fafd2f97a151b7936c90ccf01555b2f307b911fc628e7c19af0'],
  'sky-goat.glb': [94_368, 'bb8ab3271fb98f8c6684f14771d8cb5c7a77b3ba2646087fe0956db18da9c018'],
  'drift-ray.glb': [74_448, 'd0f39e6fa142c5f12c9949e6ba91f6bc621cd8bfaa8c2c327650f05439a56020'],
  'gale-wisp.glb': [10_132, '55467d69a6f7144ba38a06a7f917a3de09d30a44e9c9e1729a6e520af2d6be31'],
};
function check(files: ReadonlyMap<string, Uint8Array>): void {
  expect([...files.keys()]).toEqual(CREATURE_RIG_FILES);
  for (const [name, bytes] of files) {
    const original = originals[name]; if (original === undefined) throw new Error('Unexpected creature rig');
    expect(bytes.byteLength, name).toBe(original[0]);
    expect(hashImmutableBytes(bytes), name).toBe(original[1]);
  }
}

test('all four original rigs preserve complete geometry, skins, bones, metadata and embedded Roc paint', async () => {
  const inputs = new Map(CREATURE_RIG_INPUTS.map(name => [name, readFileSync(`public${name}`)]));
  const first = await skyCreatureRigSource(inputs), retained = originalSkyRigs(); check(first);
  for (const [name, expected] of Object.entries(originals)) {
    const original = retained.get(name);
    if (original === undefined) throw new Error('Missing original rig oracle');
    expect(hashImmutableBytes(original)).toBe(expected[1]);
  }
  for (const bytes of first.values()) bytes.fill(0);
  check(await skyCreatureRigSource(inputs));
});

test('native cold/cache hits detach bytes and rekey each source model and the full author program', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-creature-rigs-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'creature-rigs', native: true, inputs: CREATURE_RIG_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(CREATURE_RIG_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of CREATURE_RIG_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyCreatureRigProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyCreatureRigProgram(context())); expect(builds).toBe(1);
    for (const [index, name] of CREATURE_RIG_INPUTS.entries()) {
      const path = resolve(source, name.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
      if (label === -1) throw new Error('Missing original model author label');
      changed[label] = 71; writeFileSync(path, changed);
      check(await skyCreatureRigProgram(context())); expect(builds).toBe(index + 2);
    }
    check(await skyCreatureRigProgram(context('b'))); expect(builds).toBe(5);
    await expect(skyCreatureRigProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra input or cache inventories refuse without public rig fallback', async () => {
  const source = new Map(CREATURE_RIG_INPUTS.map(name => [name, new Uint8Array([1])]));
  for (const name of CREATURE_RIG_INPUTS) {
    const missing = new Map(source), empty = new Map(source); missing.delete(name); empty.set(name, new Uint8Array());
    for (const files of [missing, empty]) await expect(skyCreatureRigSource(files)).rejects.toThrow('Sky creature rig input inventory differs');
  }
  await expect(skyCreatureRigSource(new Map([...source, ['foreign', new Uint8Array([1])]]))).rejects.toThrow('Sky creature rig input inventory differs');
  const cached = new Map(CREATURE_RIG_FILES.map(name => [name, new Uint8Array([1])]));
  for (const name of CREATURE_RIG_FILES) {
    const missing = new Map(cached), empty = new Map(cached); missing.delete(name); empty.set(name, new Uint8Array());
    for (const files of [missing, empty]) await expect(skyCreatureRigProgram({ cached: () => Promise.resolve(files) }))
      .rejects.toThrow('Sky creature rig cache inventory differs');
  }
  await expect(skyCreatureRigProgram({ cached: () => Promise.resolve(new Map([...cached, ['foreign', new Uint8Array([1])]])) }))
    .rejects.toThrow('Sky creature rig cache inventory differs');
});

test('the source/cache bundles without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/creatureRigProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing creature rig source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test('the active cold native source preserves all four originals with no public rig handoffs', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-rigs-retired-')), native = resolve(scratch, 'native'), prefix = '/assets/far-reach/';
  try {
    for (const input of CREATURE_RIG_INPUTS) {
      const file = resolve(native, input.slice(prefix.length)); mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, readFileSync(`public${input}`));
    }
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: native }]);
    check(await skyCreatureRigProgram(ctx));
    for (const name of CREATURE_RIG_FILES) expect(existsSync(resolve(native, 'rigs', name)), name).toBe(false);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test.each(CREATURE_RIG_INPUTS)('the active native cache refuses omitted source %s even on a warmed hit', async input => {
  const scratch = mkdtempSync(resolve('tmp/sky-rigs-omitted-')), native = resolve(scratch, 'native'), prefix = '/assets/far-reach/';
  try {
    for (const source of CREATURE_RIG_INPUTS) {
      const file = resolve(native, source.slice(prefix.length)); mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, readFileSync(`public${source}`));
    }
    const context = () => createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: native }]);
    check(await skyCreatureRigProgram(context()));
    rmSync(resolve(native, input.slice(prefix.length)));
    await expect(skyCreatureRigProgram(context())).rejects.toThrow('ENOENT');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the rig scheduler and every handoff reader retire with complete original byte oracles', () => {
  for (const job of discoverGeneration(resolve('.')).jobs) {
    expect(job.id).not.toBe('sky-rigs');
    for (const name of CREATURE_RIG_FILES) {
      const file = `public/assets/far-reach/rigs/${name}`;
      expect(job.outputs, job.id).not.toContain(file);
      expect(job.inputRoots, job.id).not.toContain(file);
    }
  }
  expect(readdirSync('src/shards/far-reach/generators')).not.toContain('bake-sky-rigs.mjs');
  const retained = originalSkyRigs();
  for (const [name, original] of Object.entries(originals)) {
    const bytes = retained.get(name);
    if (bytes === undefined) throw new Error('Missing original rig oracle');
    expect(hashImmutableBytes(bytes), name).toBe(original[1]);
  }
});

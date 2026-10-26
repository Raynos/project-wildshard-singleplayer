// oxlint-disable-next-line import/no-nodejs-modules -- Confine native input/cache fixtures and compare complete original GLBs.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep native roots, bundles and sealed-driver scratch inside the checkout.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
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
  const first = await skyCreatureRigSource(inputs); check(first);
  for (const [name, expected] of Object.entries(originals)) {
    expect(hashImmutableBytes(readFileSync(`public/assets/far-reach/rigs/${name}`))).toBe(expected[1]);
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

test('the real retained cold sealed writer preserves all three declared original outputs', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-rigs');
  if (job === undefined) throw new Error('Missing retained creature writer');
  const cacheDir = mkdtempSync(resolve('tmp/sky-rigs-sealed-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hit).toBe(false);
      expect(result.hashes).toEqual(Object.fromEntries(job.outputs.map(path => {
        const name = path.slice(path.lastIndexOf('/') + 1), original = originals[name];
        if (original === undefined) throw new Error('Unexpected scheduled creature output');
        return [path, original[1]];
      })));
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

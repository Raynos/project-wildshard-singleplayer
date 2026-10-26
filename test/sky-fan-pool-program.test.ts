// oxlint-disable-next-line import/no-nodejs-modules -- Own confined native model/cache fixtures and verify original complete bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all native and sealed-driver scratch inside the repository.
import { dirname, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { FAN_POOL_INPUTS, skyFanPoolSource, skyFanPoolProgram } from '../src/shards/far-reach/generators/fanPoolProgram';

const originalHash = '5f5a9a056455af528c872807359347ee60007990dc6854e36f54f2e8db5b86d1';
const check = (bytes: Uint8Array): void => {
  expect(bytes.byteLength).toBe(683_792);
  expect(hashImmutableBytes(bytes)).toBe(originalHash);
};

test('cold and persistent fan hits preserve every original shape, fitted hand, UV and tassel byte', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-fan-pool-program-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'fan-pool', native: true, inputs: FAN_POOL_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(FAN_POOL_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    const name = FAN_POOL_INPUTS[0]; if (name === undefined) throw new Error('Missing original fan input');
    const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, readFileSync(`public${name}`));
    const cold = await skyFanPoolProgram(context()); check(cold); cold.fill(0);
    check(await skyFanPoolProgram(context())); expect(builds).toBe(1);
    const changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
    if (label === -1) throw new Error('Missing original hand author label');
    changed[label] = 71; writeFileSync(path, changed);
    check(await skyFanPoolProgram(context())); expect(builds).toBe(2);
    check(await skyFanPoolProgram(context('b'))); expect(builds).toBe(3);
    await expect(skyFanPoolProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra native input or cached geometry inventories refuse without a loose-file fallback', async () => {
  await expect(skyFanPoolSource(new Map())).rejects.toThrow('Sky fan pool input inventory differs');
  await expect(skyFanPoolSource(new Map(FAN_POOL_INPUTS.map(name => [name, new Uint8Array()]))))
    .rejects.toThrow('Sky fan pool input inventory differs');
  await expect(skyFanPoolSource(new Map([...FAN_POOL_INPUTS.map(name => [name, new Uint8Array([1])] as const), ['extra', new Uint8Array([1])]])))
    .rejects.toThrow('Sky fan pool input inventory differs');
  for (const files of [new Map<string, Uint8Array>(), new Map([['fan.glb', new Uint8Array()]]),
    new Map([['fan.glb', new Uint8Array([1])], ['extra', new Uint8Array([1])]])]) {
    await expect(skyFanPoolProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky fan pool cache inventory differs');
  }
});

test('fan source and cache bundle without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/fanPoolProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing fan pool source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test('the retained cold sealed fan writer preserves its complete original output before reader migration', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-held-fan-pool');
  if (job === undefined) throw new Error('Missing retained fan writer');
  const cacheDir = mkdtempSync(resolve('tmp/sky-fan-writer-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ 'public/assets/far-reach/baked/fan.glb': originalHash }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the actual sealed fan writer refuses its omitted native hand model', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-held-fan-pool');
  if (job === undefined) throw new Error('Missing retained fan writer');
  const model = FAN_POOL_INPUTS[0]; if (model === undefined) throw new Error('Missing fan hand input');
  const input = `public${model}`; expect(job.inputRoots).toContain(input);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== input) }, cacheDir = mkdtempSync(resolve('tmp/sky-fan-omitted-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: 'generation-jobs/1', notice: 'Native fan hand omission', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated model roots/cache fixtures and compare original metadata bytes.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine native model fixtures to repository scratch and bind source bundles.
import { dirname, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { build } from 'vite';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { MILL_REST_FILES, MILL_REST_INPUTS, skyMillRestSource, skyMillRestProgram } from '../src/shards/far-reach/generators/millRestProgram';

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(MILL_REST_FILES);
  for (const [name, bytes] of files) {
    if (name === 'mill-rest.glb') {
      expect(bytes.byteLength).toBe(1_828_044);
      expect(hashImmutableBytes(bytes)).toBe('3b12beff5b5ae8fbb51433b27890591e85bdc9049dd999e19cc4700400603b37');
    }
    else {
      expect(bytes.byteLength).toBe(83);
      expect(hashImmutableBytes(bytes)).toBe('7dabe8b463afae68e7070cbb94d9e2fd77a0744c8fc47889437d0c24a9f24913');
    }
  }
};

test('cold and persistent mill hits preserve every original tower, foot, UV and pool byte', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-mill-rest-program-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'mill-rest', native: true, inputs: MILL_REST_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(MILL_REST_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of MILL_REST_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyMillRestProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyMillRestProgram(context())); expect(builds).toBe(1);
    for (const [index, name] of MILL_REST_INPUTS.entries()) {
      const path = resolve(source, name.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
      if (label === -1) throw new Error('Missing original model author label');
      changed[label] = 71; writeFileSync(path, changed);
      check(await skyMillRestProgram(context())); expect(builds).toBe(index + 2);
    }
    check(await skyMillRestProgram(context('b'))); expect(builds).toBe(4);
    await expect(skyMillRestProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra source or cache inventories refuse without a physical geometry or metadata fallback', async () => {
  const source = new Map(MILL_REST_INPUTS.map(name => [name, new Uint8Array([1])]));
  for (const name of MILL_REST_INPUTS) {
    const missing = new Map(source), empty = new Map(source);
    missing.delete(name); empty.set(name, new Uint8Array());
    for (const inputs of [missing, empty]) await expect(skyMillRestSource(inputs)).rejects.toThrow('Sky mill rest input inventory differs');
  }
  await expect(skyMillRestSource(new Map([...source, ['extra', new Uint8Array([1])]]))).rejects.toThrow('Sky mill rest input inventory differs');
  const cached = new Map(MILL_REST_FILES.map(name => [name, new Uint8Array([1])]));
  for (const name of MILL_REST_FILES) {
    const absent = new Map(cached), blank = new Map(cached);
    absent.delete(name); blank.set(name, new Uint8Array());
    for (const files of [absent, blank]) await expect(skyMillRestProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky mill rest cache inventory differs');
  }
  await expect(skyMillRestProgram({ cached: () => Promise.resolve(new Map([...cached, ['extra', new Uint8Array([1])]])) }))
    .rejects.toThrow('Sky mill rest cache inventory differs');
});

test('mill source and cache bundle without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/millRestProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing mill rest source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

const writers = [
  { id: 'sky-mill-rest-glb', path: 'public/assets/far-reach/baked/mill-rest.glb', hash: '3b12beff5b5ae8fbb51433b27890591e85bdc9049dd999e19cc4700400603b37' },
  { id: 'sky-mill-rest-rows', path: 'src/shards/far-reach/data/millRest.generated.json', hash: '7dabe8b463afae68e7070cbb94d9e2fd77a0744c8fc47889437d0c24a9f24913' },
];

test.each(writers)('$id retains its complete original cold sealed output before reader migration', async ({ id, path, hash }) => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained mill writer ${id}`);
  const cacheDir = mkdtempSync(resolve('tmp/sky-mill-writer-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [path]: hash }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test.each(MILL_REST_INPUTS)('actual sealed mill geometry refuses omitted native model %s', async name => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-mill-rest-glb');
  if (job === undefined) throw new Error('Missing retained mill geometry writer');
  const input = `public${name}`, publicRoot = 'public/assets/far-reach'; expect(job.inputRoots).toContain(publicRoot);
  const nativeFiles = readdirSync(resolve(root, publicRoot), { recursive: true, encoding: 'utf8' }).map(file => `${publicRoot}/${file}`)
    .filter(file => statSync(resolve(root, file)).isFile() && !job.outputs.includes(file) && file !== input);
  const omitted = { ...job, inputRoots: [...job.inputRoots.filter(path => path !== publicRoot), ...nativeFiles] }, cacheDir = mkdtempSync(resolve('tmp/sky-mill-omitted-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT native mill model omission',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

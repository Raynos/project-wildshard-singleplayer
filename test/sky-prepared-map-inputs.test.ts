// oxlint-disable-next-line import/no-nodejs-modules -- Own the isolated sealed cache and compare complete original map bytes.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omission catalogues and producer outputs to repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete encoded images without expanding assertion objects.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Match the original native level-nine pack writer byte for byte.
import { deflateSync } from 'node:zlib';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyMapWorldSources } from '../src/shards/far-reach/generators/mapWorldSources';
import { BAKED_PIECES } from '../src/shards/far-reach/generators/fileInventory';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { MILL_REST_INPUTS } from '../src/shards/far-reach/generators/millRestProgram';
import { PREPARED_MODEL_INPUTS } from '../src/shards/far-reach/generators/preparedModelProgram';

const handoff = 'public/assets/far-reach/baked/prepared-models.glb';
const image = 'public/assets/far-reach/map/top.webp';
const hash = 'a4d2c58042946dc131c67027993aa567121d45bab1e33759248acb8aa704728d';
const worldHandoffs = [...BAKED_PIECES.map(piece => `../../../public/assets/far-reach/baked/${piece}.glb`),
  '../../../public/assets/far-reach/baked/isles.bin', 'data/isles.json', 'data/geometries.json'];
const millHandoffs = ['public/assets/far-reach/baked/mill-rest.glb', 'src/shards/far-reach/data/millRest.generated.json'];
const bridgeHandoffs = ['public/assets/far-reach/baked/bridge-rest.glb', 'src/shards/far-reach/data/bridgeRest.generated.json'];
const rootPath = (file: string): string => file.startsWith('../../../public/') ? file.slice(9) : `src/shards/far-reach/${file}`;

test('the sealed map owns all prepared-model inputs and retains every original image byte without the public GLB', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  expect(job.inputRoots).not.toContain(handoff);
  for (const file of [...bridgeHandoffs, ...millHandoffs]) expect(job.inputRoots).not.toContain(file);
  for (const file of worldHandoffs) expect(job.inputRoots).not.toContain(rootPath(file));
  for (const url of [...PREPARED_MODEL_INPUTS, ...MILL_REST_INPUTS]) expect(job.inputRoots).toContain(`public${url}`);
  mkdirSync('tmp', { recursive: true });
  const cacheDir = mkdtempSync(resolve('tmp/sky-map-source-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      for (const file of worldHandoffs) expect(existsSync(resolve(result.directory, rootPath(file))), file).toBe(false);
      for (const file of [...bridgeHandoffs, ...millHandoffs]) expect(existsSync(resolve(result.directory, file)), file).toBe(false);
      expect(result.hit).toBe(false);
      expect(result.hashes[image]).toBe(hash);
      expect(existsSync(resolve(result.directory, handoff))).toBe(false);
      const actual = readFileSync(resolve(result.directory, image));
      expect(actual.byteLength).toBe(17_566);
      expect(hashImmutableBytes(actual)).toBe(hash);
      expect(Buffer.compare(actual, readFileSync(image))).toBe(0);
      const stamp: unknown = JSON.parse(readFileSync(resolve(result.directory, 'src/shards/far-reach/look/map.baked.json'), 'utf8'));
      expect(stamp).toMatchObject({ pixelHash: '39a0770cfbeebbf625bcb62fed48113a2c37ea436467fb9cfa1339c5912c420a',
        image: '/assets/far-reach/map/top.webp', size: 1000, metres: 500, north: '+z', east: '-x', style: 'data:void', bytes: 17_566 });
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the real sealed map refuses an omitted original model rather than using the retained public geometry', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  const source = 'public/assets/far-reach/fan/hand-hd.glb';
  expect(job.inputRoots).toContain(source);
  mkdirSync('tmp', { recursive: true });
  const cacheDir = mkdtempSync(resolve('tmp/sky-map-omitted-'));
  try {
    const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1',
      notice: 'DO NOT EDIT isolated omission fixture', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});


test('owned map world inputs preserve every original native payload and metadata without stored handoffs', () => {
  const settings: unknown = JSON.parse(readFileSync('src/shards/far-reach/look/map.json', 'utf8'));
  expect(settings).toHaveProperty('inputs');
  if (typeof settings !== 'object' || settings === null || !('inputs' in settings) || !Array.isArray(settings.inputs)) {
    throw new Error('Missing map input authority');
  }
  expect(settings.inputs).not.toContain('data/millRest.generated.json');
  expect(settings.inputs).not.toContain('../../../public/assets/far-reach/baked/mill-rest.glb');
  for (const url of MILL_REST_INPUTS) expect(settings.inputs).toContain(`../../../public${url}`);
  const check = (files: ReadonlyMap<string, Uint8Array>): void => {
    expect([...files.keys()].sort()).toEqual([...worldHandoffs].sort());
    for (const file of worldHandoffs) {
      expect(settings.inputs).not.toContain(file);
      const bytes = files.get(file);
      if (bytes === undefined) throw new Error('Missing owned map input');
      expect(Buffer.compare(bytes, readFileSync(rootPath(file))), file).toBe(0);
    }
  };
  const compress = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateSync(bytes, { level: 9 }));
  const first = skyMapWorldSources(compress); check(first);
  for (const bytes of first.values()) bytes.fill(0);
  check(skyMapWorldSources(compress));
});

test('the real sealed map refuses its omitted defining world source', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  const folder = 'src/shards/far-reach/generators', source = `${folder}/mapWorldSources.ts`;
  expect(job.inputRoots).toContain(folder);
  const leaves = readdirSync(resolve(root, folder), { recursive: true, withFileTypes: true }).filter(file => file.isFile())
    .map(file => relative(root, resolve(file.parentPath, file.name)));
  const inputRoots = [...new Set(job.inputRoots.flatMap(path => path === folder ? leaves : [path]))].filter(path => path !== source);
  const omitted = { ...job, inputRoots }, cacheDir = mkdtempSync(resolve('tmp/sky-map-world-omitted-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(resolve(root, catalogPath), JSON.stringify({ schema: 'generation-jobs/1',
      notice: 'DO NOT EDIT isolated defining-source omission', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the map world source bundles without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/mapWorldSources.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing map world source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test.each(MILL_REST_INPUTS)('the actual sealed map refuses omitted native mill model %s', async url => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-data-map');
  if (job === undefined) throw new Error('Missing retained Sky map');
  const input = `public${url}`; expect(job.inputRoots).toContain(input);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== input) }, cacheDir = mkdtempSync(resolve('tmp/sky-map-mill-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT native mill omission',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

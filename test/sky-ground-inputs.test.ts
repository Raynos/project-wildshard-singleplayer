// oxlint-disable-next-line import/no-nodejs-modules -- Isolate real sealed-driver fixtures.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-source catalogues in repository scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { skyGroundSource, skyGroundValues } from '../src/shards/far-reach/generators/groundScene';

const output = 'src/shards/far-reach/data/worldRows.generated.json';
// Complete predecessor wire, including every hull scalar, before source-row extraction.
const originalHash = 'b72fb9d2372640b84d8b00ebe7ca6ba82a2673be3f430c0ab7002c5b8dfc1660';

test('the source-derived ground preserves every original hull, scene and registry byte', () => {
  const bytes = skyGroundSource();
  expect(bytes.byteLength).toBe(17_705);
  expect(hashImmutableBytes(bytes)).toBe(originalHash);
  expect(new TextEncoder().encode(`${JSON.stringify(skyGroundValues())}\n`)).toEqual(bytes);
});

test('ground row loans cannot mutate the next caller or retained publication', () => {
  const values = skyGroundValues(), root = values.SKY_GROUND.recipe.scene.nodes[0], hull = values.SKY_GROUND_COLLIDERS[0]?.colliders[0];
  if (root === undefined || hull === undefined) throw new Error('Missing original ground rows');
  root.children.push('caller-only');
  hull.points.fill(0);
  expect(hashImmutableBytes(skyGroundSource())).toBe(originalHash);
  const fresh = skyGroundValues();
  expect(fresh.SKY_GROUND.recipe.scene.nodes[0]?.children).not.toContain('caller-only');
  expect(fresh.SKY_GROUND_COLLIDERS[0]?.colliders[0]?.points.some(value => value !== 0)).toBe(true);
});

test('ground source bundles without generated metadata or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/groundScene.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing ground source bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

test('the real cold sealed world reader omits ground metadata, refuses a missing hull source and preserves its full output', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-world-rows');
  if (job === undefined) throw new Error('Missing retained world row writer');
  expect(jobs.some(row => row.id === 'sky-ground-scene')).toBe(false);
  expect(jobs.flatMap(row => row.outputs)).not.toContain('src/shards/far-reach/data/groundScene.generated.json');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/groundScene.generated.json');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/knolls.json');
  const source = 'src/shards/far-reach/generators/knoll.ts';
  expect(job.inputRoots).toContain(source);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== source) };
  const expected = '3a05afd8da12568f27c2ecaaa33d7212ba6817d006ed4f7a3fc1fa418ceb9b9d', cacheDir = mkdtempSync(resolve('tmp/sky-ground-inputs-'));
  const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

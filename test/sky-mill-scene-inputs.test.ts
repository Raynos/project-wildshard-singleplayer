// oxlint-disable-next-line import/no-nodejs-modules -- Read original native inputs and isolate real sealed-driver fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-input catalogues under repository scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { millSceneSource, millSceneValues } from '../src/shards/far-reach/generators/millScene';
import { HD_URLS } from '../src/shards/far-reach/generators/fileInventory';

const inputs = [HD_URLS['mill-tower'], HD_URLS['mill-foot']];
const output = 'src/shards/far-reach/data/millScene.generated.json';
const originalHash = '3a4d921739c9ca69a3a36885fc4020c3ee01d47aa6097df406859a626ef842a8';
const read = (name: string): Uint8Array => new Uint8Array(readFileSync(`public${name}`));

test('the mill hierarchy derives its exact original hub and complete scene from both native models', async () => {
  const reads: string[] = [];
  const bytes = await millSceneSource(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual(inputs);
  expect(bytes.byteLength).toBe(2_200);
  expect(hashImmutableBytes(bytes)).toBe(originalHash);
  const values = await millSceneValues(read);
  expect(new TextEncoder().encode(`${JSON.stringify(values)}\n`)).toEqual(bytes);
});

test('mill scene row loans cannot mutate the next caller or retained publication', async () => {
  const values = await millSceneValues(read), root = values.MILL_SCENE.recipe.scene.nodes[0];
  if (root === undefined) throw new Error('Missing original mill root');
  root.children.push('caller-only');
  values.MILL_SCENE.recipe.imports.pop();
  expect(hashImmutableBytes(await millSceneSource(read))).toBe(originalHash);
  const fresh = await millSceneValues(read);
  expect(fresh.MILL_SCENE.recipe.scene.nodes[0]?.children).not.toContain('caller-only');
  expect(fresh.MILL_SCENE.recipe.imports).toHaveLength(7);
});

test('the real cold sealed mill reader omits metadata, refuses a missing native model and preserves every output byte', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-mill-scene');
  if (job === undefined) throw new Error('Missing retained mill scene writer');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/millModel.json');
  for (const name of inputs) expect(job.inputRoots).toContain(`public${name}`);
  const first = inputs[0]; if (first === undefined) throw new Error('Missing original mill model');
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== `public${first}`) };
  const expected = originalHash, cacheDir = mkdtempSync(resolve('tmp/sky-mill-scene-inputs-'));
  const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

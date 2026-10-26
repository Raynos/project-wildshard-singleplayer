// oxlint-disable-next-line import/no-nodejs-modules -- Read native inputs and isolate actual sealed-driver fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep omitted-input catalogues in repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare all original geometry and hierarchy bytes.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bridgeRestGlb, bridgeRestRows } from '../src/shards/far-reach/generators/bridgeRest';
import { MODEL_URLS } from '../src/shards/far-reach/generators/fileInventory';

const input = `public${MODEL_URLS['bridge-deck']}`;
const cases = [
  { id: 'sky-bridge-rest-rows', output: 'src/shards/far-reach/data/bridgeRest.generated.json', make: bridgeRestRows },
  { id: 'sky-bridge-rest-glb', output: 'public/assets/far-reach/baked/bridge-rest.glb', make: bridgeRestGlb },
];

test.each(cases)('$id derives every original byte from the native deck', async ({ output, make }) => {
  const reads: string[] = [];
  const bytes = await make(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual([MODEL_URLS['bridge-deck']]);
  expect(Buffer.compare(bytes, readFileSync(output))).toBe(0);
});

test.each(cases)('$id cold sealed reader omits both handoffs and retains its complete output', async ({ id, output }) => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === id);
  if (job === undefined) throw new Error(`Missing retained bridge writer ${id}`);
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/bridges.json');
  expect(job.inputRoots).not.toContain('public/assets/far-reach/baked/bridges.bin');
  expect(job.inputRoots).toContain(input);
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-bridge-rest-inputs-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the real sealed bridge reader refuses an omitted native deck', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-bridge-rest-rows');
  if (job === undefined) throw new Error('Missing retained bridge row writer');
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== input) };
  const cacheDir = mkdtempSync(resolve('tmp/sky-bridge-rest-omitted-')), catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

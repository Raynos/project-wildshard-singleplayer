// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete predecessor rows and own isolated sealed fixtures.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omission descriptors and sealed outputs to repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original route bytes without expanding assertions.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { bridgeRestPool, bridgeRestValues } from '../src/shards/far-reach/generators/bridgeRest';
import { MODEL_URLS } from '../src/shards/far-reach/generators/fileInventory';
import { skyRouteSource } from '../src/shards/far-reach/generators/routeScene';
import { hashImmutableBytes } from '../src/sdk/immutable';

const model = `public${MODEL_URLS['bridge-deck']}`, source = 'src/shards/far-reach/generators/bridgeRest.ts';
const handoff = 'src/shards/far-reach/data/bridgeRest.generated.json';
const route = 'src/shards/far-reach/data/routeScene.generated.json';
const hash = '658ee87ee0f3ad43e3c8aa0dac09e8235793444b2cecb4935e40a2ec26181ffa';
const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));

test('typed bridge hierarchy and independently derived pool retain every original field and part', async () => {
  const rows = await bridgeRestValues(read), pool = bridgeRestPool();
  const bytes = new TextEncoder().encode(`${JSON.stringify(rows)}\n`);
  expect(bytes.byteLength).toBe(59_699);
  expect(hashImmutableBytes(bytes)).toBe('ae5faee1125143aa75aa053cfbd418f9899c1b1a9907b617280a97e00c538bb4');
  expect(pool).toEqual(rows.pool);
  pool.parts.fill('foreign');
  expect(bridgeRestPool()).toEqual(rows.pool);
});

test('the route owner retains every original hierarchy, material, binding and board-only byte', async () => {
  const reads: string[] = [];
  const bytes = await skyRouteSource(url => { reads.push(url); return read(url); });
  expect(reads).toEqual([MODEL_URLS['bridge-deck']]);
  expect(bytes.byteLength).toBe(52_508); expect(hashImmutableBytes(bytes)).toBe(hash);
  expect(Buffer.compare(bytes, readFileSync(route))).toBe(0);
});

test('actual cold sealed route generation has no hierarchy handoff and preserves the complete original output', async () => {
  const root = resolve('.'), job = discoverGeneration(root).jobs.find(row => row.id === 'sky-route-scene');
  if (job === undefined) throw new Error('Missing retained route reader');
  expect(job.inputRoots).not.toContain(handoff); expect(job.inputRoots).toContain(model); expect(job.inputRoots).toContain(source);
  const cacheDir = mkdtempSync(resolve('tmp/sky-bridge-route-'));
  try {
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try {
      expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [route]: hash });
      expect(existsSync(resolve(result.directory, handoff))).toBe(false);
    } finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test.each(['sky-route-scene', 'sky-data-map'])('%s refuses the omitted original native bridge deck', async id => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === id);
  if (job === undefined) throw new Error('Missing retained bridge consumer');
  expect(job.inputRoots).toContain(model);
  const omitted = { ...job, inputRoots: job.inputRoots.filter(file => file !== model) }, cacheDir = mkdtempSync(resolve('tmp/sky-bridge-deck-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT native-deck omission',
      jobs: jobs.map(row => row.id === id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('actual sealed route generation refuses its omitted defining bridge hierarchy source', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-route-scene');
  if (job === undefined) throw new Error('Missing retained route reader');
  const omitted = { ...job, inputRoots: job.inputRoots.filter(file => file !== source) }, cacheDir = mkdtempSync(resolve('tmp/sky-bridge-source-'));
  try {
    const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
    writeFileSync(catalogPath, JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT defining-source omission',
      jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

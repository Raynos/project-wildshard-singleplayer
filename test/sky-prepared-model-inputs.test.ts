import { SKY_MAP_INPUTS } from '../src/shards/far-reach/generators/bake-map.mjs';
import { skyHeroLibrarySource, skyHeroLibraryProgram, HERO_LIBRARY_INPUTS } from '../src/shards/far-reach/generators/heroLibrary';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated cold cache and matching omission catalogue.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine real producer fixtures to repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { discoverGeneration } from '../scripts/generate.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyVaneSource, skyVaneProgram, VANE_INPUTS } from '../src/shards/far-reach/generators/vaneProgram';

test('the owned vane source retains both complete original parts and strict source/cache inventories', async () => {
  const inputs = new Map(VANE_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
  const original = [
    ['vane-post.glb', 43_928, 'a5b779f379598b3e6afbf7640a0c5c30c802a2f4f51b53bb0934c29260b46a74'],
    ['vane-rotor.glb', 54_316, '13ad79dd37f10805d3450bbc59a450f27a3262065e85358c8e27f8d3e82b9ad5'],
  ] as const;
  const files = await skyVaneSource(inputs);
  expect([...files.keys()]).toEqual(original.map(row => row[0]));
  for (const [name, size, hash] of original) {
    const bytes = files.get(name); if (bytes === undefined) throw new Error('Missing original vane part');
    expect(bytes.byteLength).toBe(size); expect(hashImmutableBytes(bytes)).toBe(hash); bytes.fill(0);
  }
  const fresh = await skyVaneSource(inputs);
  for (const [name, , hash] of original) {
    const bytes = fresh.get(name); if (bytes === undefined) throw new Error('Missing fresh vane part');
    expect(hashImmutableBytes(bytes)).toBe(hash);
  }
  await expect(skyVaneSource(new Map())).rejects.toThrow('input inventory differs');
  await expect(skyVaneSource(new Map([...inputs, ['extra', new Uint8Array([1])]]))).rejects.toThrow('input inventory differs');
  await expect(skyVaneProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('cache inventory differs');
});

test('prepared geometry has no scheduled writer or public handoff reader while frozen legacy bytes stay exact', () => {
  const { jobs } = discoverGeneration(resolve('.')), handoff = 'public/assets/far-reach/baked/prepared-models.glb';
  expect(jobs.some(row => row.id === 'sky-prepared-models')).toBe(false);
  for (const job of jobs) {
    expect(job.outputs, job.id).not.toContain(handoff);
    expect(job.inputRoots, job.id).not.toContain(handoff);
  }
  expect(hashImmutableBytes(readFileSync(handoff))).toBe('bd1a0a75879e2f3e72e2ab2b8d0c18a79d7e7746478b3fedc6961199a714c580');
});

test('hero library derives its complete original wire from native geometry with strict input/cache admission', async () => {
  const inputs = new Map(HERO_LIBRARY_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
  const wire = new TextEncoder().encode(`${JSON.stringify(await skyHeroLibrarySource(inputs))}\n`);
  expect(hashImmutableBytes(wire)).toBe('8636a32d64c0cffec7c174e8f3983ca6a5d585e3bea4bd00463084dd1d85ac12');
  await expect(skyHeroLibrarySource(new Map())).rejects.toThrow('input inventory differs');
  await expect(skyHeroLibrarySource(new Map([...inputs, ['extra', new Uint8Array([1])]]))).rejects.toThrow('input inventory differs');
  await expect(skyHeroLibraryProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('cache identity differs');
  const malformed = { cached: () => Promise.resolve(new Map([['heroes.json', new Uint8Array([1])]])) };
  await expect(skyHeroLibraryProgram(malformed)).rejects.toThrow();
  const scratch = mkdtempSync(resolve('tmp/sky-hero-native-'));
  try {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), resolve(scratch, 'cache'),
      [{ prefix: '/assets/', directory: resolve('public/assets') }]);
    const cold = await skyHeroLibraryProgram(ctx);
    expect(cold).toEqual(await skyHeroLibrarySource(inputs)); cold.pool.parts.length = 0;
    expect(await skyHeroLibraryProgram(ctx)).toEqual(await skyHeroLibrarySource(inputs));
    const missing = createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), resolve(scratch, 'missing'));
    await expect(skyHeroLibraryProgram(missing)).rejects.toThrow('exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  expect(discoverGeneration('.').jobs.some(job => job.id === 'sky-hero-library')).toBe(false);
});

test('both vane writers retire after map adoption of the exact native source', () => {
  const { jobs } = discoverGeneration(resolve('.'));
  for (const id of ['sky-vane-post', 'sky-vane-rotor']) expect(jobs.some(job => job.id === id)).toBe(false);
  for (const path of ['public/assets/far-reach/models/wind-vane/post.glb', 'public/assets/far-reach/models/wind-vane/rotor.glb']) {
    for (const job of jobs) {
      expect(job.outputs, job.id).not.toContain(path);
      expect(job.inputRoots, job.id).not.toContain(path);
    }
  }
  expect(jobs.some(job => job.id === 'sky-data-map')).toBe(false);
  expect(SKY_MAP_INPUTS).toContain('/assets/far-reach/models/wind-vane/wind-vane.glb');
});

test('boot metadata has no publisher or handoff readers after direct source discovery', () => {
  const { jobs } = discoverGeneration('.');
  expect(jobs.some(job => job.id === 'sky-boot-metadata')).toBe(false);
  for (const name of ['assets', 'files', 'sources', 'lateReads', 'rigs', 'worldTextures']) {
    const handoff = `src/shards/far-reach/boot/${name}.generated.json`;
    for (const job of jobs) { expect(job.outputs).not.toContain(handoff); expect(job.inputRoots).not.toContain(handoff); }
  }
});

import { SKY_MAP_INPUTS } from '../src/shards/far-reach/generators/bake-map.mjs';
import { skyHeroLibrarySource, skyHeroLibraryProgram, HERO_LIBRARY_INPUTS } from '../src/shards/far-reach/generators/heroLibrary';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated cold cache and matching omission catalogue.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine real producer fixtures to repository scratch.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyVaneSource, skyVaneProgram, VANE_INPUTS } from '../src/shards/far-reach/generators/vaneProgram';

test('the owned vane source retains independent current parts and strict source/cache inventories', async () => {
  const inputs = new Map(VANE_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
  const names = ['vane-post.glb', 'vane-rotor.glb'];
  const files = await skyVaneSource(inputs);
  expect([...files.keys()]).toEqual(names);
  const original = new Map([...files].map(([name, bytes]) => [name, { size: bytes.byteLength, hash: hashImmutableBytes(bytes) }]));
  for (const name of names) {
    const bytes = files.get(name); if (bytes === undefined) throw new Error('Missing original vane part');
    expect(bytes.byteLength).toBeGreaterThan(0); bytes.fill(0);
  }
  const fresh = await skyVaneSource(inputs);
  for (const name of names) {
    const bytes = fresh.get(name); if (bytes === undefined) throw new Error('Missing fresh vane part');
    const before = original.get(name); if (before === undefined) throw new Error('Missing current vane snapshot');
    expect(bytes.byteLength).toBe(before.size); expect(hashImmutableBytes(bytes)).toBe(before.hash);
  }
  await expect(skyVaneSource(new Map())).rejects.toThrow('input inventory differs');
  await expect(skyVaneSource(new Map([...inputs, ['extra', new Uint8Array([1])]]))).rejects.toThrow('input inventory differs');
  await expect(skyVaneProgram({ cached: () => Promise.resolve(new Map()) })).rejects.toThrow('cache inventory differs');
});

test('hero library derives current native rows with strict input/cache admission', async () => {
  const inputs = new Map(HERO_LIBRARY_INPUTS.map(url => [url, new Uint8Array(readFileSync(`public${url}`))]));
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
});

test('both vane writers retire after map adoption of the exact native source', () => {
  expect(SKY_MAP_INPUTS).toContain('/assets/far-reach/models/wind-vane/wind-vane.glb');
});

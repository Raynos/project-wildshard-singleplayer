// oxlint-disable-next-line import/no-nodejs-modules -- This producer oracle reads the exact committed library bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only fixture and authored product paths.
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import config from '../vercel.json';
import catalogue from '../src/shards/far-reach/data/skyMaps.json';
import sources from '../src/shards/far-reach/data/skyMapSources.json';
import sky from '../src/shards/far-reach/shard.config';
import { TEX_URL } from '../src/shards/far-reach/data/files';
import { repackKtx2Lossless } from '../src/sdk/bake/texture';
import { parseKtx2 } from '../src/format/product';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { worldImageInfo } from '../src/sdk/bake/worldImage';

const { maps } = catalogue;

it('admits exactly the nine original tiling sources, their unchanged dimensions and complete mip chains', async () => {
  expect(Object.keys(sources)).toEqual(Object.keys(TEX_URL));
  for (const [name, original] of Object.entries(sources)) {
    expect(original.source).toBe(TEX_URL[name as keyof typeof TEX_URL]);
    const row = maps[name as keyof typeof maps], file = sky.files.find(value => value.hash === row.hash);
    const bytes = Uint8Array.from(readFileSync(resolve('src/shards/far-reach/assets', row.hash)));
    expect(hashImmutableBytes(bytes)).toBe(row.hash); expect(file).toEqual(row);
    const info = await worldImageInfo(Uint8Array.from(readFileSync(resolve(`public${original.source}`))));
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect([header.getUint32(20, true), header.getUint32(24, true)]).toEqual([info.width, info.height]);
    expect(header.getUint32(40, true)).toBe(Math.floor(Math.log2(Math.max(info.width, info.height))) + 1);
    expect(sky.library).toContain(row.hash);
    expect(original.sampler.filter).toBe('linear');
    expect(parseKtx2(bytes)).toMatchObject({ decoded: row.decoded, gpu: row.gpu });
  }
  expect(sources.clouds.source).toContain('clouds');
});
it('keeps truthful fallback, compressed footprint and exact wire totals without including panoramas', () => {
  const rows = Object.values(maps), compressed = rows.reduce((sum, row) => sum + row.compressed, 0), rgba = rows.reduce((sum, row) => sum + row.gpu, 0);
  const blocks = rows.reduce((sum, row) => sum + parseKtx2(Uint8Array.from(readFileSync(resolve('src/shards/far-reach/assets', row.hash))), { astc: true, bc7: false }).gpu, 0);
  expect(sky.budgets.library).toEqual({ compressed, resident: rgba, downloadAllowance: 8_811_813 });
  expect(compressed).toBe(8811813); expect(rgba).toBe(44272748);
  expect(blocks).toBeLessThan(25_000_000);
  expect(Object.values(sources).every(row => !row.source.includes('panorama'))).toBe(true);
});

it('serves only hash-addressed shard files as immutable', () => {
  const row = config.headers.find(entry => entry.source.startsWith('/shardfiles/'));
  if (row === undefined) throw new Error('Missing immutable shardfile policy');
  const pattern = new RegExp(`^${row.source}$`, 'u');
  expect(Object.values(maps).every(file => pattern.test(`/shardfiles/far-reach/${file.hash}`))).toBe(true);
  expect(pattern.test('/shardfiles/far-reach/shard.json')).toBe(false);
  expect(row.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
});

it('keeps the canonical lossless cloud mip bytes and refuses an unread tail', () => {
  const bytes = Uint8Array.from(readFileSync(resolve('src/shards/far-reach/assets', maps.clouds.hash)));
  expect(hashImmutableBytes(repackKtx2Lossless(bytes))).toBe(maps.clouds.hash);
  const tail = new Uint8Array(bytes.length + 1); tail.set(bytes);
  expect(() => repackKtx2Lossless(tail)).toThrow('unread tail');
});

// oxlint-disable-next-line import/no-nodejs-modules -- Hash the original ordered boot inventory as a frozen oracle.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import * as files from '../../../src/shards/far-reach/data/files';
import manifest, { bootSources, bootFiles, lateReads } from '../../../src/shards/far-reach/manifest';

it('declares the empty boot audio inventory as serializable data', () => {
  expect(manifest.boot?.audio).toEqual([]);
  expect(JSON.stringify(manifest.boot?.audio)).toBe('[]');
});

it('retains every ordered desktop/phone image/KTX2 boot URL and late read', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(texture => bootSources(tier, texture)));
  const digest = createHash('sha256').update(JSON.stringify({ sources, boot: bootFiles(), late: lateReads() })).digest('hex');
  expect(digest).toBe('bca6d3c9d49f6a1820d282ab9746c0f9a3b3f4ba9ae0ecb5f3fa109fc4712808');
});
it('publishes only finite JSON data and resolves every model, rig and generated piece name', () => {
  for (const value of Object.values(files)) {
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON persistence is the admission contract under test.
    expect(JSON.parse(JSON.stringify(value))).toStrictEqual(value);
  }
  for (const name of files.SKY_MESHES) expect(files.MODEL_URLS[name]).toMatch(/^\/assets\/far-reach\//u);
  for (const name of files.SKY_HD) expect(files.HD_URLS[name]).toMatch(/^\/assets\/far-reach\//u);
  for (const name of files.SKY_CREATURES) expect(files.SKY_CREATURE_RIGS[name]).toMatch(/^\/assets\/far-reach\/rigs\//u);
  for (const name of files.BAKED_PIECES) expect(files.BAKED_URLS[name]).toBe(`/assets/far-reach/baked/${name}.glb`);
});

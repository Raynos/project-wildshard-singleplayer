// oxlint-disable-next-line import/no-nodejs-modules -- Hash the original ordered boot inventory as a frozen oracle.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import * as files from '../../../src/shards/far-reach/data/files';
import { bootSources, bootFiles, lateReads } from '../../../src/shards/far-reach/boot/files';

it('retains every ordered desktop/phone image/KTX2 boot URL and late read', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(texture => bootSources(tier, texture)));
  const digest = createHash('sha256').update(JSON.stringify({ sources, boot: bootFiles(), late: lateReads() })).digest('hex');
  expect(digest).toBe('5c88f56ce7942768847705144dee9dac39ec69a1b6ec5cdf4b4f66ee24d3f923');
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

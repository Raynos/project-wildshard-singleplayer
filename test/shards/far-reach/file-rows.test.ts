// oxlint-disable-next-line import/no-nodejs-modules -- Hash the original ordered boot inventory as a frozen oracle.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import * as files from '../../../src/shards/far-reach/data/files';
import manifest from '../../../src/shards/far-reach/manifest';
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from '../../../src/shards/far-reach/data/boot';
import { bootSourceFiles, bootFileList } from '../../../src/engine/boot/filePolicy';
import { PREPARED_MODELS_URL } from '../../../src/shards/far-reach/data/modelFrames';

const withoutPrepared = (source: ReturnType<typeof bootSourceFiles>): ReturnType<typeof bootSourceFiles> => ({ ...source, props: source.props.filter(url => url !== PREPARED_MODELS_URL) });

it('declares the empty boot audio inventory as serializable data', () => {
  expect(manifest.boot?.audio).toEqual([]);
  expect(JSON.stringify(manifest.boot?.audio)).toBe('[]');
});

it('retains every ordered desktop/phone image/KTX2 boot URL and late read', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(texture => bootSourceFiles(BOOT_SOURCES, tier, texture)));
  const boot = bootFileList(BOOT_FILES, 'phone');
  for (const source of sources) expect(source.props.filter(url => url === PREPARED_MODELS_URL)).toEqual([PREPARED_MODELS_URL]);
  expect(boot.filter(url => url === PREPARED_MODELS_URL)).toEqual([PREPARED_MODELS_URL]);
  // The only addition is the retained geometry bake; every original URL keeps its exact order and GPU policy.
  const original = sources.map(withoutPrepared);
  const digest = createHash('sha256').update(JSON.stringify({ sources: original, boot: boot.filter(url => url !== PREPARED_MODELS_URL), late: LATE_READS })).digest('hex');
  expect(digest).toBe('e3fa0ea8057493831588a0d385bad4ea7ae891156318dc7ebaa4571bef08b288');
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

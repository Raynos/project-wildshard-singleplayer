// oxlint-disable-next-line import/no-nodejs-modules -- Hash the original ordered boot inventory as a frozen oracle.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import * as files from '../../../src/shards/far-reach/data/files';
import manifest from '../../../src/shards/far-reach/manifest';
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from '../../../src/shards/far-reach/data/boot';
import { bootSourceFiles, bootFileList } from '../../../src/engine/boot/filePolicy';
import inventory from '../../fixtures/sky-vane-boot-inventory.json' with { type: 'json' };
import { PREPARED_MODELS_URL } from '../../../src/shards/far-reach/data/modelFrames';

it('declares the empty boot audio inventory as serializable data', () => {
  expect(manifest.boot?.audio).toEqual([]);
  expect(JSON.stringify(manifest.boot?.audio)).toBe('[]');
});

it('retains every ordered desktop/phone image/KTX2 boot URL and late read', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(texture => bootSourceFiles(BOOT_SOURCES, tier, texture)));
  const boot = bootFileList(BOOT_FILES, 'phone');
  for (const source of sources) expect(source.props.filter(url => url === PREPARED_MODELS_URL)).toEqual([PREPARED_MODELS_URL]);
  expect(boot.filter(url => url === PREPARED_MODELS_URL)).toEqual([PREPARED_MODELS_URL]);
  // C1 rest-scene deletion adds the named exact hover/winch or bucket/oil pools.
  // Pin the current full inventory and order; never substitute retired URLs.
  for (const source of sources) {
    expect(source.props.slice(0, 2)).toEqual([files.MODEL_URLS['vane-post'], files.MODEL_URLS['vane-rotor']]);
    expect(source.props).not.toContain(files.MODEL_URLS['wind-vane']);
    expect(source.props).not.toContain(files.MODEL_URLS.keeper);
  }
  const current = { sources, boot, late: LATE_READS };
  expect(current).toStrictEqual(inventory);
  expect(createHash('sha256').update(JSON.stringify(current)).digest('hex')).toBe('d15a14e44572bf46e2a6c66cbfed33b65ab1335e8f5f8e9cae922f4183320fd9');
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

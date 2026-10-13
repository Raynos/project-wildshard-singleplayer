import { afterEach, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the original ordered native inventory as a byte oracle.
import { createHash } from 'node:crypto';
import { bootFileList, bootLateReads, bootSourceFiles } from '../src/engine/boot/filePolicy';
import { installAssetTables } from '../src/engine/boot/tables';
import type { BootSourceRows } from '../src/engine/level/spec';
import EXPECTED_SIGNAL_FILES from './fixtures/signal-boot-files.json' with { type: 'json' };
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from '../src/shards/sunscar-dunes/data/boot';

const slot = Symbol.for('engine.asset-tables'), original: unknown = Reflect.get(globalThis, slot);
afterEach(() => { Reflect.set(globalThis, slot, original); });

it('pins every Signal tier/texture inventory and late read after the static well bake', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(tex => bootSourceFiles(BOOT_SOURCES, tier, tex)));
  const value = { sources, files: bootFileList(BOOT_FILES, 'phone'), late: LATE_READS };
  // 7c279ff1d moves the shell into baked/well.glb and retires the raw well preload.
  expect(value.files).toStrictEqual(EXPECTED_SIGNAL_FILES);
  expect(createHash('sha256').update(JSON.stringify(value)).digest('hex')).toBe('a041c403af2bde8853ebc4395f59e6642297435e60a5c8f6e3eabad42a46d5a2');
  for (const source of sources) {
    expect(source.props).not.toContain('/assets/sunscar-dunes/models/dry-well/dry-well.glb');
    expect(source.props).toContain('/assets/sunscar-dunes/baked/well.glb');
  }
  expect(value.files).not.toContain('/assets/sunscar-dunes/models/dry-well/dry-well.glb');
  expect(value.files).toContain('/assets/sunscar-dunes/baked/well.glb');
});

it('resolves phone and GPU variants at consumption, preserving order, duplicates and plain URLs', () => {
  const shared = { baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [{ gpu: '/assets/figure.glb' }, '/assets/figure.glb', { gpu: '/assets/figure.glb' }], art: [], music: [], sfx: [] };
  const rows: BootSourceRows = { tiers: { phone: { sky: ['/assets/phone.webp'], ...shared }, desktop: { sky: ['/assets/desktop.webp'], ...shared } },
    gpuFiles: { phone: { '/assets/figure.phone.glb': '/assets/figure.ktx.glb' }, desktop: { '/assets/figure.glb': '/assets/figure.desktop-ktx.glb' } } };
  installAssetTables({ bytes: { '/assets/figure.phone.glb': 12 }, versions: {}, music: {}, sfx: {}, packs: {} });
  expect(bootSourceFiles(rows, 'phone', 'img').props).toEqual(['/assets/figure.phone.glb', '/assets/figure.glb', '/assets/figure.phone.glb']);
  expect(bootSourceFiles(rows, 'phone', 'ktx2').props).toEqual(['/assets/figure.ktx.glb', '/assets/figure.glb', '/assets/figure.ktx.glb']);
  expect(bootSourceFiles(rows, 'desktop', 'ktx2').props).toEqual(['/assets/figure.desktop-ktx.glb', '/assets/figure.glb', '/assets/figure.desktop-ktx.glb']);
  expect(bootFileList({ sources: rows, tier: 'phone', tex: 'img' }, 'desktop')).toEqual(['/assets/phone.webp', '/assets/figure.phone.glb', '/assets/figure.glb', '/assets/figure.phone.glb']);
  // A new page's actual byte table remains authoritative; no stale normalization is cached in the rows.
  installAssetTables({ bytes: {}, versions: {}, music: {}, sfx: {}, packs: {} });
  expect(bootSourceFiles(rows, 'phone', 'img').props).toEqual(['/assets/figure.glb', '/assets/figure.glb', '/assets/figure.glb']);
});

it('keeps the legacy callable contract, late-read arguments and results exact', () => {
  const sources = { sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: ['/old.glb'], art: [], music: [], sfx: [] };
  const callback = vi.fn(() => sources), files = vi.fn(() => ['/old.glb']), late = vi.fn(() => ['/late.bin']);
  expect(bootSourceFiles(callback, 'desktop', 'ktx2')).toBe(sources);
  expect(callback).toHaveBeenCalledExactlyOnceWith('desktop', 'ktx2');
  expect(bootFileList(files, 'phone')).toEqual(['/old.glb']);
  expect(files).toHaveBeenCalledExactlyOnceWith('phone');
  expect(bootLateReads(late, 'phone')).toEqual(['/late.bin']);
  expect(late).toHaveBeenCalledExactlyOnceWith('phone', undefined);
  expect(bootLateReads(['/late.bin'], 'desktop', 'ktx2')).toEqual(['/late.bin']);
  expect(bootLateReads(undefined, 'desktop')).toEqual([]);
});

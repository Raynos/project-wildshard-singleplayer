import { afterEach, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the original ordered native inventory as a byte oracle.
import { createHash } from 'node:crypto';
import { bootFileList, bootLateReads, bootSourceFiles } from '../src/engine/boot/filePolicy';
import { installAssetTables } from '../src/engine/boot/tables';
import type { BootSourceRows } from '../src/engine/level/spec';
import { BOOT_SOURCES, BOOT_FILES, LATE_READS } from '../src/shards/sunscar-dunes/data/boot';

const slot = Symbol.for('engine.asset-tables'), original: unknown = Reflect.get(globalThis, slot);
afterEach(() => { Reflect.set(globalThis, slot, original); });

it('keeps every Signal tier/texture inventory and late read equal to its original committed callbacks', () => {
  const sources = (['desktop', 'phone'] as const).flatMap(tier => (['img', 'ktx2'] as const).map(tex => bootSourceFiles(BOOT_SOURCES, tier, tex)));
  const value = { sources, files: bootFileList(BOOT_FILES, 'phone'), late: LATE_READS };
  expect(createHash('sha256').update(JSON.stringify(value)).digest('hex')).toBe('022c2a16dcb90fdef9fa4bb47b14196cae5a4521876b62bc3bbd6c96818f6481');
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

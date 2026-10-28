import { expect, test } from 'vitest';
import type { AuthorWorldScenes } from '@wildshard/sdk/worldScenes';
import { nineDemandFiles, nineDesktopPoolFiles } from './demandAdmission';

test('only the explicit demand family leaves the early inventory, without mutating its source', () => {
  const volume = { hash: 'a'.repeat(64), name: 'looks/volume.bin' };
  const files = [volume,
    { hash: 'b'.repeat(64), name: 'geometry/fixed-kits.json' },
    { hash: 'c'.repeat(64), name: 'practice/card.webp' },
    { hash: 'd'.repeat(64), name: 'looks/jian-decal-desktop.png' },
    { hash: 'e'.repeat(64), name: 'looks/jian-decal-phone.png' },
    { hash: 'f'.repeat(64), name: 'weapons/jian-row.json' },
    { hash: '0'.repeat(64), name: 'geometry/fixed-kits-extra.json' }];
  const before = structuredClone(files), volumes = [volume, volume];
  expect(nineDemandFiles(files, volumes)).toEqual(files.slice(0, 4).map(({ hash }) => ({ hash })));
  expect(nineDemandFiles([...files].reverse(), volumes)).toEqual(nineDemandFiles(files, volumes));
  expect(files).toEqual(before);
});

test('a volume outside the published inventory refuses; absent optional cold files add no hint', () => {
  expect(() => nineDemandFiles([], [{ hash: 'a'.repeat(64) }])).toThrow('must be a published file');
  expect(nineDemandFiles([{ hash: 'a'.repeat(64) }], [])).toEqual([]);
});

test('retained author headers stay cold without deferring glyph textures or live window channels', () => {
  const files = [
    { hash: 'a'.repeat(64), name: 'geometry/layout.json' },
    { hash: 'b'.repeat(64), name: 'signs/atlas-phone.json' },
    { hash: 'c'.repeat(64), name: 'signs/atlas-desktop.json' },
    { hash: 'd'.repeat(64), name: 'signs/atlas-phone-colour.ktx2' },
    { hash: 'e'.repeat(64), name: 'signs/glyphs-phone.ktx2' },
    { hash: 'f'.repeat(64), name: 'geometry/facade-windows-1.bin' }];
  expect(nineDemandFiles(files, [])).toEqual(files.slice(0, 3).map(({ hash }) => ({ hash })));
});

test('only exclusive desktop pool bodies defer; phone, untyped and other-library consumers win', () => {
  const files = ['a', 'b', 'c', 'd'].map(id => ({ hash: id.repeat(64), name: `${id}.glb` }));
  const libraries: AuthorWorldScenes['libraries'] = [{ id: 'pools', kind: 'pool', painted: [], files: [
    { file: 'a.glb', tier: 'desktop' as const, parts: ['a'], channels: [] },
    { file: 'a.glb', tier: 'phone' as const, parts: ['a'], channels: [] },
    { file: 'b.glb', tier: 'desktop' as const, parts: ['b'], channels: [] },
    { file: 'c.glb', tier: 'desktop' as const, parts: ['c'], channels: [] },
    { file: 'c.glb', parts: ['c'], channels: [] },
    { file: { phone: 'a.glb', desktop: 'b.glb' }, parts: ['pair'], channels: [] },
    { file: 'd.glb', tier: 'desktop' as const, parts: ['d'], channels: [] }] },
  { id: 'whole', kind: 'whole' as const, models: [{ id: 'd', part: 'd', files: ['d'.repeat(64)] }] }];
  const before = structuredClone(libraries);
  expect(nineDesktopPoolFiles(files, libraries)).toEqual([{ hash: 'b'.repeat(64) }]);
  expect(libraries).toEqual(before);
  expect(() => nineDesktopPoolFiles([], libraries)).toThrow('must be a published file');
});

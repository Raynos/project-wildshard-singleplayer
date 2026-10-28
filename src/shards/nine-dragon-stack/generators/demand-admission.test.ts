import { expect, test } from 'vitest';
import { nineDemandFiles } from './demandAdmission';

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

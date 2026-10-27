import { expect, test } from 'vitest';
import { bootFileList, bootLateReads, bootSourceFiles } from '@wildshard/engine/boot/filePolicy';
import { publicBytes } from '@wildshard/engine/boot/tables';
import originalBoot from './fixtures/nalati-boot-original.json' with { type: 'json' };
import { nalatiBootInventory } from '../src/shards/nalati-grasslands/generators/bootInventory';
import { bootSources, lateReads, nalatiBootAssets } from '../src/shards/nalati-grasslands/generators/bootFiles';

test('pre-admission Nalati rows retain ordered boot and late reads for every tier and texture mode', () => {
  // GR6: the boot rows are the program's discovery (bootProgram.ts); the inventory they come from keeps every selection
  const boot = nalatiBootInventory(nalatiBootAssets(), publicBytes());
  for (const tier of ['phone', 'desktop'] as const) for (const tex of ['img', 'ktx2'] as const) {
    const expected = bootSources(tier, nalatiBootAssets(), tex);
    expect(bootSourceFiles(boot.sources, tier, tex)).toEqual(expected);
    expect(bootLateReads(boot.lateReads, tier, tex)).toEqual(lateReads(tier, tex));
    expect(bootFileList({ sources: boot.sources, tier, tex }, tier)).toEqual(Object.values(expected).flat());
    if (tex === 'img') expect(bootFileList(boot.files, tier)).toEqual(Object.values(expected).flat());
  }
});

test('offline presence preserves coat order, phone fallback and late-read timing', () => {
  const inventory = {
    '/assets/nalati/baked/crags.bin': 1,
    '/assets/nalati/models/coats/z.coat.webp': true,
    '/assets/nalati/models/coats/a.coat.webp': true,
    '/assets/nalati/baked/painted-models/eagle.phone.glb': true,
    '/assets/nalati/models/eagle.phone.rigged.glb': true,
    '/assets/nalati/models/people/cook.gen.phone.glb': true,
  } satisfies Readonly<Record<string, number | true>>;
  const rows = nalatiBootInventory(nalatiBootAssets(), inventory);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).toEqual([
    '/assets/nalati/models/eagle.phone.rigged.glb',
    '/assets/nalati/models/coats/a.coat.webp',
    '/assets/nalati/models/coats/z.coat.webp',
  ]);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).not.toContain('/assets/nalati/baked/painted-models/eagle.phone.glb');
  expect(bootLateReads(rows.lateReads, 'phone', 'img')).toEqual(['/assets/nalati/models/people/cook.gen.phone.glb']);
  expect(bootLateReads(rows.lateReads, 'desktop', 'img')).toEqual([]);
});

// GR6: the prepared camp skins are product files, read when the camp builds, never boot late reads
test('camp atlas sources stay in the late-read phase in their original order; prepared skins never boot', () => {
  const inventory = {
    '/assets/nalati/baked/people/camp.phone.glb': true,
    '/assets/nalati/baked/people/camp.glb': true,
    '/assets/nalati/models/people/elder.gen.phone.glb': true,
    '/assets/nalati/models/people/cook.gen.phone.glb': true,
  } satisfies Readonly<Record<string, number | true>>;
  const rows = nalatiBootInventory(nalatiBootAssets(), inventory);
  expect(bootLateReads(rows.lateReads, 'phone', 'img')).toEqual([
    '/assets/nalati/models/people/elder.gen.phone.glb',
    '/assets/nalati/models/people/cook.gen.phone.glb',
  ]);
  expect(bootLateReads(rows.lateReads, 'desktop', 'img')).toEqual([]);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).not.toContain('/assets/nalati/baked/people/camp.phone.glb');
});

test('explicit declared body locators own selection and refuse malformed identities', () => {
  const originalFile = originalBoot.assetFiles.bodies;
  const assets = nalatiBootAssets(originalFile);
  expect(assets).toEqual(originalBoot.assetFiles);
  const other = nalatiBootAssets(`/assets/nalati/baked/bodies-${'a'.repeat(64)}.bin`);
  const rows = nalatiBootInventory(other, { [originalFile]: true, [`/assets/nalati/baked/bodies-${'a'.repeat(64)}.bin`]: true });
  expect(rows.assetFiles).toEqual(other);
  const props = bootSourceFiles(rows.sources, 'phone', 'img').props;
  expect(props).toEqual([other.bodies]); expect(props).not.toContain(originalFile);
  rows.assetFiles.bodies = originalFile; expect(other.bodies).not.toBe(originalFile);
  for (const name of ['', 'bodies.bin', '/assets/nalati/baked/bodies.bin', `/assets/other/bodies-${'a'.repeat(64)}.bin`,
    `/assets/nalati/baked/bodies-${'A'.repeat(64)}.bin`, `${other.bodies}?copy=1`]) expect(() => nalatiBootAssets(name)).toThrow('Invalid declared species body locator');
});


test('the admitted body bank is absent from every public boot mode even when its old URL exists', () => {
  const assets = nalatiBootAssets(), originalFile = originalBoot.assetFiles.bodies;
  expect(assets).toEqual({ coats: originalBoot.assetFiles.coats });
  const rows = nalatiBootInventory(assets, { [originalFile]: true });
  for (const tier of ['phone', 'desktop'] as const) for (const tex of ['img', 'ktx2'] as const) {
    expect(bootSourceFiles(rows.sources, tier, tex).props).not.toContain(originalFile);
    expect(bootFileList({ sources: rows.sources, tier, tex }, tier)).not.toContain(originalFile);
  }
});

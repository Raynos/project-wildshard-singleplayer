import { expect, test } from 'vitest';
import { bootFileList, bootLateReads, bootSourceFiles } from '@wildshard/engine/boot/filePolicy';
import { publicBytes } from '@wildshard/engine/boot/tables';
import metadata from '../src/shards/nalati-grasslands/bootMetadata.generated.json' with { type: 'json' };
import { DECLARATION } from '../src/shards/nalati-grasslands/boot/declaration.generated';
import { nalatiBootInventory } from '../src/shards/nalati-grasslands/generators/bootInventory';
import { bootSources, lateReads } from '../src/shards/nalati-grasslands/generators/bootFiles';

test('pre-admission Nalati rows retain ordered boot and late reads for every tier and texture mode', () => {
  const boot = DECLARATION.boot;
  const inventory = {
    sources: boot.sources, files: boot.files, lateReads: boot.lateReads,
    steps: boot.steps, assetFiles: metadata.assetFiles,
  };
  expect(inventory).toEqual(nalatiBootInventory(publicBytes()));
  for (const tier of ['phone', 'desktop'] as const) for (const tex of ['img', 'ktx2'] as const) {
    const expected = bootSources(tier, tex);
    expect(bootSourceFiles(boot.sources, tier, tex)).toEqual(expected);
    expect(bootLateReads(boot.lateReads, tier, tex)).toEqual(lateReads(tier, tex));
    expect(bootFileList({ sources: boot.sources, tier, tex }, tier)).toEqual(Object.values(expected).flat());
    if (tex === 'img') expect(bootFileList(boot.files, tier)).toEqual(Object.values(expected).flat());
  }
});

test('offline presence preserves coat order, phone fallback and late-read timing', () => {
  const inventory = {
    '/assets/nalati/models/coats/z.coat.webp': true,
    '/assets/nalati/models/coats/a.coat.webp': true,
    '/assets/nalati/baked/painted-models/eagle.phone.glb': true,
    '/assets/nalati/models/people/cook.gen.phone.glb': true,
  } satisfies Readonly<Record<string, number | true>>;
  const rows = nalatiBootInventory(inventory);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).toEqual([
    '/assets/nalati/baked/painted-models/eagle.phone.glb',
    '/assets/nalati/models/coats/a.coat.webp',
    '/assets/nalati/models/coats/z.coat.webp',
  ]);
  expect(bootLateReads(rows.lateReads, 'phone', 'img')).toEqual(['/assets/nalati/models/people/cook.gen.phone.glb']);
  expect(bootLateReads(rows.lateReads, 'desktop', 'img')).toEqual([]);
});

test('prepared camp skins stay in the late-read phase before their original ordered atlas sources', () => {
  const inventory = {
    '/assets/nalati/baked/people/camp.phone.glb': true,
    '/assets/nalati/baked/people/camp.glb': true,
    '/assets/nalati/models/people/elder.gen.phone.glb': true,
    '/assets/nalati/models/people/cook.gen.phone.glb': true,
  } satisfies Readonly<Record<string, number | true>>;
  const rows = nalatiBootInventory(inventory);
  expect(bootLateReads(rows.lateReads, 'phone', 'img')).toEqual([
    '/assets/nalati/baked/people/camp.phone.glb',
    '/assets/nalati/models/people/elder.gen.phone.glb',
    '/assets/nalati/models/people/cook.gen.phone.glb',
  ]);
  expect(bootLateReads(rows.lateReads, 'desktop', 'img')).toEqual(['/assets/nalati/baked/people/camp.glb']);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).not.toContain('/assets/nalati/baked/people/camp.phone.glb');
});

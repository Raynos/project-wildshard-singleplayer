import { expect, test } from 'vitest';
import { bootFileList, bootLateReads, bootSourceFiles } from '@wildshard/engine/boot/filePolicy';
import { publicBytes } from '@wildshard/engine/boot/tables';
import metadata from '../src/shards/nalati-grasslands/bootMetadata.generated.json' with { type: 'json' };
import { nalatiBootInventory } from '../src/shards/nalati-grasslands/generators/bootInventory';
import { bootSources, lateReads } from '../src/shards/nalati-grasslands/generators/bootFiles';

test('pre-admission Nalati rows retain ordered boot and late reads for every tier and texture mode', () => {
  expect(metadata).toEqual(nalatiBootInventory(publicBytes()));
  for (const tier of ['phone', 'desktop'] as const) for (const tex of ['img', 'ktx2'] as const) {
    const expected = bootSources(tier, tex);
    expect(bootSourceFiles(metadata.sources, tier, tex)).toEqual(expected);
    expect(bootLateReads(metadata.lateReads, tier, tex)).toEqual(lateReads(tier, tex));
    expect(bootFileList({ sources: metadata.sources, tier, tex }, tier)).toEqual(Object.values(expected).flat());
    if (tex === 'img') expect(bootFileList(metadata.files, tier)).toEqual(Object.values(expected).flat());
  }
});

test('offline presence preserves coat order, phone fallback and late-read timing', () => {
  const inventory = {
    '/assets/nalati/models/coats/z.coat.webp': true,
    '/assets/nalati/models/coats/a.coat.webp': true,
    '/assets/nalati/models/eagle.phone.glb': true,
    '/assets/nalati/models/people/cook.gen.phone.glb': true,
  } satisfies Readonly<Record<string, number | true>>;
  const rows = nalatiBootInventory(inventory);
  expect(bootSourceFiles(rows.sources, 'phone', 'img').props).toEqual([
    '/assets/nalati/models/eagle.phone.glb',
    '/assets/nalati/models/coats/a.coat.webp',
    '/assets/nalati/models/coats/z.coat.webp',
  ]);
  expect(bootLateReads(rows.lateReads, 'phone', 'img')).toEqual(['/assets/nalati/models/people/cook.gen.phone.glb']);
  expect(bootLateReads(rows.lateReads, 'desktop', 'img')).toEqual([]);
});

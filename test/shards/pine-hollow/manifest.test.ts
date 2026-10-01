import { expect, it } from 'vitest';
import { PINE_HOLLOW } from '#shards/pine-hollow/manifest';
import { bootSources, worldReads } from '#shards/pine-hollow/boot/files';
import before from './boot-before.json';

it.each(['phone', 'desktop'] as const)('preserves the frozen %s image and KTX2 boot lists', (tier) => {
  for (const tex of ['img', 'ktx2'] as const) {
    const sources = bootSources(tier, tex), added = worldReads(tier, tex);
    expect({ ...sources, props: sources.props.filter((url) => !added.includes(url)) }).toEqual(before[tier][tex]);
    expect(added).toHaveLength(11);
    expect(added.every((url) => sources.props.includes(url))).toBe(true);
  }
  const declared = PINE_HOLLOW.boot?.files(tier) ?? [];
  expect(Object.values(before[tier].img).flat().every((url) => declared.includes(url))).toBe(true);
  expect(worldReads(tier).every((url) => declared.includes(url))).toBe(true);
});

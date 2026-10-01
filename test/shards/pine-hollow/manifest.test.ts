import { expect, it } from 'vitest';
import { PINE_HOLLOW } from '#shards/pine-hollow/manifest';
import { bootSources } from '#shards/pine-hollow/boot/files';
import before from './boot-before.json';

it.each(['phone', 'desktop'] as const)('preserves the frozen %s image and KTX2 boot lists', (tier) => {
  for (const tex of ['img', 'ktx2'] as const) expect(bootSources(tier, tex)).toEqual(before[tier][tex]);
  expect(PINE_HOLLOW.boot?.files(tier)).toEqual(Object.values(before[tier].img).flat());
});

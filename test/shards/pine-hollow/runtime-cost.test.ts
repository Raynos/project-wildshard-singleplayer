import { expect, it } from 'vitest';
import { PageResidency } from '../../../src/game/grid/pageResidency';
import { runtimeAccountedBytes } from '../../../src/game/grid/runtimeCost';
import { PINE_RUNTIME_COST } from '../../../src/shards/pine-hollow/data/runtimeCost';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import source from '../../../src/shards/pine-hollow/shard.config';

it('uses the default measured whole Pine cost on both boot paths and refuses it before home allocation', () => {
  expect(PINE_HOLLOW.runtimeCost).toBe(PINE_RUNTIME_COST);
  expect(source.runtime?.cost).toEqual(PINE_RUNTIME_COST);
  expect(PINE_RUNTIME_COST.webContentMB + PINE_RUNTIME_COST.glMB).toBeCloseTo(1192.19544, 6);
  const owner = new PageResidency();
  try {
    expect(() => owner.admitHome('pine-hollow', runtimeAccountedBytes(PINE_RUNTIME_COST))).toThrow('admission deferred');
    expect(owner.allocator.entries()).toEqual([]);
  } finally { owner.dispose(); }
});

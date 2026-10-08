import { expect, it } from 'vitest';
import { PageResidency } from '../../../src/game/grid/pageResidency';
import { runtimeAccountedBytes } from '../../../src/game/grid/runtimeCost';
import { PINE_RUNTIME_COST } from '../../../src/shards/pine-hollow/data/runtimeCost';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import source from '../../../src/shards/pine-hollow/shard.config';

it('uses the measured cold KTX2 grid cost on both boot paths and admits its exact whole-home claim', () => {
  expect(PINE_HOLLOW.runtimeCost).toBe(PINE_RUNTIME_COST);
  expect(source.runtime?.cost).toEqual(PINE_RUNTIME_COST);
  expect(PINE_RUNTIME_COST.webContentMB + PINE_RUNTIME_COST.glMB).toBeCloseTo(854.931728, 6);
  expect(PINE_RUNTIME_COST.rev).toBe('8e82ae91f701f8990199fe92407e4f1c61f14b20');
  expect(PINE_RUNTIME_COST.evidence).toBe('progress/memory/sf22a-pine-g187-8e82ae91f/summary.json');
  const owner = new PageResidency();
  try {
    expect(owner.admitHome('pine-hollow', runtimeAccountedBytes(PINE_RUNTIME_COST)).bytes).toBe(500_839_395);
    expect(owner.allocator.cost().playing).toBe(935_931_729);
  } finally { owner.dispose(); }
  expect(owner.allocator.entries()).toEqual([]);
});

it('keeps the original images-first provenance and refuses that over-cap configuration before allocation', () => {
  const images = PINE_RUNTIME_COST.imagesFirst;
  expect(images.webContentMB + images.glMB).toBeCloseTo(1192.19544, 6);
  expect(images.rev).toBe('6c0aaea4f');
  const owner = new PageResidency();
  try {
    expect(() => owner.admitHome('pine-hollow', runtimeAccountedBytes(images))).toThrow('admission deferred');
    expect(owner.allocator.entries()).toEqual([]);
  } finally { owner.dispose(); }
});

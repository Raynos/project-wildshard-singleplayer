import { expect, it } from 'vitest';
import { PageResidency } from '../../../src/game/grid/pageResidency';
import { runtimeAccountedBytes } from '../../../src/game/grid/runtimeCost';
import { PINE_RUNTIME_COST } from '../../../src/shards/pine-hollow/data/runtimeCost';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import source from '../../../src/shards/pine-hollow/shard.config';

it('uses the measured cold KTX2 grid cost on both boot paths and admits its exact matched increment claim', () => {
  expect(PINE_HOLLOW.runtimeCost).toBe(PINE_RUNTIME_COST);
  expect(source.runtime?.cost).toEqual(PINE_RUNTIME_COST);
  expect(PINE_RUNTIME_COST.webContentMB + PINE_RUNTIME_COST.glMB).toBeCloseTo(850.089902, 6);
  expect(PINE_RUNTIME_COST.rev).toBe('9f0245c60e20b30ac6200fee6c233e48a5052ac1');
  expect(PINE_RUNTIME_COST.evidence).toBe('progress/memory/g258-accounting/summary.json');
  const owner = new PageResidency();
  try {
    expect(owner.admitHome('pine-hollow', runtimeAccountedBytes(PINE_RUNTIME_COST)).bytes).toBe(161_483_593);
    expect(owner.allocator.cost().playing).toBe(559_246_789);
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

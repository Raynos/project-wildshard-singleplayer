import { expect, it } from 'vitest';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { imagesFirstPlayingBytes, runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';
import { PINE_IMAGES_FIRST_COST, PINE_RUNTIME_COST } from '../src/shards/pine-hollow/data/runtimeCost';
import { NALATI_RUNTIME_COST } from '../src/shards/nalati-grasslands/data/runtimeCost';

const measured = DRIFTWOOD_RUNTIME_COST;

it('applies calibration once to the measured whole runtime home, including its render cost', () => {
  const owner = new PageResidency(new ResidencyAllocator());
  const claim = owner.admitHome('home', runtimeAccountedBytes(measured));
  expect(claim.bytes).toBe(Math.ceil(379_378_000 / CONTENT_CAPS.residentFactor));
  const expected = CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 379_378_000;
  expect(owner.allocator.cost().playing).toBeGreaterThanOrEqual(expected);
  expect(owner.allocator.cost().playing).toBeLessThanOrEqual(expected + 2);
  // The new default has honest headroom; a claim exceeding it still cannot hide behind an empty source budget.
  const tooLarge = Math.ceil((CONTENT_CAPS.playing - owner.allocator.cost().playing + 1) / CONTENT_CAPS.residentFactor);
  expect(owner.allocator.reserve({ id: 'library:neighbour', category: 'library', owner: 'next', bytes: tooLarge, distance: 1, needed: true })).toBeNull();
  owner.dispose();
});

it('refuses missing provenance, nonfinite or negative readings and an impossible engine subtraction', () => {
  for (const input of [undefined, { ...measured, device: '' }, { ...measured, evidence: '' }, { ...measured, rev: 'unknown' }, { ...measured, webContentMB: Number.NaN }, { ...measured, glMB: -1 }, { ...measured, engineBaseMB: 889 }, { ...measured, gpuProcessMB: 255 }]) {
    expect(() => runtimeAccountedBytes(input)).toThrow();
  }
});

it('retains a strict images-first reading independently of the lower compressed runtime measurement', () => {
  const imagesFirst = { ...measured, webContentMB: 650, glMB: 400 };
  const compressed = { ...measured, imagesFirst };
  expect(runtimeAccountedBytes(compressed)).toBe(runtimeAccountedBytes(measured));
  expect(imagesFirstPlayingBytes(compressed)).toBe(1_131_000_001);
  expect(imagesFirstPlayingBytes(measured)).toBe(759_378_001);
  expect(imagesFirstPlayingBytes(undefined)).toBeUndefined();
  for (const images of [{ ...imagesFirst, rev: '' }, { ...imagesFirst, glMB: Number.NaN }, { ...imagesFirst, unknown: 1 }, { ...imagesFirst, imagesFirst }]) {
    expect(() => runtimeAccountedBytes({ ...measured, imagesFirst: images })).toThrow();
  }
});

it('admits the measured cold KTX2 Pine charge without changing its over-cap images-first phone policy', () => {
  const owner = new PageResidency(new ResidencyAllocator());
  expect(PINE_RUNTIME_COST).toMatchObject({ webContentMB: 648.990416, glMB: 205.941312, engineBaseMB: 299,
    rev: '8e82ae91f701f8990199fe92407e4f1c61f14b20', evidence: 'progress/memory/sf22a-pine-g187-8e82ae91f/summary.json' });
  expect(NALATI_RUNTIME_COST).toMatchObject({ webContentMB: 606, glMB: 236.8, engineBaseMB: 299,
    rev: '91f97bdfc', evidence: 'progress/memory/sf22a-2026-10-04.json' });
  expect(owner.admitHome('pine-hollow', runtimeAccountedBytes(PINE_RUNTIME_COST)).bytes).toBe(500_839_395);
  expect(owner.allocator.cost().playing).toBe(935_931_729);
  expect(PINE_RUNTIME_COST.imagesFirst).toBe(PINE_IMAGES_FIRST_COST);
  expect(imagesFirstPlayingBytes(PINE_RUNTIME_COST)).toBeGreaterThan(CONTENT_CAPS.playing);
  // Platform and neighbour claims still consume the remaining margin; they do not inherit a whole-world discount.
  expect(owner.allocator.reserve({ id: 'road', category: 'commons', owner: 'platform', bytes: 60_000_000,
    distance: 0, needed: true })).toBeNull();
  expect(runtimeAccountedBytes(NALATI_RUNTIME_COST)).toBe(489_909_910);
  owner.dispose();
});

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
  expect(claim.bytes).toBe(Math.ceil(371_223_073 / CONTENT_CAPS.residentFactor));
  const expected = CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 371_223_073;
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
  expect(imagesFirstPlayingBytes(measured)).toBe(751_223_074);
  expect(imagesFirstPlayingBytes(undefined)).toBeUndefined();
  for (const images of [{ ...imagesFirst, rev: '' }, { ...imagesFirst, glMB: Number.NaN }, { ...imagesFirst, unknown: 1 }, { ...imagesFirst, imagesFirst }]) {
    expect(() => runtimeAccountedBytes({ ...measured, imagesFirst: images })).toThrow();
  }
});

it('admits the measured cold KTX2 Pine charge without changing its over-cap images-first phone policy', () => {
  const owner = new PageResidency(new ResidencyAllocator());
  expect(PINE_RUNTIME_COST).toMatchObject({ webContentMB: 533.958808, glMB: 316.131094, engineBaseMB: 299, residentBaseMB: 670.843114,
    rev: '9f0245c60e20b30ac6200fee6c233e48a5052ac1', evidence: 'progress/memory/g258-accounting/summary.json' });
  expect(NALATI_RUNTIME_COST.residentBaseMB).toBe(685.345862);
  expect(owner.admitHome('pine-hollow', runtimeAccountedBytes(PINE_RUNTIME_COST)).bytes).toBe(161_483_593);
  expect(owner.allocator.cost().playing).toBe(559_246_789);
  expect(PINE_RUNTIME_COST.imagesFirst).toBe(PINE_IMAGES_FIRST_COST);
  expect(imagesFirstPlayingBytes(PINE_RUNTIME_COST)).toBeGreaterThan(CONTENT_CAPS.playing);
  // Platform and neighbour claims still consume the remaining margin; they do not inherit a whole-world discount.
  expect(owner.allocator.reserve({ id: 'road', category: 'commons', owner: 'platform', bytes: 400_000_000,
    distance: 0, needed: true })).toBeNull();
  expect(runtimeAccountedBytes(NALATI_RUNTIME_COST)).toBe(197_073_318);
  owner.dispose();
});

it('subtracts only a matched resident baseline once and retains the legacy engine-only calculation', () => {
  const row = { ...measured, webContentMB: 800, glMB: 200, engineBaseMB: 299, residentBaseMB: 700 };
  expect(runtimeAccountedBytes(row)).toBe(Math.ceil(300_000_000 / CONTENT_CAPS.residentFactor));
  const legacy = { ...measured, webContentMB: 800, glMB: 200, engineBaseMB: 299 };
  expect(runtimeAccountedBytes(legacy)).toBe(Math.ceil(701_000_000 / CONTENT_CAPS.residentFactor));
  for (const residentBaseMB of [Number.NaN, Number.POSITIVE_INFINITY, -1, 298, 1000, 1001]) {
    expect(() => runtimeAccountedBytes({ ...row, residentBaseMB })).toThrow();
  }
});

it('projects the grid residents before Auto chooses images while preserving the standalone estimate', () => {
  const residents = { l0: 0, l1: 0, far: 0, libraries: 0, commons: 0, sims: 180_000_000, overlap: CONTENT_CAPS.overlap };
  // Nalati's standalone image envelope fits, but those images plus the live road do not.
  expect(imagesFirstPlayingBytes(NALATI_RUNTIME_COST)).toBeLessThan(CONTENT_CAPS.playing);
  expect(imagesFirstPlayingBytes(NALATI_RUNTIME_COST, residents)).toBeGreaterThan(CONTENT_CAPS.playing);
  expect(imagesFirstPlayingBytes(undefined, residents)).toBeUndefined();
  const standalone = imagesFirstPlayingBytes(NALATI_RUNTIME_COST);
  if (standalone === undefined) throw new Error('Expected Nalati measurement');
  expect(imagesFirstPlayingBytes(NALATI_RUNTIME_COST, residents)).toBe(standalone + 199_800_000);
  expect(residents.sims).toBe(180_000_000);
  const allocator = new ResidencyAllocator();
  const road = allocator.reserve({ id: 'sim:road', category: 'sim', owner: 'road', bytes: residents.sims, distance: 0, needed: true });
  if (road === null) throw new Error('Expected the road to fit');
  expect(allocator.reserve({ id: 'sim:target', category: 'sim', owner: 'target', bytes: runtimeAccountedBytes(NALATI_RUNTIME_COST.imagesFirst), distance: 0, needed: true })).toBeNull();
  const compressed = allocator.reserve({ id: 'sim:target', category: 'sim', owner: 'target', bytes: runtimeAccountedBytes(NALATI_RUNTIME_COST), distance: 0, needed: true });
  if (compressed === null) throw new Error('Expected the measured compressed increment to fit');
  compressed.release(); road.release();
  expect(allocator.entries()).toHaveLength(0);
});

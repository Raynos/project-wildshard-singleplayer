import { expect, test } from 'vitest';
import { CONTENT_CAPS, ENGINE_BASE_BYTES } from './contentBounds';
import { contentCost } from './contentCost';

const MiB = 1024 * 1024;
// Template 1's own 80 tile rows and declared library/sim, read from the
// existing product for C6. This is a fixed model fixture, not a fresh build proof.
const template = { l0: 13_099_624, l1: 2_749_512, far: 1_141_664,
  libraries: 14_099_323, sims: 16_000_000, commons: 0, overlap: 0 };

test('standalone template estimate matches the Simulator scale without grid claims', () => {
  const estimate = contentCost(template), measured = (261 + 43) * MiB;
  expect(ENGINE_BASE_BYTES).toBe(250 * MiB);
  expect(CONTENT_CAPS.engineBase).toBe(ENGINE_BASE_BYTES);
  expect(estimate.accounted).toBe(47_090_123);
  expect(estimate.playing / measured).toBeGreaterThan(0.85);
  expect(estimate.playing / measured).toBeLessThan(1.15);
  expect(estimate.loading).toBe(estimate.playing);
});

test('grid page allocations and overlap are charged only when supplied', () => {
  const standalone = contentCost(template), page = 321_000_000, overlap = 80_000_000;
  const grid = contentCost({ ...template, page, overlap });
  expect(grid.accounted - standalone.accounted).toBe(page);
  expect(grid.playing - standalone.playing).toBe(page + overlap);
  expect(grid.loading - grid.playing).toBe(overlap);
  const split = contentCost({ ...template, page: 12_000_000, engineBase: ENGINE_BASE_BYTES - 12_000_000 });
  expect(split.playing).toBe(standalone.playing);
});
